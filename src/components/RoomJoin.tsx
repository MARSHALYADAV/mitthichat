import { useState } from 'react';
import { deriveKey, generateSalt, computeVerifierHash, verifyRoomCode } from '../lib/crypto';
import { createRoom, getRoomMetadata } from '../lib/firebase';
import { RoomState } from '../types';
import { generatePeerId } from '../lib/webrtc';

interface RoomJoinProps {
  onJoin: (roomState: RoomState) => void;
}

export default function RoomJoin({ onJoin }: RoomJoinProps) {
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Generate salt
      const salt = await generateSalt();
      
      // Derive key
      const key = await deriveKey(roomCode, salt);
      
      // Generate verifier hash
      const verifierHash = await computeVerifierHash(key);
      
      // Generate room ID from room code hash
      const roomId = await generateRoomId(roomCode);
      
      // Create room in Firestore
      await createRoom(roomId, salt, verifierHash);
      
      const peerId = generatePeerId();
      
      onJoin({
        roomId,
        roomCode,
        key,
        salt,
        peerId,
      });
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      // Generate room ID from room code
      const roomId = await generateRoomId(roomCode);
      
      // Get room metadata
      const metadata = await getRoomMetadata(roomId);
      
      if (!metadata) {
        setError('Room not found. Please check your room code.');
        setIsJoining(false);
        return;
      }

      // Verify room code (optional but recommended)
      if (metadata.verifierHash) {
        const isValid = await verifyRoomCode(roomCode, metadata.salt, metadata.verifierHash);
        if (!isValid) {
          setError('Invalid room code. Please check and try again.');
          setIsJoining(false);
          return;
        }
      }

      // Derive key
      const key = await deriveKey(roomCode, metadata.salt);
      
      const peerId = generatePeerId();
      
      onJoin({
        roomId,
        roomCode,
        key,
        salt: metadata.salt,
        peerId,
      });
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Failed to join room. Please check your room code and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-900">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            MitthiChat
          </h1>
          <p className="text-gray-400">End-to-end encrypted chat</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
          <div className="mb-4">
            <label htmlFor="roomCode" className="block text-sm font-medium text-gray-300 mb-2">
              Room Code
            </label>
            <input
              id="roomCode"
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  if (isCreating) handleCreateRoom();
                  else handleJoinRoom();
                }
              }}
              placeholder="Enter a room code"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isCreating || isJoining}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-200">
              <strong className="font-semibold">Security Notice:</strong> Messages and files are
              end-to-end encrypted. Keep this room code safe — losing it means losing access;
              anyone with the code can view chat history.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCreateRoom}
              disabled={isCreating || isJoining || !roomCode.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </button>
            <button
              onClick={handleJoinRoom}
              disabled={isCreating || isJoining || !roomCode.trim()}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {isJoining ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Generates a deterministic room ID from a room code
 */
async function generateRoomId(roomCode: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(roomCode);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

