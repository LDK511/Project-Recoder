/**
 * 상품 이미지 저장소.
 *  - S3_BUCKET + AWS 자격증명이 있으면 S3(또는 S3_ENDPOINT 로 지정한 호환 스토리지: R2, MinIO 등)에 저장
 *  - 없으면 서버 로컬 디스크(UPLOAD_DIR, 기본 ./uploads)에 저장하고 /uploads/... 로 제공
 * 운영에서는 컨테이너 재시작 시 파일이 사라지지 않도록 S3 사용 또는 볼륨 마운트를 권장합니다.
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { ValidationError } from './errors.js';
import { logger } from './logger.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const bucket = process.env.S3_BUCKET;
const useS3 = !!(bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
const region = process.env.AWS_REGION || 'ap-northeast-2';
const endpoint = process.env.S3_ENDPOINT || undefined;
/** 업로드한 객체를 내려줄 공개 주소(CloudFront 등). 없으면 S3 기본 주소 */
const publicBaseUrl = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');

const s3 = useS3
  ? new S3Client({ region, endpoint, forcePathStyle: !!endpoint })
  : null;

export function getUploadDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
}

export async function initializeUploadsDir(): Promise<void> {
  if (!useS3) {
    await fs.mkdir(getUploadDir(), { recursive: true });
  }
}

/** 파일 앞부분(매직 넘버)으로 실제 이미지 형식을 판별합니다. MIME 헤더는 위조될 수 있습니다. */
function detectImageType(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { ext: 'png', mime: 'image/png' };
  if (buf.length >= 6 && (buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a'))
    return { ext: 'gif', mime: 'image/gif' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return { ext: 'webp', mime: 'image/webp' };
  return null;
}

/** 이미지를 저장하고 공개 URL 을 돌려줍니다. */
export async function uploadFile(fileBuffer: Buffer, _originalName?: string, _mimeType?: string): Promise<string> {
  if (fileBuffer.length > MAX_IMAGE_BYTES) {
    throw new ValidationError('이미지는 5MB 이하만 업로드할 수 있습니다.');
  }
  const type = detectImageType(fileBuffer);
  if (!type) {
    throw new ValidationError('JPG, PNG, GIF, WEBP 이미지만 업로드할 수 있습니다.');
  }
  const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${type.ext}`;

  if (s3 && bucket) {
    const key = `products/${fileName}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: type.mime,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    if (publicBaseUrl) return `${publicBaseUrl}/${key}`;
    return endpoint
      ? `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  await fs.mkdir(getUploadDir(), { recursive: true });
  await fs.writeFile(path.join(getUploadDir(), fileName), fileBuffer);
  return `/uploads/${fileName}`;
}

/** 저장된 이미지를 지웁니다. 실패해도 예외를 던지지 않습니다(로그만 남김). */
export async function deleteFile(fileUrl: string | null | undefined): Promise<void> {
  if (!fileUrl) return;
  try {
    if (fileUrl.startsWith('/uploads/')) {
      const name = path.basename(fileUrl);
      await fs.unlink(path.join(getUploadDir(), name));
      return;
    }
    if (s3 && bucket) {
      const idx = fileUrl.indexOf('products/');
      if (idx === -1) return;
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileUrl.slice(idx) }));
    }
  } catch (error) {
    logger.warn('Failed to delete image', { fileUrl, error });
  }
}
