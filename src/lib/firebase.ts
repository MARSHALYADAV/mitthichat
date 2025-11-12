/**
 * Firebase configuration and helper functions
 * Handles Firestore and Storage operations for encrypted chat
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  deleteDoc,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentSnapshot,
} from 'firebase/firestore';
import {
  getStorage,
  FirebaseStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

// Firebase configuration (loaded from environment variables)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
}

// Types
export interface RoomMetadata {
  salt: string;
  verifierHash?: string;
  createdAt: Timestamp;
  lastActivity: Timestamp;
}

export interface EncryptedMessage {
  ciphertext: string;
  iv: string;
  senderFingerprint?: string;
  timestamp: Timestamp;
  contentType: 'text' | 'image' | 'audio' | 'video' | 'file';
  mediaMeta?: {
    storagePath: string;
    fileName?: string;
    fileNameIv?: string; // IV for filename decryption
    fileSize?: number;
    mimeType?: string;
    mimeTypeIv?: string; // IV for mimeType decryption
    mediaIv?: string; // IV for media decryption
  };
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'hangup';
  data: any;
  from: string;
  timestamp: Timestamp;
}

/**
 * Creates a new room with a random salt
 * @param roomId - The room ID
 * @param salt - The salt (base64-encoded)
 * @param verifierHash - Optional verifier hash
 * @returns Promise<void>
 */
export async function createRoom(
  roomId: string,
  salt: string,
  verifierHash?: string
): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  const metadata: RoomMetadata = {
    salt,
    verifierHash,
    createdAt: Timestamp.now(),
    lastActivity: Timestamp.now(),
  };
  await setDoc(roomRef, metadata);
}

/**
 * Gets room metadata
 * @param roomId - The room ID
 * @returns Promise<RoomMetadata | null>
 */
export async function getRoomMetadata(roomId: string): Promise<RoomMetadata | null> {
  const roomRef = doc(db, 'rooms', roomId);
  const snapshot = await getDoc(roomRef);
  if (snapshot.exists()) {
    return snapshot.data() as RoomMetadata;
  }
  return null;
}

/**
 * Updates room last activity timestamp
 * @param roomId - The room ID
 */
export async function updateRoomActivity(roomId: string): Promise<void> {
  const roomRef = doc(db, 'rooms', roomId);
  await setDoc(roomRef, { lastActivity: Timestamp.now() }, { merge: true });
}

/**
 * Sends an encrypted message to a room
 * @param roomId - The room ID
 * @param message - The encrypted message
 * @returns Promise<string> - Message document ID
 */
export async function sendMessage(
  roomId: string,
  message: Omit<EncryptedMessage, 'timestamp'>
): Promise<string> {
  await updateRoomActivity(roomId);
  const messagesRef = collection(db, 'rooms', roomId, 'messages');
  const docRef = await addDoc(messagesRef, {
    ...message,
    timestamp: Timestamp.now(),
  });
  return docRef.id;
}

/**
 * Gets paginated messages from a room
 * @param roomId - The room ID
 * @param pageSize - Number of messages per page
 * @param lastDoc - Last document snapshot for pagination
 * @returns Promise<{messages: EncryptedMessage[], lastDoc: QueryDocumentSnapshot | null}>
 */
export async function getMessages(
  roomId: string,
  pageSize: number = 50,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<{ messages: EncryptedMessage[]; lastDoc: QueryDocumentSnapshot | null }> {
  const messagesRef = collection(db, 'rooms', roomId, 'messages');
  let q = query(messagesRef, orderBy('timestamp', 'desc'), limit(pageSize));

  if (lastDoc) {
    q = query(messagesRef, orderBy('timestamp', 'desc'), startAfter(lastDoc), limit(pageSize));
  }

  const snapshot = await getDocs(q);
  const messages: EncryptedMessage[] = [];
  let newLastDoc: QueryDocumentSnapshot | null = null;

  snapshot.forEach((doc) => {
    messages.push(doc.data() as EncryptedMessage);
    if (!newLastDoc) {
      newLastDoc = doc;
    }
  });

  // Reverse to get chronological order
  messages.reverse();

  return { messages, lastDoc: newLastDoc };
}

/**
 * Subscribes to new messages in a room
 * @param roomId - The room ID
 * @param callback - Callback function for new messages
 * @returns Unsubscribe function
 */
export function subscribeToMessages(
  roomId: string,
  callback: (message: EncryptedMessage & { id: string }) => void
): () => void {
  const messagesRef = collection(db, 'rooms', roomId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));

  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        callback({
          id: change.doc.id,
          ...(change.doc.data() as EncryptedMessage),
        });
      }
    });
  });
}

