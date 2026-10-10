import crypto from 'crypto';

/**
 * HMAC-SHA256 서명을 생성합니다.
 * 웹훅 서명 검증 등에 사용됩니다.
 */
export function generateHMAC(
  data: string | Buffer,
  secret: string,
  encoding: 'hex' | 'base64' = 'hex',
): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data);
  return hmac.digest(encoding);
}

/**
 * HMAC-SHA256 서명을 검증합니다.
 * 타이밍 공격을 방지하기 위해 timingSafeEqual을 사용합니다.
 */
export function verifyHMAC(
  data: string | Buffer,
  signature: string,
  secret: string,
  encoding: 'hex' | 'base64' = 'hex',
): boolean {
  try {
    const expected = generateHMAC(data, secret, encoding);
    const actual = Buffer.from(signature, encoding);
    const expectedBuffer = Buffer.from(expected, encoding);
    return crypto.timingSafeEqual(actual, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * SHA256 해시를 생성합니다.
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * 랜덤 바이트를 생성합니다.
 */
export function generateRandomBytes(length: number = 32): Buffer {
  return crypto.randomBytes(length);
}

/**
 * 랜덤 문자열을 생성합니다 (16진수).
 */
export function generateRandomString(length: number = 32): string {
  return generateRandomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * 데이터를 AES-256-GCM으로 암호화합니다.
 * 반환: { iv, ciphertext, authTag } (모두 hex 인코딩)
 */
export function encryptAES256GCM(
  plaintext: string,
  key: Buffer,
): { iv: string; ciphertext: string; authTag: string } {
  if (key.length !== 32) {
    throw new Error('Key must be 32 bytes for AES-256');
  }
  const iv = generateRandomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    ciphertext,
    authTag: authTag.toString('hex'),
  };
}

/**
 * AES-256-GCM으로 암호화된 데이터를 복호화합니다.
 */
export function decryptAES256GCM(
  encrypted: { iv: string; ciphertext: string; authTag: string },
  key: Buffer,
): string {
  if (key.length !== 32) {
    throw new Error('Key must be 32 bytes for AES-256');
  }
  const iv = Buffer.from(encrypted.iv, 'hex');
  const authTag = Buffer.from(encrypted.authTag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}

/**
 * 비밀번호 기반 키 유도 함수 (PBKDF2).
 * 암호화 키 생성에 사용됩니다.
 */
export function deriveKeyFromPassword(
  password: string,
  salt: Buffer,
  iterations: number = 100000,
  keyLength: number = 32,
): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
}

/**
 * 타임스탬프 기반 일회용 비밀번호(TOTP) 생성 (6자리).
 * 2FA 구현에 사용될 수 있습니다.
 */
export function generateTOTP(secret: Buffer, timeStep: number = 30): string {
  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / timeStep);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(counterBuffer);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(code).padStart(6, '0');
}

/**
 * TOTP 검증 (시간 윈도우 포함).
 */
export function verifyTOTP(
  secret: Buffer,
  code: string,
  timeStep: number = 30,
  windowSize: number = 1,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  for (let i = -windowSize; i <= windowSize; i++) {
    const counter = Math.floor((now + i * timeStep) / timeStep);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter), 0);
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(counterBuffer);
    const digest = hmac.digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const generatedCode = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
    if (String(generatedCode).padStart(6, '0') === code) {
      return true;
    }
  }
  return false;
}

/**
 * 데이터의 체크섬을 생성합니다 (무결성 검증용).
 */
export function generateChecksum(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * 체크섬을 검증합니다.
 */
export function verifyChecksum(data: string | Buffer, checksum: string): boolean {
  return generateChecksum(data) === checksum;
}
