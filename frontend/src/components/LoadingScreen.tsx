'use client';

import { useEffect, useState } from 'react';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingScreen({ 
  message = "Loading", 
  fullScreen = true 
}: LoadingScreenProps) {
  const [dots, setDots] = useState('');
  const [dataPackets, setDataPackets] = useState<number[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 800);

    return () => clearInterval(interval);
  }, []);

  // Data packets animation
  useEffect(() => {
    const packetInterval = setInterval(() => {
      setDataPackets(prev => {
        const newPackets = [...prev, Date.now()];
        return newPackets.slice(-6); // Keep only last 6 packets
      });
    }, 600);

    return () => clearInterval(packetInterval);
  }, []);

  const containerClass = fullScreen 
    ? "fixed inset-0 bg-gradient-to-r from-slate-900 via-gray-800 to-slate-900 flex z-50"
    : "flex h-96";

  return (
    <div className={containerClass}>
      <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
          {/* Background Effects */}
          <div className="absolute inset-0">
            {/* Grid Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="grid grid-cols-12 grid-rows-12 h-full w-full">
                {[...Array(144)].map((_, i) => (
                  <div key={i} className="border border-blue-400/20"></div>
                ))}
              </div>
            </div>
            
            {/* Floating Orbs */}
            {[...Array(6)].map((_, i) => {
              // Generate deterministic positions to avoid hydration mismatch
              const seed = i * 12345 + 67890;
              const left = ((seed % 8000) / 100);
              const top = (((seed * 7) % 8000) / 100);
              
              return (
                <div
                  key={i}
                  className="absolute w-32 h-32 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full blur-xl animate-float-slow"
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    animationDelay: `${i * 1.5}s`,
                    animationDuration: `${8 + i}s`
                  }}
                ></div>
              );
            })}
          </div>

          <div className="relative z-10 text-center w-full px-8">
            {/* Main Loading Text */}
            <div className="mt-16 mb-12">
              <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-pulse mb-4" style={{ animationDuration: '2.5s' }}>
                {message}
              </div>
              <div className="text-2xl text-blue-300 font-mono">
                <span className="inline-block animate-bounce" style={{ animationDuration: '1.5s' }}>{dots}</span>
              </div>
            </div>

            {/* Central Data Hub */}
            <div className="relative w-full max-w-lg mx-auto h-80 mb-8">
              {/* Central Node */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-2xl animate-pulse">
                <div className="absolute inset-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full">
                  <div className="absolute inset-2 bg-gradient-to-r from-blue-300 to-purple-400 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 bg-white rounded-full animate-ping"></div>
                  </div>
                </div>
              </div>

              {/* Orbiting Data Nodes */}
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full shadow-lg animate-orbit"
                  style={{
                    left: '50%',
                    top: '50%',
                    transformOrigin: '0 0',
                    animationDelay: `${i * 0.5}s`,
                    animationDuration: '8s',
                    transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateX(120px) rotate(-${i * 45}deg)`
                  }}
                >
                  <div className="absolute inset-1 bg-gradient-to-r from-green-300 to-blue-400 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              ))}

              {/* Connection Lines */}
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="absolute top-1/2 left-1/2 w-32 h-px bg-gradient-to-r from-blue-500/50 to-transparent animate-pulse"
                  style={{
                    transformOrigin: '0 0',
                    transform: `translate(-50%, -50%) rotate(${i * 45}deg)`,
                    animationDelay: `${i * 0.3}s`,
                    animationDuration: '3s'
                  }}
                ></div>
              ))}

              {/* Data Packets */}
              <div className="absolute inset-0">
                {dataPackets.map((packet, index) => (
                  <div
                    key={packet}
                    className="absolute w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-data-travel shadow-lg"
                    style={{
                      left: '50%',
                      top: '50%',
                      animationDelay: `${index * 0.4}s`,
                      animationDuration: '4s'
                    }}
                  ></div>
                ))}
              </div>
            </div>

            {/* Progress Section */}
            <div className="space-y-6">
              {/* Main Progress Bar */}
              <div className="w-full max-w-md mx-auto">
                <div className="flex justify-between text-sm text-blue-300 mb-2">
                  <span>Progress</span>
                  <span>Loading...</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full animate-progress shadow-lg"></div>
                </div>
              </div>

              {/* Status Indicators */}
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                {/* Connected Status */}
                <div className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    {/* Outer glow ring */}
                    <div className="absolute inset-0 bg-green-400/30 rounded-full animate-ping"></div>
                    <div className="absolute inset-1 bg-green-400/20 rounded-full animate-pulse" style={{ animationDuration: '2s' }}></div>
                    
                    {/* Circular dots around the ball */}
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-1 h-1 bg-green-300 rounded-full animate-orbit-dots"
                        style={{
                          left: '50%',
                          top: '50%',
                          transformOrigin: '0 0',
                          animationDelay: `${i * 0.2}s`,
                          animationDuration: '3s',
                          transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateX(28px) rotate(-${i * 45}deg)`
                        }}
                      ></div>
                    ))}
                    
                    {/* Main ball with light effect */}
                    <div className="absolute inset-3 bg-gradient-to-r from-green-400 to-green-600 rounded-full shadow-lg animate-pulse">
                      <div className="absolute inset-1 bg-gradient-to-r from-green-300 to-green-500 rounded-full">
                        <div className="absolute inset-1 bg-gradient-to-br from-green-200 to-green-400 rounded-full">
                          {/* Light reflection */}
                          <div className="absolute top-1 left-1 w-2 h-2 bg-white/60 rounded-full blur-sm"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-green-300 font-medium">Connected</div>
                </div>

                {/* Processing Status */}
                <div className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    {/* Outer glow ring */}
                    <div className="absolute inset-0 bg-yellow-400/30 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                    <div className="absolute inset-1 bg-yellow-400/20 rounded-full animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}></div>
                    
                    {/* Circular dots around the ball */}
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-1 h-1 bg-yellow-300 rounded-full animate-orbit-dots"
                        style={{
                          left: '50%',
                          top: '50%',
                          transformOrigin: '0 0',
                          animationDelay: `${0.5 + i * 0.2}s`,
                          animationDuration: '3.5s',
                          transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateX(28px) rotate(-${i * 45}deg)`
                        }}
                      ></div>
                    ))}
                    
                    {/* Main ball with light effect */}
                    <div className="absolute inset-3 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full shadow-lg animate-pulse" style={{ animationDelay: '0.5s' }}>
                      <div className="absolute inset-1 bg-gradient-to-r from-yellow-300 to-yellow-500 rounded-full">
                        <div className="absolute inset-1 bg-gradient-to-br from-yellow-200 to-yellow-400 rounded-full">
                          {/* Light reflection */}
                          <div className="absolute top-1 left-1 w-2 h-2 bg-white/60 rounded-full blur-sm"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-yellow-300 font-medium">Processing</div>
                </div>

                {/* Syncing Status */}
                <div className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    {/* Outer glow ring */}
                    <div className="absolute inset-0 bg-blue-400/30 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
                    <div className="absolute inset-1 bg-blue-400/20 rounded-full animate-pulse" style={{ animationDuration: '3s', animationDelay: '1s' }}></div>
                    
                    {/* Circular dots around the ball */}
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-1 h-1 bg-blue-300 rounded-full animate-orbit-dots"
                        style={{
                          left: '50%',
                          top: '50%',
                          transformOrigin: '0 0',
                          animationDelay: `${1 + i * 0.2}s`,
                          animationDuration: '4s',
                          transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateX(28px) rotate(-${i * 45}deg)`
                        }}
                      ></div>
                    ))}
                    
                    {/* Main ball with light effect */}
                    <div className="absolute inset-3 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full shadow-lg animate-pulse" style={{ animationDelay: '1s' }}>
                      <div className="absolute inset-1 bg-gradient-to-r from-blue-300 to-blue-500 rounded-full">
                        <div className="absolute inset-1 bg-gradient-to-br from-blue-200 to-blue-400 rounded-full">
                          {/* Light reflection */}
                          <div className="absolute top-1 left-1 w-2 h-2 bg-white/60 rounded-full blur-sm"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-blue-300 font-medium">Syncing</div>
                </div>
              </div>

              {/* Status Messages */}
              <div className="overflow-hidden h-8">
                <div className="animate-flip-words">
                  <div className="text-lg text-blue-200 font-medium">Initializing connection...</div>
                  <div className="text-lg text-purple-200 font-medium">Authenticating user...</div>
                  <div className="text-lg text-pink-200 font-medium">Fetching your data...</div>
                  <div className="text-lg text-green-200 font-medium">Almost ready...</div>
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* Custom CSS Animations */}
      <style jsx>{`
        @keyframes flip-words {
          0%, 20% { transform: translateY(0); }
          25%, 45% { transform: translateY(-100%); }
          50%, 70% { transform: translateY(-200%); }
          75%, 95% { transform: translateY(-300%); }
          100% { transform: translateY(-400%); }
        }
        
        @keyframes progress {
          0% { width: 0%; }
          30% { width: 30%; }
          60% { width: 60%; }
          100% { width: 100%; }
        }
        
        @keyframes data-flow {
          0% { 
            left: 20px; 
            top: 20px; 
            opacity: 0;
            transform: scale(0.5);
          }
          10% { 
            opacity: 1;
            transform: scale(1);
          }
          90% { 
            left: 260px; 
            top: 20px; 
            opacity: 1;
            transform: scale(1);
          }
          100% { 
            left: 260px; 
            top: 20px; 
            opacity: 0;
            transform: scale(0.5);
          }
        }
        
        @keyframes data-stream {
          0% { opacity: 0; transform: translateX(-100%); }
          50% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(100%); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          33% { transform: translateY(-20px) translateX(10px); }
          66% { transform: translateY(10px) translateX(-10px); }
        }
        

        
        @keyframes orbit {
          0% { transform: translate(-50%, -50%) rotate(0deg) translateX(120px) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg) translateX(120px) rotate(-360deg); }
        }
        
        @keyframes data-travel {
          0% { 
            transform: translate(-50%, -50%) rotate(0deg) translateX(0px);
            opacity: 0;
            scale: 0.5;
          }
          10% { 
            opacity: 1;
            scale: 1;
          }
          90% { 
            transform: translate(-50%, -50%) rotate(360deg) translateX(100px);
            opacity: 1;
            scale: 1;
          }
          100% { 
            transform: translate(-50%, -50%) rotate(360deg) translateX(100px);
            opacity: 0;
            scale: 0.5;
          }
        }
        
        .animate-flip-words {
          animation: flip-words 8s infinite;
        }
        
        .animate-progress {
          animation: progress 6s ease-in-out infinite;
        }
        
        .animate-data-flow {
          animation: data-flow 3s ease-in-out infinite;
        }
        
        .animate-data-stream {
          animation: data-stream 2s ease-in-out infinite;
        }
        
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        

        
        .animate-orbit {
          animation: orbit 8s linear infinite;
        }
        
        .animate-data-travel {
          animation: data-travel 4s ease-in-out infinite;
        }
        
        .animate-orbit-dots {
          animation: orbit-dots 3s linear infinite;
        }
        
        @keyframes orbit-dots {
          0% { 
            transform: translate(-50%, -50%) rotate(0deg) translateX(28px) rotate(0deg);
            opacity: 0.4;
          }
          50% { 
            opacity: 1;
          }
          100% { 
            transform: translate(-50%, -50%) rotate(360deg) translateX(28px) rotate(-360deg);
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}