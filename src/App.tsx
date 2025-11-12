import { useState, useEffect } from 'react';
import RoomJoin from './components/RoomJoin';
import ChatRoom from './components/ChatRoom';
import { RoomState } from './types';

function App() {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    // Check for saved dark mode preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      setDarkMode(saved === 'true');
    }
  }, []);

  useEffect(() => {
    // Apply dark mode class
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  const handleJoinRoom = (state: RoomState) => {
    setRoomState(state);
  };

  const handleLeaveRoom = () => {
    setRoomState(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 transition-colors">
      {!roomState ? (
        <RoomJoin onJoin={handleJoinRoom} />
      ) : (
        <ChatRoom roomState={roomState} onLeave={handleLeaveRoom} />
      )}
      
      {/* Dark mode toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="fixed bottom-4 right-4 p-3 bg-gray-800 hover:bg-gray-700 rounded-full shadow-lg transition-colors"
        aria-label="Toggle dark mode"
      >
        {darkMode ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default App;