/**
 * Uploads an encrypted file to Firebase Storage
 * @param roomId - The room ID
 * @param fileId - Unique file ID
 * @param encryptedBlob - The encrypted blob
 * @returns Promise<string> - Download URL
 */
export async function uploadEncryptedFile(
  roomId: string,
  fileId: string,
  encryptedBlob: Blob
): Promise<string> {
  const storageRef = ref(storage, `rooms/${roomId}/media/${fileId}.enc`);
  const uploadTask = uploadBytesResumable(storageRef, encryptedBlob);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        // Progress tracking can be added here
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log(`Upload progress: ${progress}%`);
      },
      (error) => {
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}

/**
 * Downloads an encrypted file from Firebase Storage
 * @param storagePath - The storage path
 * @returns Promise<Blob> - The encrypted blob
 */
export async function downloadEncryptedFile(storagePath: string): Promise<Blob> {
  const response = await fetch(storagePath);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  return await response.blob();
}

/**
 * Sends a WebRTC signaling message
 * @param roomId - The room ID
 * @param signalType - Type of signal (offer, answer, ice-candidate, hangup)
 * @param data - Signal data
 * @param from - Sender identifier
 * @returns Promise<string> - Document ID
 */
export async function sendSignalingMessage(
  roomId: string,
  signalType: SignalingMessage['type'],
  data: any,
  from: string
): Promise<string> {
  const signalingRef = collection(db, 'rooms', roomId, 'signaling');
  const docRef = await addDoc(signalingRef, {
    type: signalType,
    data,
    from,
    timestamp: Timestamp.now(),
  });
  return docRef.id;
}

/**
 * Subscribes to signaling messages in a room
 * @param roomId - The room ID
 * @param from - Filter by sender (exclude own messages)
 * @param callback - Callback function for signaling messages
 * @returns Unsubscribe function
 */
export function subscribeToSignaling(
  roomId: string,
  from: string,
  callback: (signal: SignalingMessage & { id: string }) => void
): () => void {
  const signalingRef = collection(db, 'rooms', roomId, 'signaling');
  const q = query(signalingRef, orderBy('timestamp', 'desc'));

  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const signal = change.doc.data() as SignalingMessage;
        // Only process signals from other peers
        if (signal.from !== from) {
          callback({
            id: change.doc.id,
            ...signal,
          });
        }
      }
    });
  });
}

/**
 * Cleans up signaling messages (deletes old ones)
 * @param roomId - The room ID
 * @param keepRecent - Number of recent messages to keep
 */
export async function cleanupSignaling(roomId: string, keepRecent: number = 10): Promise<void> {
  const signalingRef = collection(db, 'rooms', roomId, 'signaling');
  const q = query(signalingRef, orderBy('timestamp', 'desc'));

  const snapshot = await getDocs(q);
  const docs = snapshot.docs;
  
  // Delete all but the most recent ones
  const toDelete = docs.slice(keepRecent);
  for (const doc of toDelete) {
    await deleteDoc(doc.ref);
  }
}

/**
 * Deletes a signaling message
 * @param roomId - The room ID
 * @param messageId - The message document ID
 */
export async function deleteSignalingMessage(roomId: string, messageId: string): Promise<void> {
  const signalRef = doc(db, 'rooms', roomId, 'signaling', messageId);
  await deleteDoc(signalRef);
}

export { db, storage };

