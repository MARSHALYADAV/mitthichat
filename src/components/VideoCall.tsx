import { useState, useEffect, useRef } from 'react';
import { RoomState } from '../types';
import {
  createPeerConnection,
  getUserMedia,
  initiateCall,
  handleOffer,
  setupSignalingListener,
  endCall,
  WebRTCPeer,
} from '../lib/webrtc';
import { subscribeToSignaling } from '../lib/firebase';

interface VideoCallProps {
  roomState: RoomState;
  onEndCall: () => void;
}

export default function VideoCall({ roomState, onEndCall }: VideoCallProps) {
  const [peer, setPeer] = useState<WebRTCPeer | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const signalingUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    initializeCall();

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const initializeCall = async () => {
    try {
      // Get user media
      const stream = await getUserMedia(true, true);
      setLocalStream(stream);

      // Create peer connection
      const newPeer = await createPeerConnection(
        roomState.roomId,
        roomState.peerId,
        (stream) => {
          setRemoteStream(stream);
          setIsCallActive(true);
        }
      );

      setPeer(newPeer);

      // Set up signaling listener
      const unsubscribe = setupSignalingListener(newPeer, roomState.roomId, () => {
        handleEndCall();
      });
      
      // Also listen for offers specifically (setupSignalingListener doesn't handle offers)
      const firebaseUnsubscribe = subscribeToSignaling(roomState.roomId, roomState.peerId, async (signal) => {
        if (signal.type === 'offer' && newPeer) {
          await handleOffer(newPeer, roomState.roomId, signal.data, stream);
        }
      });
      
      signalingUnsubscribeRef.current = () => {
        unsubscribe();
        firebaseUnsubscribe();
      };

      // Initiate call
      await initiateCall(newPeer, roomState.roomId, stream);
    } catch (error) {
      console.error('Error initializing call:', error);
      alert('Failed to start call. Please check permissions.');
      onEndCall();
    }
  };

  const handleEndCall = async () => {
    cleanup();
    onEndCall();
  };

  const cleanup = async () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peer) {
      await endCall(peer, roomState.roomId);
    }
    if (signalingUnsubscribeRef.current) {
      signalingUnsubscribeRef.current();
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-100">
          {isCallActive ? 'Call Active' : 'Connecting...'}
        </h3>
        <button
          onClick={handleEndCall}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
        >
          End Call
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Local Video */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
            You
          </div>
        </div>

        {/* Remote Video */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Waiting for peer...
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white">
            Peer
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={toggleMute}
          className={`p-3 rounded-full transition-colors ${
            isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMuted ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            )}
          </svg>
        </button>

        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full transition-colors ${
            isVideoOff ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          aria-label={isVideoOff ? 'Turn on video' : 'Turn off video'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isVideoOff ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}

