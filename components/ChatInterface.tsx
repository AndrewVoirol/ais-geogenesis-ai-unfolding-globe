
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface ChatInterfaceProps {
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
    isLoading: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading }) => {
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initialize Speech Recognition
    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onstart = () => {
                setIsListening(true);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(prev => prev ? `${prev} ${transcript}` : transcript);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Voice input is not supported in this browser.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        onSendMessage(input);
        setInput('');
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900/80 backdrop-blur-md shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-zinc-800">
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
                    GeoGenesis
                </h1>
                <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">AI Powered Cartography</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                {messages.length === 0 && (
                    <div className="text-center text-zinc-600 mt-10 px-4">
                        <p className="text-sm">Ask about places, landmarks, or geography.</p>
                        <p className="text-xs mt-2 italic">"Show me the 3 highest peaks in the Andes."</p>
                        <p className="text-xs mt-1 italic">"Find top rated coffee shops in Tokyo."</p>
                    </div>
                )}
                
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                            msg.role === 'user' 
                                ? 'bg-white text-black rounded-br-none' 
                                : 'bg-zinc-800 text-zinc-200 rounded-bl-none'
                        }`}>
                            {msg.text}
                        </div>
                        
                        {/* Grounding Chips */}
                        {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2 max-w-[85%] justify-start">
                                {msg.groundingUrls.map((url, i) => (
                                    <a 
                                        key={i} 
                                        href={url.uri} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className={`flex items-center px-2 py-1 border rounded-md text-[10px] transition-colors ${
                                            url.sourceType === 'map'
                                                ? 'bg-emerald-950/30 border-emerald-900 text-emerald-400 hover:bg-emerald-900/50'
                                                : 'bg-blue-950/30 border-blue-900 text-blue-400 hover:bg-blue-900/50'
                                        }`}
                                    >
                                        {url.sourceType === 'map' ? (
                                            // Map Pin Icon
                                            <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                                        ) : (
                                            // Google/Web Icon
                                            <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                                        )}
                                        {url.title.length > 25 ? url.title.substring(0, 25) + '...' : url.title}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex items-start">
                         <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-bl-none flex space-x-1">
                             <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                             <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                             <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                         </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900">
                <form onSubmit={handleSubmit} className="relative flex items-center">
                    {/* Mic Button */}
                    <button 
                        type="button"
                        onClick={toggleListening}
                        className={`mr-2 p-3 rounded-xl transition-all ${
                            isListening 
                                ? 'bg-red-500/20 text-red-500 mic-active' 
                                : 'bg-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                        title="Voice Command"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                    </button>

                    <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isListening ? "Listening..." : "Where should we go?"}
                        className="flex-1 bg-zinc-950 border border-zinc-700 text-white text-base px-4 py-3 rounded-xl pr-12 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all placeholder-zinc-600"
                        disabled={isLoading}
                    />
                    <button 
                        type="submit" 
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2 top-2 bottom-2 p-2 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatInterface;
