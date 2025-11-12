/**
 * WebRTC helper functions for peer-to-peer video calls
 * Uses Firestore as signaling transport
 */

import {
  sendSignalingMessage,
  subscribeToSignaling,
  deleteSignalingMessage,
  cleanupSignaling,
} from './firebase';

export interface WebRTCPeer {
  peerConnection: RTCPeerConnection;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  dataChannel: RTCDataChannel | null;
  peerId: string;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/**
 * Creates a new WebRTC peer connection
 * @param roomId - The room ID
 * @param peerId - Unique identifier for this peer
 * @param onRemoteStream - Callback when remote stream is received
 * @param onDataChannel - Callback when data channel is opened
 * @returns Promise<WebRTCPeer>
 */
export async function createPeerConnection(
  roomId: string,
  peerId: string,
  onRemoteStream: (stream: MediaStream) => void,
  onDataChannel?: (channel: RTCDataChannel) => void
): Promise<WebRTCPeer> {
  const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  let localStream: MediaStream | null = null;
  let remoteStream: MediaStream | null = null;
  let dataChannel: RTCDataChannel | null = null;

  // Handle incoming remote stream
  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      remoteStream = event.streams[0];
      onRemoteStream(remoteStream);
    }
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignalingMessage(roomId, 'ice-candidate', event.candidate, peerId).catch(
        console.error
      );
    }
  };

  // Handle data channel
  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    if (onDataChannel) {
      onDataChannel(dataChannel);
    }
  };

  return {
    peerConnection,
    localStream,
    remoteStream,
    dataChannel,
    peerId,
  };
}

/**
 * Gets user media (camera and microphone)
 * @param video - Enable video
 * @param audio - Enable audio
 * @returns Promise<MediaStream>
 */
export async function getUserMedia(
  video: boolean = true,
  audio: boolean = true
): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio });
  } catch (error) {
    console.error('Error accessing media devices:', error);
    throw error;
  }
}

/**
 * Initiates a call by creating an offer
 * @param peer - The WebRTC peer
 * @param roomId - The room ID
 * @param localStream - Local media stream
 * @returns Promise<void>
 */
export async function initiateCall(
  peer: WebRTCPeer,
  roomId: string,
  localStream: MediaStream
): Promise<void> {
  // Add local stream tracks
  localStream.getTracks().forEach((track) => {
    peer.peerConnection.addTrack(track, localStream);
  });

  peer.localStream = localStream;

  // Create data channel for text/file transfer
  const channel = peer.peerConnection.createDataChannel('chat', {
    ordered: true,
  });
  peer.dataChannel = channel;

  // Create and send offer
  const offer = await peer.peerConnection.createOffer();
  await peer.peerConnection.setLocalDescription(offer);

  await sendSignalingMessage(roomId, 'offer', offer, peer.peerId);
}

/**
 * Handles an incoming offer
 * @param peer - The WebRTC peer
 * @param roomId - The room ID
 * @param offer - The RTCSessionDescriptionInit offer
 * @param localStream - Local media stream
 * @returns Promise<void>
 */
export async function handleOffer(
  peer: WebRTCPeer,
  roomId: string,
  offer: RTCSessionDescriptionInit,
  localStream: MediaStream
): Promise<void> {
  // Add local stream tracks
  localStream.getTracks().forEach((track) => {
    peer.peerConnection.addTrack(track, localStream);
  });

  peer.localStream = localStream;

  await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  // Create and send answer
  const answer = await peer.peerConnection.createAnswer();
  await peer.peerConnection.setLocalDescription(answer);

  await sendSignalingMessage(roomId, 'answer', answer, peer.peerId);
}

/**
 * Handles an incoming answer
 * @param peer - The WebRTC peer
 * @param answer - The RTCSessionDescriptionInit answer
 * @returns Promise<void>
 */
export async function handleAnswer(
  peer: WebRTCPeer,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

/**
 * Handles an ICE candidate
 * @param peer - The WebRTC peer
 * @param candidate - The RTCIceCandidateInit candidate
 * @returns Promise<void>
 */
export async function handleIceCandidate(
  peer: WebRTCPeer,
  candidate: RTCIceCandidateInit
): Promise<void> {
  try {
    await peer.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error('Error adding ICE candidate:', error);
  }
}

/**
 * Sets up signaling listener for a peer
 * @param peer - The WebRTC peer
 * @param roomId - The room ID
 * @param onCallEnded - Callback when call is ended
 * @returns Unsubscribe function
 */
export function setupSignalingListener(
  peer: WebRTCPeer,
  roomId: string,
  onCallEnded?: () => void
): () => void {
  return subscribeToSignaling(roomId, peer.peerId, async (signal) => {
    try {
      switch (signal.type) {
        case 'offer':
          // This will be handled by the caller's UI
          break;
        case 'answer':
          await handleAnswer(peer, signal.data);
          break;
        case 'ice-candidate':
          await handleIceCandidate(peer, signal.data);
          break;
        case 'hangup':
          endCall(peer);
          if (onCallEnded) {
            onCallEnded();
          }
          break;
      }
    } catch (error) {
      console.error('Error handling signaling message:', error);
    }
  });
}

/**
 * Ends a call and cleans up resources
 * @param peer - The WebRTC peer
 * @param roomId - Optional room ID to send hangup signal
 */
export async function endCall(peer: WebRTCPeer, roomId?: string): Promise<void> {
  // Stop all tracks
  if (peer.localStream) {
    peer.localStream.getTracks().forEach((track) => track.stop());
  }

  // Close data channel
  if (peer.dataChannel) {
    peer.dataChannel.close();
  }

  // Close peer connection
  peer.peerConnection.close();

  // Send hangup signal if roomId provided
  if (roomId) {
    await sendSignalingMessage(roomId, 'hangup', {}, peer.peerId);
    // Clean up old signaling messages
    await cleanupSignaling(roomId, 0);
  }
}

/**
 * Generates a unique peer ID
 * @returns string
 */
export function generatePeerId(): string {
  return `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}



