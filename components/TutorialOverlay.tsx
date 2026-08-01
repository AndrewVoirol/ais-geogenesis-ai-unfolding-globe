
import React from 'react';

interface TutorialOverlayProps {
    onClose: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onClose }) => {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6" style={{animation: 'fadeIn 0.3s ease-out'}}>
            <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-2xl w-full p-8 shadow-2xl relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10">
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400 mb-2">
                        Welcome to GeoGenesis
                    </h2>
                    <p className="text-zinc-400 mb-8 text-lg">
                        An interactive geospatial AI experience. Here is how to navigate:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="flex items-start space-x-4 p-4 rounded-2xl bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                            <div className="p-3 bg-zinc-800 rounded-xl text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Rotate & Pan</h3>
                                <p className="text-sm text-zinc-500 mt-1">Click and drag the map surface to spin the globe or pan the flat view.</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-4 p-4 rounded-2xl bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                            <div className="p-3 bg-zinc-800 rounded-xl text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Zoom</h3>
                                <p className="text-sm text-zinc-500 mt-1">Use your mouse wheel or pinch gesture to zoom in for details.</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-4 p-4 rounded-2xl bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                            <div className="p-3 bg-zinc-800 rounded-xl text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Unfold World</h3>
                                <p className="text-sm text-zinc-500 mt-1">Click the <span className="text-white font-bold text-xs bg-zinc-700 px-1 rounded">UNFOLD WORLD</span> button to morph between 3D Globe and 2D Map.</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-4 p-4 rounded-2xl bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                            <div className="p-3 bg-zinc-800 rounded-xl text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Explore</h3>
                                <p className="text-sm text-zinc-500 mt-1">Click any country or use voice commands to instantly fly to a location.</p>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={onClose}
                        className="w-full py-4 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl transition-colors shadow-lg text-sm uppercase tracking-widest"
                    >
                        Start Exploring
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TutorialOverlay;
