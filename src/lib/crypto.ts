/**
 * Crypto utilities for client-side encryption
 * Uses Web Crypto API with PBKDF2 for key derivation and AES-GCM for encryption
 */

const PBKDF2_ITERATIONS = 200000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const KEY_LENGTH = 256; // AES-256

/**
 * Derives a cryptographic key from a room code and salt using PBKDF2
 * @param roomCode - The room passphrase
 * @param salt - The salt (Uint8Array or base64 string)
 * @returns Promise<CryptoKey> - The derived key
 */
export async function deriveKey(
  roomCode: string,
  salt: Uint8Array | string
): Promise<CryptoKey> {
  const saltArray = typeof salt === 'string' 
    ? Uint8Array.from(atob(salt), c => c.charCodeAt(0))
    : salt;

  // Import room code as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(roomCode),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive key using PBKDF2
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltArray,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Generates a random salt
 * @returns Promise<string> - Base64-encoded salt
 */
export async function generateSalt(): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return btoa(String.fromCharCode(...salt));
}

/**
 * Encrypts a string using AES-GCM
 * @param plaintext - The text to encrypt
 * @param key - The encryption key
 * @returns Promise<{ciphertext: string, iv: string}> - Base64-encoded ciphertext and IV
 */
export async function encryptString(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decrypts a string encrypted with AES-GCM
 * @param ciphertext - Base64-encoded ciphertext
 * @param iv - Base64-encoded IV
 * @param key - The decryption key
 * @returns Promise<string> - The decrypted plaintext
 */
export async function decryptString(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const ciphertextArray = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const ivArray = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivArray },
    key,
    ciphertextArray
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Encrypts a file/blob using AES-GCM with chunked processing
 * @param file - The file to encrypt
 * @param key - The encryption key
 * @returns Promise<{encryptedBlob: Blob, iv: string}> - Encrypted blob and IV
 */
export async function encryptFileStream(
  file: File | Blob,
  key: CryptoKey
): Promise<{ encryptedBlob: Blob; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const chunkSize = 2 * 1024 * 1024; // 2 MiB chunks
  const chunks: Uint8Array[] = [];

  let offset = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);
    const arrayBuffer = await chunk.arrayBuffer();
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      arrayBuffer
    );

    chunks.push(new Uint8Array(encrypted));
    offset += chunkSize;
  }

  // Combine all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let position = 0;
  for (const chunk of chunks) {
    combined.set(chunk, position);
    position += chunk.length;
  }

  return {
    encryptedBlob: new Blob([combined], { type: 'application/octet-stream' }),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decrypts an encrypted blob
 * @param blob - The encrypted blob
 * @param iv - Base64-encoded IV
 * @param key - The decryption key
 * @returns Promise<Blob> - The decrypted blob
 */
export async function decryptFileStream(
  blob: Blob,
  iv: string,
  key: CryptoKey
): Promise<Blob> {
  const ivArray = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const chunkSize = 2 * 1024 * 1024; // 2 MiB chunks
  const chunks: Uint8Array[] = [];

  let offset = 0;
  while (offset < blob.size) {
    const chunk = blob.slice(offset, offset + chunkSize);
    const arrayBuffer = await chunk.arrayBuffer();
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivArray },
      key,
      arrayBuffer
    );

    chunks.push(new Uint8Array(decrypted));
    offset += chunkSize;
  }

  // Combine all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let position = 0;
  for (const chunk of chunks) {
    combined.set(chunk, position);
    position += chunk.length;
  }

  return new Blob([combined]);
}

/**
 * Computes SHA-256 hash of a derived key for verification
 * @param key - The derived key
 * @returns Promise<string> - Base64-encoded hash
 */
export async function computeVerifierHash(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  const hash = await crypto.subtle.digest('SHA-256', exported);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

/**
 * Verifies a room code by comparing verifier hash
 * @param roomCode - The room code to verify
 * @param salt - The salt
 * @param expectedHash - The expected verifier hash
 * @returns Promise<boolean> - True if the hash matches
 */
export async function verifyRoomCode(
  roomCode: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  try {
    const key = await deriveKey(roomCode, salt);
    const hash = await computeVerifierHash(key);
    return hash === expectedHash;
  } catch {
    return false;
  }
}



