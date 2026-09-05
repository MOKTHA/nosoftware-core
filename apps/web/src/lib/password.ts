/**
 * Password hashing and verification using Node.js built-in crypto.
 *
 * Uses scrypt (memory-hard KDF) with a random 16-byte salt.
 * Format: `${salt_hex}:${hash_hex}`
 */
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

/** Hash a plaintext password → "salt:hash" */
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex');
    scrypt(password, salt, KEY_LENGTH, (err, derived) => {
      if (err) reject(err);
      else resolve(`${salt}:${derived.toString('hex')}`);
    });
  });
}

/** Verify a plaintext password against a "salt:hash" string */
export function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) { resolve(false); return; }

    scrypt(password, salt, KEY_LENGTH, (err, derived) => {
      if (err) reject(err);
      else {
        const hashBuffer = Buffer.from(hash, 'hex');
        resolve(timingSafeEqual(hashBuffer, derived));
      }
    });
  });
}
