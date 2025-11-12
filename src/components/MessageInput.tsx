import { useState, useRef } from 'react';
import { RoomState } from '../types';
import MediaRecorder from './MediaRecorder';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  onSendFile: (file: File) => void;
  roomState: RoomState;
}

export default function MessageInput({ onSendMessage, onSendFile, roomState }: MessageInputProps) {
  const [input, setInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendFile(file);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="bg-gray-800 border-t border-gray-700 p-4">
      <form onSubmit={handleSubmit} className="flex items-end space-x-2">
        <div className="flex-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,audio/*,video/*,*/*"
        />
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          aria-label="Attach file"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <MediaRecorder roomState={roomState} onSendFile={onSendFile} />

        <button
          type="submit"
          disabled={!input.trim()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}



