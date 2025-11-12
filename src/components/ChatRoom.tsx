import { useState, useEffect, useRef } from 'react';
import { RoomState, DecryptedMessage } from '../types';
import { decryptString, decryptFileStream } from '../lib/crypto';
import {
  getMessages,
  sendMessage,
  subscribeToMessages,
  uploadEncryptedFile,
  downloadEncryptedFile,
} from '../lib/firebase';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import VideoCall from './VideoCall';
import MediaRecorder from './MediaRecorder';

interface ChatRoomProps {
  roomState: RoomState;
  onLeave: () => void;
}

export default function ChatRoom({ roomState, onLeave }: ChatRoomProps) {
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isInCall, setIsInCall] = useState(false);

  // Load initial messages
  useEffect(() => {
    loadMessages();
  }, []);

  // Subscribe to new messages
  useEffect(() => {
    const unsubscribe = subscribeToMessages(roomState.roomId, async (encryptedMsg) => {
      try {
        const decrypted = await decryptMessage(encryptedMsg);
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === encryptedMsg.id)) {
            return prev;
          }
          return [...prev, decrypted];
        });
      } catch (error) {
        console.error('Error decrypting message:', error);
      }
    });

    return () => unsubscribe();
  }, [roomState]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const { messages: newMessages, lastDoc } = await getMessages(roomState.roomId);
      
      const decrypted = await Promise.all(
        newMessages.map((msg) => decryptMessage({ ...msg, id: '' }))
      );

      setMessages(decrypted);
      lastDocRef.current = lastDoc;
      setHasMore(newMessages.length === 50);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const { messages: newMessages, lastDoc } = await getMessages(
        roomState.roomId,
        50,
        lastDocRef.current
      );

      if (newMessages.length === 0) {
        setHasMore(false);
        return;
      }

      const decrypted = await Promise.all(
        newMessages.map((msg) => decryptMessage({ ...msg, id: '' }))
      );

      setMessages((prev) => [...decrypted, ...prev]);
      lastDocRef.current = lastDoc;
      setHasMore(newMessages.length === 50);
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const decryptMessage = async (encryptedMsg: any): Promise<DecryptedMessage> => {
    try {
      let content = '';
      if (encryptedMsg.ciphertext) {
        content = await decryptString(
          encryptedMsg.ciphertext,
          encryptedMsg.iv,
          roomState.key
        );
      }

      let mediaUrl: string | undefined;
      let fileName: string | undefined;
      let mimeType: string | undefined;
      
      if (encryptedMsg.mediaMeta?.storagePath) {
        mediaUrl = encryptedMsg.mediaMeta.storagePath;
        
        // Decrypt filename and mimeType if they exist
        if (encryptedMsg.mediaMeta.fileName && encryptedMsg.mediaMeta.fileNameIv) {
          try {
            fileName = await decryptString(
              encryptedMsg.mediaMeta.fileName,
              encryptedMsg.mediaMeta.fileNameIv,
              roomState.key
            );
          } catch (e) {
            console.warn('Failed to decrypt filename:', e);
            fileName = 'encrypted-file';
          }
        }
        
        if (encryptedMsg.mediaMeta.mimeType && encryptedMsg.mediaMeta.mimeTypeIv) {
          try {
            mimeType = await decryptString(
              encryptedMsg.mediaMeta.mimeType,
              encryptedMsg.mediaMeta.mimeTypeIv,
              roomState.key
            );
          } catch (e) {
            console.warn('Failed to decrypt mimeType:', e);
          }
        }
      }

      return {
        id: encryptedMsg.id || '',
        content,
        timestamp: encryptedMsg.timestamp.toDate(),
        contentType: encryptedMsg.contentType,
        mediaUrl,
        mediaIv: encryptedMsg.mediaMeta?.mediaIv || encryptedMsg.iv,
        fileName,
        fileSize: encryptedMsg.mediaMeta?.fileSize,
        mimeType,
      };
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    try {
      const { encryptString } = await import('../lib/crypto');
      const { ciphertext, iv } = await encryptString(text, roomState.key);

      await sendMessage(roomState.roomId, {
        ciphertext,
        iv,
        contentType: 'text',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const handleSendFile = async (file: File) => {
    try {
      const { encryptFileStream } = await import('../lib/crypto');
      const { encryptedBlob, iv } = await encryptFileStream(file, roomState.key);

      const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const storagePath = await uploadEncryptedFile(roomState.roomId, fileId, encryptedBlob);

      // Encrypt filename and metadata
      const { encryptString } = await import('../lib/crypto');
      const encryptedFileName = await encryptString(file.name, roomState.key);
      const encryptedMimeType = await encryptString(file.type || 'application/octet-stream', roomState.key);

      await sendMessage(roomState.roomId, {
        ciphertext: '', // No text content for file messages
        iv: iv,
        contentType: file.type.startsWith('image/') ? 'image' : 
                     file.type.startsWith('audio/') ? 'audio' : 
                     file.type.startsWith('video/') ? 'video' : 'file',
        mediaMeta: {
          storagePath,
          fileName: encryptedFileName.ciphertext,
          fileNameIv: encryptedFileName.iv,
          fileSize: file.size,
          mimeType: encryptedMimeType.ciphertext,
          mimeTypeIv: encryptedMimeType.iv,
          mediaIv: iv, // Store IV for media decryption
        },
      });
    } catch (error) {
      console.error('Error sending file:', error);
      alert('Failed to send file. Please try again.');
    }
  };

  const handleDownloadMedia = async (message: DecryptedMessage) => {
    if (!message.mediaUrl || !message.mediaIv) return;

    try {
      const encryptedBlob = await downloadEncryptedFile(message.mediaUrl);
      const decryptedBlob = await decryptFileStream(encryptedBlob, message.mediaIv, roomState.key);
      
      // Create download link
      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = message.fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading media:', error);
      alert('Failed to download media.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Room: {roomState.roomId.substring(0, 8)}...</h2>
          <p className="text-xs text-gray-400">End-to-end encrypted</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsInCall(!isInCall)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            {isInCall ? 'End Call' : 'Start Call'}
          </button>
          <button
            onClick={onLeave}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Video Call Panel */}
      {isInCall && (
        <VideoCall roomState={roomState} onEndCall={() => setIsInCall(false)} />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400">Loading messages...</p>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="p-2 text-center">
                <button
                  onClick={loadMoreMessages}
                  disabled={loadingMore}
                  className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-500"
                >
                  {loadingMore ? 'Loading...' : 'Load older messages'}
                </button>
              </div>
            )}
            <MessageList
              messages={messages}
              roomState={roomState}
              onDownloadMedia={handleDownloadMedia}
            />
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        roomState={roomState}
      />
    </div>
  );
}

