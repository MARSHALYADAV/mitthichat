# MitthiChat - Zero-Cost Encrypted Chat

A secure, performant web chat application with end-to-end encryption, hosted on GitHub Pages with Firebase backend. Two anonymous users can join by entering the same room code. All messages and media are encrypted client-side using AES-GCM before being sent to the server.

## Features

- 🔐 **End-to-End Encryption**: All messages and files encrypted client-side with AES-GCM
- 💬 **Real-time Chat**: Instant messaging with encrypted message history
- 📁 **File Sharing**: Encrypted file upload/download with support for images, audio, video, and documents
- 🎥 **Video Calls**: WebRTC peer-to-peer video calls with signaling through Firestore
- 🎤 **In-Browser Recording**: Record and share audio/video messages directly from the browser
- 🌙 **Dark Mode**: Beautiful dark theme with light mode toggle
- 📱 **Responsive Design**: Mobile-first responsive layout
- 🚀 **Zero Cost**: Hosted on GitHub Pages, backend on Firebase free tier

## Tech Stack

- **Frontend**: React + Vite + TypeScript, Tailwind CSS
- **Backend**: Firebase (Firestore + Storage)
- **Crypto**: Web Crypto API (PBKDF2, AES-GCM)
- **WebRTC**: Browser WebRTC API for peer-to-peer video calls
- **Deployment**: GitHub Pages via GitHub Actions

## Security

- **Client-Side Encryption**: All data encrypted before leaving the browser
- **PBKDF2 Key Derivation**: 200,000 iterations for key derivation from room code
- **AES-GCM Encryption**: 256-bit keys with authenticated encryption
- **Verifier Hash**: Optional SHA-256 hash of derived key for quick passphrase verification
- **No Plaintext on Server**: Server never sees unencrypted data

**Important**: Confidentiality relies entirely on client-side encryption. Anyone with the room code can access the room. Keep your room code secure!

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- A Firebase project
- A GitHub account (for deployment)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/mitthichat.git
cd mitthichat
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Firestore Database**:
   - Go to Firestore Database
   - Click "Create database"
   - Start in **test mode** (we'll update rules later)
   - Choose a location
4. Enable **Storage**:
   - Go to Storage
   - Click "Get started"
   - Start in **test mode** (we'll update rules later)
   - Use same location as Firestore
5. Get your Firebase config:
   - Go to Project Settings (gear icon)
   - Scroll to "Your apps"
   - Click the web icon (`</>`)
   - Register app and copy the config values

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

**Note**: These are NOT secrets - they're public client configuration values.

### 5. Set Up Firestore Security Rules

1. Go to Firestore Database → Rules
2. Copy the contents of `firestore.rules` and paste into the rules editor
3. Click "Publish"

The rules allow anonymous read/write access to rooms. This is safe because:
- All data is encrypted client-side
- Only users with the room code can decrypt messages
- The server never sees plaintext

### 6. Set Up Storage Security Rules

1. Go to Storage → Rules
2. Copy the contents of `storage.rules` and paste into the rules editor
3. Click "Publish"

### 7. Local Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Deployment to GitHub Pages

### 1. Create GitHub Repository

1. Create a new repository on GitHub
2. Push your code:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/mitthichat.git
git push -u origin main
```

### 2. Configure GitHub Pages

1. Go to repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: `gh-pages` (will be created automatically)
4. Folder: `/ (root)`

### 3. Set Up GitHub Actions Secrets

1. Go to repository Settings → Secrets and variables → Actions
2. Add the following secrets (use the same values from your `.env.local`):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

### 4. Update Vite Config (if needed)

If your repository name is not `mitthichat`, update the `base` path in `vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  base: '/your-repo-name/', // Update this
  build: {
    outDir: 'dist',
  },
})
```

### 5. Deploy

The GitHub Actions workflow will automatically deploy on push to `main`. You can also trigger it manually:

1. Go to Actions tab
2. Select "Deploy to GitHub Pages"
3. Click "Run workflow"

After deployment, your app will be available at:
`https://yourusername.github.io/mitthichat/`

## Usage

### Creating a Room

1. Enter a room code (passphrase) on the home screen
2. Click "Create Room"
3. Share the room code with the person you want to chat with

### Joining a Room

1. Enter the same room code
2. Click "Join Room"
3. Start chatting!

### Features

- **Send Messages**: Type and press Enter or click Send
- **Share Files**: Click the attachment icon to upload files
- **Record Audio/Video**: Click the microphone icon to record
- **Video Calls**: Click "Start Call" to initiate a video call
- **Message History**: Older messages load automatically, click "Load older messages" for more

## Project Structure

```
mitthichat/
├── src/
│   ├── lib/
│   │   ├── crypto.ts          # Encryption/decryption functions
│   │   ├── firebase.ts        # Firebase operations
│   │   └── webrtc.ts          # WebRTC peer connection management
│   ├── components/
│   │   ├── RoomJoin.tsx       # Room join/create screen
│   │   ├── ChatRoom.tsx       # Main chat interface
│   │   ├── MessageList.tsx    # Message display component
│   │   ├── MessageInput.tsx   # Message input component
│   │   ├── VideoCall.tsx      # Video call component
│   │   └── MediaRecorder.tsx   # Audio/video recording
│   ├── App.tsx                # Main app component
│   ├── main.tsx               # Entry point
│   └── types.ts               # TypeScript types
├── .github/
│   └── workflows/
│       └── deploy.yml         # GitHub Actions deployment
├── firestore.rules            # Firestore security rules
├── storage.rules              # Storage security rules
└── README.md                  # This file
```

## Security Considerations

### Limitations

1. **Room Code Security**: Anyone with the room code can access the room. The room code acts as the encryption key.
2. **No Authentication**: The app uses anonymous access. There's no user authentication.
3. **Client-Side Only**: All security relies on client-side encryption. A compromised client could expose data.
4. **Verifier Hash**: The optional verifier hash helps detect wrong passphrases but doesn't prevent brute force if the hash is known.

### Best Practices

- Use strong, unique room codes
- Don't share room codes publicly
- Clear browser data when done
- Be cautious on untrusted devices
- The server cannot validate encryption - trust is in the client

## Testing

### Unit Tests

```bash
npm test
```

Tests are located in `src/__tests__/` and cover:
- Crypto functions (encryption/decryption round-trips)
- Key derivation
- File encryption/decryption

### Manual Testing

1. Open the app in two different browsers (or incognito windows)
2. Create/join the same room in both
3. Send messages and verify they appear in both
4. Upload a file and verify it can be downloaded and decrypted
5. Start a video call and verify both peers see each other

## Troubleshooting

### Firebase Errors

- **Permission Denied**: Check Firestore and Storage rules are published
- **Config Errors**: Verify `.env.local` has all required variables
- **CORS Issues**: Ensure Firebase project allows your domain

### WebRTC Issues

- **No Video/Audio**: Check browser permissions for camera/microphone
- **Connection Failed**: Check firewall/NAT settings (STUN servers may not be enough)
- **Signaling Errors**: Verify Firestore rules allow signaling collection access

### Build/Deploy Issues

- **Build Fails**: Check all environment variables are set in GitHub Secrets
- **404 on Pages**: Verify `base` path in `vite.config.ts` matches repository name
- **Assets Not Loading**: Check GitHub Pages is enabled and using correct branch

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions welcome! Please open an issue or pull request.

## Demo

Live demo: [https://yourusername.github.io/mitthichat/](https://yourusername.github.io/mitthichat/)

## Support

For issues and questions, please open an issue on GitHub.



