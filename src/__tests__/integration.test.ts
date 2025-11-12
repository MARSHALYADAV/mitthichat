/**
 * Integration tests for encrypted chat
 * These tests simulate two clients exchanging messages
 */

import { describe, it, expect } from 'vitest';
import {
  deriveKey,
  generateSalt,
  encryptString,
  decryptString,
  encryptFileStream,
  decryptFileStream,
} from '../lib/crypto';

describe('Integration Tests - Two Client Simulation', () => {
  const roomCode = 'test-room-123';
  let salt: string;
  let sharedKey: CryptoKey;

  it('should allow two clients to derive the same key', async () => {
    salt = await generateSalt();
    
    // Client A derives key
    const keyA = await deriveKey(roomCode, salt);
    
    // Client B derives key (same room code and salt)
    const keyB = await deriveKey(roomCode, salt);
    
    // Both should have the same key
    const exportedA = await crypto.subtle.exportKey('raw', keyA);
    const exportedB = await crypto.subtle.exportKey('raw', keyB);
    
    expect(exportedA).toEqual(exportedB);
    sharedKey = keyA;
  });

  it('should allow client A to send and client B to receive encrypted messages', async () => {
    const messages = [
      'Hello from client A!',
      'This is a test message',
      'Message with emoji: 🚀',
    ];

    for (const plaintext of messages) {
      // Client A encrypts
      const { ciphertext, iv } = await encryptString(plaintext, sharedKey);
      
      // Client B decrypts
      const decrypted = await decryptString(ciphertext, iv, sharedKey);
      
      expect(decrypted).toBe(plaintext);
    }
  });

  it('should allow bidirectional encrypted messaging', async () => {
    // Client A sends message
    const messageA = 'Message from A';
    const { ciphertext: cipherA, iv: ivA } = await encryptString(messageA, sharedKey);
    const decryptedA = await decryptString(cipherA, ivA, sharedKey);
    expect(decryptedA).toBe(messageA);

    // Client B sends message
    const messageB = 'Response from B';
    const { ciphertext: cipherB, iv: ivB } = await encryptString(messageB, sharedKey);
    const decryptedB = await decryptString(cipherB, ivB, sharedKey);
    expect(decryptedB).toBe(messageB);
  });

  it('should allow encrypted file sharing between clients', async () => {
    const fileContent = 'This is a test file content. '.repeat(50);
    const blob = new Blob([fileContent], { type: 'text/plain' });
    
    // Client A encrypts and "uploads"
    const { encryptedBlob, iv } = await encryptFileStream(blob, sharedKey);
    
    // Client B "downloads" and decrypts
    const decryptedBlob = await decryptFileStream(encryptedBlob, iv, sharedKey);
    const decryptedContent = await decryptedBlob.text();
    
    expect(decryptedContent).toBe(fileContent);
  });

  it('should prevent decryption with wrong key', async () => {
    const plaintext = 'Secret message';
    const { ciphertext, iv } = await encryptString(plaintext, sharedKey);
    
    // Wrong key (different room code)
    const wrongSalt = await generateSalt();
    const wrongKey = await deriveKey('wrong-room-code', wrongSalt);
    
    // Should fail to decrypt
    await expect(decryptString(ciphertext, iv, wrongKey)).rejects.toThrow();
  });

  it('should handle multiple messages in sequence', async () => {
    const messages = Array.from({ length: 10 }, (_, i) => `Message ${i + 1}`);
    
    for (const msg of messages) {
      const { ciphertext, iv } = await encryptString(msg, sharedKey);
      const decrypted = await decryptString(ciphertext, iv, sharedKey);
      expect(decrypted).toBe(msg);
    }
  });
});



