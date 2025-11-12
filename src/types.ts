import { CryptoKey } from './lib/crypto';

export interface RoomState {
  roomId: string;
  roomCode: string;
  key: CryptoKey;
  salt: string;
  peerId: string;
}

export interface DecryptedMessage {
  id: string;
  content: string;
  timestamp: Date;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'file';
  mediaUrl?: string;
  mediaIv?: string; // IV for media decryption
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

