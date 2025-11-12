import { useState, useRef, useEffect } from 'react';
import { RoomState } from '../types';
import { encryptFileStream } from '../lib/crypto';
import { uploadEncryptedFile, sendMessage } from '../lib/firebase';

interface MediaRecorderProps {
  roomState: RoomState;
  onSendFile: (file: File) => void;
}

export default function MediaRecorder({ roomState, onSendFile }: MediaRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState<'audio' | 'video' | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [previewStream]);

  const startRecording = async (type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });

      setPreviewStream(stream);
      setRecordingType(type);
      setIsRecording(true);

      if (videoRef.current && type === 'video') {
        videoRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: type === 'audio' ? 'audio/webm' : 'video/webm',
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: type === 'audio' ? 'audio/webm' : 'video/webm',
        });

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        setPreviewStream(null);

        // Create a File from the blob
        const file = new File([blob], `recording.${type === 'audio' ? 'webm' : 'webm'}`, {
          type: blob.type,
        });

        // Encrypt and upload
        try {
          const { encryptedBlob, iv } = await encryptFileStream(file, roomState.key);
          const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const storagePath = await uploadEncryptedFile(roomState.roomId, fileId, encryptedBlob);

          const { encryptString } = await import('../lib/crypto');
          const encryptedFileName = await encryptString(file.name, roomState.key);
          const encryptedMimeType = await encryptString(file.type, roomState.key);

          await sendMessage(roomState.roomId, {
            ciphertext: '',
            iv: iv,
            contentType: type,
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
          console.error('Error uploading recording:', error);
          alert('Failed to upload recording.');
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to access media devices. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingType(null);
    }
  };

  if (isRecording) {
    return (
      <div className="relative">
        <button
          onClick={stopRecording}
          className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          aria-label="Stop recording"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
        {recordingType === 'video' && (
          <div className="absolute bottom-full mb-2 right-0 w-64 h-48 bg-gray-900 rounded-lg overflow-hidden border-2 border-red-500">
            <video ref={videoRef} autoPlay muted className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={() => startRecording('audio')}
        className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        aria-label="Record audio"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </button>
      <div className="absolute bottom-full mb-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-gray-800 rounded-lg p-2 text-xs whitespace-nowrap">
          <button
            onClick={() => startRecording('audio')}
            className="block w-full text-left px-2 py-1 hover:bg-gray-700 rounded"
          >
            Record Audio
          </button>
          <button
            onClick={() => startRecording('video')}
            className="block w-full text-left px-2 py-1 hover:bg-gray-700 rounded"
          >
            Record Video
          </button>
        </div>
      </div>
    </div>
  );
}

