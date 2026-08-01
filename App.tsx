
import React, { useState, useEffect } from 'react';
import GlobeViz from './components/GlobeViz';
import ChatInterface from './components/ChatInterface';
import TutorialOverlay from './components/TutorialOverlay';
import { sendMessageToGemini } from './services/geminiService';
import { ChatMessage, LocationMarker } from './types';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [markers, setMarkers] = useState<LocationMarker[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGlobe, setIsGlobe] = useState(true);
  
  // Initialize tutorial state based on local storage
  const [showTutorial, setShowTutorial] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('geoGenesis_tutorial_seen');
    }
    return true;
  });

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('geoGenesis_tutorial_seen', 'true');
  };

  const handleSendMessage = async (text: string) => {
    // Add User Message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Call Gemini
    const response = await sendMessageToGemini(messages.concat(userMsg), text);

    // Update State
    setMessages(prev => [...prev, response]);
    setIsLoading(false);

    // Handle Markers
    if (response.locations && response.locations.length > 0) {
      setMarkers(response.locations);
    }
  };

  const handleCountryClick = (countryName: string) => {
    if (isLoading) return;
    // Ensures we match the requested "Tell me about [countryName]" pattern
    const prompt = `Tell me about ${countryName} and show me 3 notable places to visit there.`;
    handleSendMessage(prompt);
  };

  return (
    <div className="w-screen h-[100dvh] flex flex-col-reverse md:flex-row bg-[#050505] text-white overflow-hidden relative">
      {/* Tutorial Overlay */}
      {showTutorial && (
        <TutorialOverlay onClose={handleCloseTutorial} />
      )}

      {/* Sidebar Chat (Mobile: Bottom Panel / Desktop: Left Panel) */}
      <div className="w-full md:w-[400px] lg:w-[450px] h-[40%] md:h-full z-20 relative flex-shrink-0 border-t md:border-t-0 md:border-r border-zinc-800 bg-zinc-900">
        <ChatInterface 
          messages={messages} 
          onSendMessage={handleSendMessage} 
          isLoading={isLoading} 
        />
      </div>

      {/* Main Visual Area */}
      <div className="flex-1 h-[60%] md:h-full relative flex items-center justify-center p-2 md:p-8 overflow-hidden" style={{background: 'radial-gradient(ellipse at center, #18181b, #000000)'}}>
        <div className="w-full h-full max-w-7xl aspect-auto md:aspect-[2/1] shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden border border-zinc-800">
           <GlobeViz 
             isGlobe={isGlobe} 
             onToggleView={() => setIsGlobe(!isGlobe)}
             onShowHelp={() => setShowTutorial(true)}
             markers={markers}
             onCountryClick={handleCountryClick}
           />
        </div>
      </div>
    </div>
  );
};

export default App;
