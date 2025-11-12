import { useState } from 'react';
import { DecryptedMessage, RoomState } from '../types';
import { decryptFileStream } from '../lib/crypto';
import { downloadEncryptedFile } from '../lib/firebase';

interface MessageListProps {
  messages: DecryptedMessage[];
  roomState: RoomState;
  onDownloadMedia: (message: DecryptedMessage) => void;
}

export default function MessageList({ messages, roomState, onDownloadMedia }: MessageListProps) {
  const [decryptingMedia, setDecryptingMedia] = useState<Set<string>>(new Set());
  const [mediaUrls, setMediaUrls] = useState<Map<string, string>>(new Map());

  const handleViewMedia = async (message: DecryptedMessage) => {
    if (!message.mediaUrl || !message.mediaIv || mediaUrls.has(message.id)) return;

    try {
      setDecryptingMedia((prev) => new Set(prev).add(message.id));
      
      // Download encrypted file
      const encryptedBlob = await downloadEncryptedFile(message.mediaUrl);
      
      // Decrypt using stored IV
      const decryptedBlob = await decryptFileStream(encryptedBlob, message.mediaIv, roomState.key);
      const url = URL.createObjectURL(decryptedBlob);
      setMediaUrls((prev) => new Map(prev).set(message.id, url));
    } catch (error) {
      console.error('Error viewing media:', error);
      alert('Failed to load media. Please try again.');
    } finally {
      setDecryptingMedia((prev) => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div key={message.id} className="flex flex-col space-y-1">
          <div className="flex items-start space-x-3">
            <div className="flex-1 bg-gray-800 rounded-lg p-3 max-w-[80%]">
              {message.contentType === 'text' && (
                <p className="text-gray-100 whitespace-pre-wrap break-words">{message.content}</p>
              )}
              
              {message.contentType === 'image' && (
                <div>
                  {mediaUrls.has(message.id) ? (
                    <img
                      src={mediaUrls.get(message.id)}
                      alt="Shared image"
                      className="max-w-full rounded-lg"
                    />
                  ) : (
                    <button
                      onClick={() => handleViewMedia(message)}
                      disabled={decryptingMedia.has(message.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm disabled:opacity-50"
                    >
                      {decryptingMedia.has(message.id) ? 'Decrypting...' : 'View Image'}
                    </button>
                  )}
                </div>
              )}
              
              {message.contentType === 'audio' && (
                <div>
                  {mediaUrls.has(message.id) ? (
                    <audio controls src={mediaUrls.get(message.id)} className="w-full" />
                  ) : (
                    <button
                      onClick={() => handleViewMedia(message)}
                      disabled={decryptingMedia.has(message.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm disabled:opacity-50"
                    >
                      {decryptingMedia.has(message.id) ? 'Decrypting...' : 'Play Audio'}
                    </button>
                  )}
                </div>
              )}
              
              {message.contentType === 'video' && (
                <div>
                  {mediaUrls.has(message.id) ? (
                    <video controls src={mediaUrls.get(message.id)} className="max-w-full rounded-lg" />
                  ) : (
                    <button
                      onClick={() => handleViewMedia(message)}
                      disabled={decryptingMedia.has(message.id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm disabled:opacity-50"
                    >
                      {decryptingMedia.has(message.id) ? 'Decrypting...' : 'Play Video'}
                    </button>
                  )}
                </div>
              )}
              
              {message.contentType === 'file' && (
                <div className="flex items-center space-x-2">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-gray-100">{message.fileName || 'File'}</p>
                    {message.fileSize && (
                      <p className="text-xs text-gray-400">
                        {(message.fileSize / 1024).toFixed(2)} KB
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onDownloadMedia(message)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    Download
                  </button>
                </div>
              )}
              
              <p className="text-xs text-gray-400 mt-2">{formatTime(message.timestamp)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

