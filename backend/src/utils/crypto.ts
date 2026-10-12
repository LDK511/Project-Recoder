import crypto from 'crypto';

/**
 * Generate HMAC-SHA256 signature for webhook verification
 * @param payload Data to sign (typically JSON stringified)
 * @param secret Secret key for signing
 * @returns Hex-encoded signature
 */
export function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify HMAC-SHA256 signature
 * @param payload Data that was signed
 * @param signature Signature to verify (hex-encoded)
 * @param secret Secret key used for signing
 * @returns true if signature is valid, false otherwise
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = generateSignature(payload, secret);
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Generate a random token (for idempotency keys, etc.)
 * @param length Length of the token in bytes
 * @returns Hex-encoded random token
 */
export function generateRandomToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a string using SHA256
 * @param data String to hash
 * @returns Hex-encoded hash
 */
export function hashString(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
