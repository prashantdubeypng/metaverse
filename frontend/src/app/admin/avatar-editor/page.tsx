'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ProtectedRoute from '@/components/ProtectedRoute';
import { clearTokenData, getTokenData } from '@/utils/auth';
import { ENV } from '@/CONFIG/env.config';

export default function AvatarEditorPage() {
  const [avatarName, setAvatarName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [fileType, setFileType] = useState<'image' | '3d' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const router = useRouter();

  const handleUrlChange = (url: string) => {
    setAvatarUrl(url);
    setError('');
    
    if (url.trim()) {
      // Detect file type from URL
      const urlLower = url.toLowerCase();
      const supportedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const supported3DTypes = ['.obj', '.glb', '.gltf'];
      
      let type: 'image' | '3d' | null = null;
      
      if (supportedImageTypes.some(ext => urlLower.includes(ext))) {
        type = 'image';
      } else if (supported3DTypes.some(ext => urlLower.includes(ext))) {
        type = '3d';
      } else {
        // Default to image if we can't detect
        type = 'image';
      }
      
      setFileType(type);
    } else {
      setFileType(null);
    }
  };



  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!avatarName.trim()) {
      setError('Please enter an avatar name');
      return;
    }

    if (!avatarUrl.trim()) {
      setError('Please enter an avatar URL');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        clearTokenData();
        router.push('/login');
        return;
      }

      const response = await fetch(`${ENV.API_URL}/admin/avatar/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: avatarName,
          imageurl: avatarUrl
        }),
      });

      if (response.status === 401) {
        clearTokenData();
        router.push('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await response.json();
      setSuccess('Avatar created successfully!');
      
      // Reset form
      setAvatarName('');
      setAvatarUrl('');
      setFileType(null);

      // Redirect after success
      setTimeout(() => {
        router.push('/admin');
      }, 2000);

    } catch (err) {
      console.error('Error creating avatar:', err);
      setError(err instanceof Error ? err.message : 'Failed to create avatar');
    } finally {
      setIsUploading(false);
    }
  };



  return (
    <ProtectedRoute requiredRole="Admin">
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-purple-200/50 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/admin')}
                  className="text-purple-600 hover:text-purple-800 transition-colors p-2 rounded-full hover:bg-purple-100"
                  title="Back to Admin Panel"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    Avatar Creator
                  </h1>
                  <p className="text-sm text-gray-600">Create new 3D avatars for your metaverse</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Avatar Name Input */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-200/50 p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <svg className="w-6 h-6 mr-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Avatar Details
              </h2>
              
              <div>
                <label htmlFor="avatarName" className="block text-sm font-medium text-gray-700 mb-2">
                  Avatar Name
                </label>
                <input
                  type="text"
                  id="avatarName"
                  value={avatarName}
                  onChange={(e) => setAvatarName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white/80"
                  placeholder="Enter a name for your avatar..."
                  required
                />
              </div>

              <div>
                <label htmlFor="avatarUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  Avatar URL
                </label>
                <input
                  type="url"
                  id="avatarUrl"
                  value={avatarUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white/80"
                  placeholder="https://example.com/avatar.png or https://example.com/model.glb"
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  Supports: Image URLs (JPG, PNG, GIF, WebP) | 3D Model URLs (OBJ, GLB, GLTF)
                </p>
              </div>
            </div>

            {/* URL Preview Section */}
            {avatarUrl && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-200/50 p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <svg className="w-6 h-6 mr-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Avatar Preview
                </h2>

                <div className="text-center space-y-4">
                  <div className="relative inline-block">
                    {fileType === 'image' ? (
                      <Image
                        src={avatarUrl}
                        alt="Avatar Preview"
                        width={128}
                        height={128}
                        className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg mx-auto"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-lg relative overflow-hidden">
                        <div className="text-white text-center">
                          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <p className="text-xs font-bold">3D</p>
                        </div>
                        {[...Array(6)].map((_, i) => (
                          <div
                            key={i}
                            className="absolute w-1 h-1 bg-white/50 rounded-full animate-ping"
                            style={{
                              left: `${20 + (i * 10)}%`,
                              top: `${30 + (i % 3) * 15}%`,
                              animationDelay: `${i * 0.3}s`
                            }}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Fallback for broken images */}
                    <div className="hidden w-32 h-32 bg-gray-300 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-lg">
                      <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-2 text-xs mb-2">
                      <div className={`w-2 h-2 rounded-full ${fileType === '3d' ? 'bg-purple-500' : 'bg-green-500'}`}></div>
                      <span className="text-gray-600">
                        {fileType === '3d' ? '3D Model URL' : 'Image URL'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 break-all">
                      {avatarUrl}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 3D Preview Section */}
            {avatarUrl && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-200/50 p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <svg className="w-6 h-6 mr-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  3D Avatar Preview
                </h2>

                <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 rounded-xl p-8 relative overflow-hidden">
                  {/* 3D Background Effects */}
                  <div className="absolute inset-0">
                    <div className="grid grid-cols-12 grid-rows-8 h-full w-full opacity-10">
                      {[...Array(96)].map((_, i) => (
                        <div key={i} className="border border-white/20"></div>
                      ))}
                    </div>
                  </div>

                  {/* Floating Particles */}
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 bg-white/30 rounded-full animate-float"
                      style={{
                        left: `${10 + (i * 10)}%`,
                        top: `${20 + (i % 3) * 20}%`,
                        animationDelay: `${i * 0.5}s`,
                        animationDuration: `${3 + i}s`
                      }}
                    />
                  ))}

                  <div className="relative z-10 text-center">
                    <div className="inline-block relative">
                      {/* 3D Avatar Container */}
                      <div className="relative w-48 h-48 mx-auto mb-6">
                        {/* Rotating Ring */}
                        <div className="absolute inset-0 border-2 border-cyan-400/30 rounded-full animate-spin-slow"></div>
                        <div className="absolute inset-4 border border-purple-400/30 rounded-full animate-spin-reverse-slow"></div>
                        
                        {/* Avatar Display */}
                        <div className="absolute inset-8 rounded-full overflow-hidden border-4 border-white/50 shadow-2xl">
                          {fileType === 'image' ? (
                            <>
                              <Image
                                src={avatarUrl}
                                alt="3D Avatar Preview"
                                fill
                                className="object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10"></div>
                            </>
                          ) : fileType === '3d' ? (
                            <div className="w-full h-full bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-600 flex items-center justify-center relative">
                              {/* 3D Model Visualization */}
                              <div className="text-white text-center relative z-10">
                                <svg className="w-16 h-16 mx-auto mb-2 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                <p className="text-sm font-bold">3D MODEL</p>
                                <p className="text-xs opacity-80">{avatarUrl?.split('.').pop()?.toUpperCase()}</p>
                              </div>
                              
                              {/* Animated wireframe effect */}
                              <div className="absolute inset-0 opacity-30">
                                {[...Array(8)].map((_, i) => (
                                  <div
                                    key={i}
                                    className="absolute border border-white/40"
                                    style={{
                                      left: `${10 + (i % 4) * 20}%`,
                                      top: `${10 + Math.floor(i / 4) * 40}%`,
                                      width: '15%',
                                      height: '15%',
                                      transform: `rotate(${i * 45}deg)`,
                                      animation: `float ${3 + i * 0.5}s ease-in-out infinite`
                                    }}
                                  />
                                ))}
                              </div>
                              
                              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/10"></div>
                            </div>
                          ) : null}
                        </div>

                        {/* Orbiting Elements */}
                        {[...Array(6)].map((_, i) => (
                          <div
                            key={i}
                            className="absolute w-3 h-3 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full animate-orbit"
                            style={{
                              left: '50%',
                              top: '50%',
                              transformOrigin: '0 0',
                              animationDelay: `${i * 0.5}s`,
                              animationDuration: '6s',
                              transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateX(120px) rotate(-${i * 60}deg)`
                            }}
                          />
                        ))}
                      </div>

                      <div className="text-white">
                        <h3 className="text-2xl font-bold mb-2">{avatarName || 'Unnamed Avatar'}</h3>
                        <p className="text-cyan-300 text-sm">
                          {fileType === '3d' ? '3D Model Ready for Metaverse' : 'Ready for the Metaverse'}
                        </p>
                        {fileType === '3d' && (
                          <div className="mt-2 flex items-center justify-center space-x-2 text-xs">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                            <span className="text-purple-300">Interactive 3D Avatar</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error/Success Messages */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl">
                {success}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || !avatarName.trim() || !avatarUrl.trim()}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-xl transition-all duration-200 transform hover:scale-105 disabled:scale-100 shadow-lg disabled:cursor-not-allowed flex items-center"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Avatar...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Avatar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Custom CSS for animations */}
        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.7; }
            50% { transform: translateY(-10px) rotate(180deg); opacity: 1; }
          }
          
          @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          @keyframes spin-reverse-slow {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          
          @keyframes orbit {
            0% { transform: translate(-50%, -50%) rotate(0deg) translateX(120px) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg) translateX(120px) rotate(-360deg); }
          }
          
          .animate-float { animation: float 3s ease-in-out infinite; }
          .animate-spin-slow { animation: spin-slow 8s linear infinite; }
          .animate-spin-reverse-slow { animation: spin-reverse-slow 12s linear infinite; }
          .animate-orbit { animation: orbit 6s linear infinite; }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}