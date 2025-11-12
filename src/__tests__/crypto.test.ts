import { describe, it, expect } from 'vitest';
import {
  deriveKey,
  generateSalt,
  encryptString,
  decryptString,
  encryptFileStream,
  decryptFileStream,
  computeVerifierHash,
  verifyRoomCode,
} from '../lib/crypto';

describe('Crypto Functions', () => {
  const testRoomCode = 'test-room-code-123';
  let testSalt: string;
  let testKey: CryptoKey;

  it('should generate a salt', async () => {
    testSalt = await generateSalt();
    expect(testSalt).toBeDefined();
    expect(testSalt.length).toBeGreaterThan(0);
    
    // Salt should be base64 encoded
    const decoded = atob(testSalt);
    expect(decoded.length).toBe(16); // 16 bytes
  });

  it('should derive a key from room code and salt', async () => {
    testKey = await deriveKey(testRoomCode, testSalt);
    expect(testKey).toBeDefined();
    expect(testKey.type).toBe('secret');
    expect(testKey.algorithm.name).toBe('AES-GCM');
  });

  it('should derive the same key with same inputs', async () => {
    const key1 = await deriveKey(testRoomCode, testSalt);
    const key2 = await deriveKey(testRoomCode, testSalt);
    
    const exported1 = await crypto.subtle.exportKey('raw', key1);
    const exported2 = await crypto.subtle.exportKey('raw', key2);
    
    expect(exported1).toEqual(exported2);
  });

  it('should derive different keys with different salts', async () => {
    const salt2 = await generateSalt();
    const key1 = await deriveKey(testRoomCode, testSalt);
    const key2 = await deriveKey(testRoomCode, salt2);
    
    const exported1 = await crypto.subtle.exportKey('raw', key1);
    const exported2 = await crypto.subtle.exportKey('raw', key2);
    
    expect(exported1).not.toEqual(exported2);
  });

  it('should encrypt and decrypt a string', async () => {
    const plaintext = 'Hello, encrypted world!';
    const { ciphertext, iv } = await encryptString(plaintext, testKey);
    
    expect(ciphertext).toBeDefined();
    expect(iv).toBeDefined();
    expect(ciphertext).not.toBe(plaintext);
    
    const decrypted = await decryptString(ciphertext, iv, testKey);
    expect(decrypted).toBe(plaintext);
  });

  it('should encrypt and decrypt multiple strings', async () => {
    const messages = [
      'Short message',
      'This is a longer message with more content',
      'Message with special chars: !@#$%^&*()',
      'Unicode: 🚀 🔐 💬',
    ];

    for (const msg of messages) {
      const { ciphertext, iv } = await encryptString(msg, testKey);
      const decrypted = await decryptString(ciphertext, iv, testKey);
      expect(decrypted).toBe(msg);
    }
  });

  it('should produce different ciphertext for same plaintext (IV uniqueness)', async () => {
    const plaintext = 'Same message';
    const { ciphertext: ciphertext1, iv: iv1 } = await encryptString(plaintext, testKey);
    const { ciphertext: ciphertext2, iv: iv2 } = await encryptString(plaintext, testKey);
    
    expect(ciphertext1).not.toBe(ciphertext2);
    expect(iv1).not.toBe(iv2);
    
    // Both should decrypt to same plaintext
    const decrypted1 = await decryptString(ciphertext1, iv1, testKey);
    const decrypted2 = await decryptString(ciphertext2, iv2, testKey);
    expect(decrypted1).toBe(plaintext);
    expect(decrypted2).toBe(plaintext);
  });

  it('should encrypt and decrypt a file/blob', async () => {
    const testContent = 'This is test file content. '.repeat(100);
    const blob = new Blob([testContent], { type: 'text/plain' });
    
    const { encryptedBlob, iv } = await encryptFileStream(blob, testKey);
    
    expect(encryptedBlob).toBeDefined();
    expect(encryptedBlob.size).toBeGreaterThan(0);
    expect(iv).toBeDefined();
    
    const decryptedBlob = await decryptFileStream(encryptedBlob, iv, testKey);
    const decryptedText = await decryptedBlob.text();
    
    expect(decryptedText).toBe(testContent);
  });

  it('should handle large files (chunked encryption)', async () => {
    // Create a 3MB file
    const largeContent = new Uint8Array(3 * 1024 * 1024);
    for (let i = 0; i < largeContent.length; i++) {
      largeContent[i] = i % 256;
    }
    const blob = new Blob([largeContent], { type: 'application/octet-stream' });
    
    const { encryptedBlob, iv } = await encryptFileStream(blob, testKey);
    const decryptedBlob = await decryptFileStream(encryptedBlob, iv, testKey);
    
    const decryptedArray = new Uint8Array(await decryptedBlob.arrayBuffer());
    expect(decryptedArray.length).toBe(largeContent.length);
    expect(decryptedArray).toEqual(largeContent);
  });

  it('should compute verifier hash', async () => {
    const hash = await computeVerifierHash(testKey);
    expect(hash).toBeDefined();
    expect(hash.length).toBeGreaterThan(0);
    
    // Hash should be consistent
    const hash2 = await computeVerifierHash(testKey);
    expect(hash).toBe(hash2);
  });

  it('should verify room code correctly', async () => {
    const salt = await generateSalt();
    const key = await deriveKey(testRoomCode, salt);
    const verifierHash = await computeVerifierHash(key);
    
    // Correct room code should verify
    const isValid = await verifyRoomCode(testRoomCode, salt, verifierHash);
    expect(isValid).toBe(true);
    
    // Wrong room code should fail
    const isInvalid = await verifyRoomCode('wrong-code', salt, verifierHash);
    expect(isInvalid).toBe(false);
  });

  it('should fail decryption with wrong key', async () => {
    const plaintext = 'Secret message';
    const { ciphertext, iv } = await encryptString(plaintext, testKey);
    
    // Create a different key
    const wrongSalt = await generateSalt();
    const wrongKey = await deriveKey('wrong-code', wrongSalt);
    
    // Decryption should fail
    await expect(decryptString(ciphertext, iv, wrongKey)).rejects.toThrow();
  });

  it('should fail decryption with wrong IV', async () => {
    const plaintext = 'Secret message';
    const { ciphertext, iv } = await encryptString(plaintext, testKey);
    
    // Use wrong IV
    const wrongIv = await generateSalt(); // Just a random base64 string
    
    // Decryption should fail
    await expect(decryptString(ciphertext, wrongIv, testKey)).rejects.toThrow();
  });
});



