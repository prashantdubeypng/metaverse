'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ProtectedRoute from '@/components/ProtectedRoute';
import { clearTokenData, getTokenData } from '@/utils/auth';
import { ENV } from '@/CONFIG/env.config';

export default function ElementEditorPage() {
  const [elementName, setElementName] = useState('');
  const [elementType, setElementType] = useState('decoration');
  const [elementUrl, setElementUrl] = useState('');
  const [fileType, setFileType] = useState<'image' | '3d' | null>(null);
  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const router = useRouter();

  const elementTypes = [
    { value: 'decoration', label: 'Decoration', icon: '🎨', description: 'Decorative items like plants, art, etc.' },
    { value: 'furniture', label: 'Furniture', icon: '🪑', description: 'Chairs, tables, sofas, etc.' },
    { value: 'interactive', label: 'Interactive', icon: '🎮', description: 'Clickable objects with actions' },
    { value: 'structure', label: 'Structure', icon: '🏗️', description: 'Walls, doors, windows, etc.' },
    { value: 'lighting', label: 'Lighting', icon: '💡', description: 'Lamps, spotlights, ambient lights' },
    { value: 'nature', label: 'Nature', icon: '🌳', description: 'Trees, rocks, water features' }
  ];

  const handleUrlChange = (url: string) => {
    setElementUrl(url);
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
    
    if (!elementName.trim()) {
      setError('Please enter an element name');
      return;
    }

    if (!elementUrl.trim()) {
      setError('Please enter an element URL');
      return;
    }

    if (width < 1 || height < 1) {
      setError('Width and height must be at least 1');
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

      const response = await fetch(`${ENV.API_URL}/admin/element`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageurl: elementUrl,
          width: width.toString(),
          height: height.toString(),
          static: elementType !== 'yes' // interactive elements are not static
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
      setSuccess('Element created successfully!');
      
      // Reset form
      setElementName('');
      setElementType('decoration');
      setElementUrl('');
      setFileType(null);
      setWidth(1);
      setHeight(1);

      // Redirect after success
      setTimeout(() => {
        router.push('/admin');
      }, 2000);

    } catch (err) {
      console.error('Error creating element:', err);
      setError(err instanceof Error ? err.message : 'Failed to create element');
    } finally {
      setIsUploading(false);
    }
  };



  const selectedType = elementTypes.find(type => type.value === elementType);

  return (
    <ProtectedRoute requiredRole="Admin">
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-green-200/50 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/admin')}
                  className="text-green-600 hover:text-green-800 transition-colors p-2 rounded-full hover:bg-green-100"
                  title="Back to Admin Panel"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                    Element Creator
                  </h1>
                  <p className="text-sm text-gray-600">Create new 3D elements for your spaces</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Element Details */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-green-200/50 p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <svg className="w-6 h-6 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Element Details
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="elementName" className="block text-sm font-medium text-gray-700 mb-2">
                    Element Name
                  </label>
                  <input
                    type="text"
                    id="elementName"
                    value={elementName}
                    onChange={(e) => setElementName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white/80"
                    placeholder="Enter element name..."
                    required
                  />
                </div>

                <div className="md:col-span-2">
    <label htmlFor="elementUrl" className="block text-sm font-medium text-gray-700 mb-2">
      Element URL
    </label>
    <input
      type="text"
      id="elementUrl"
      value={elementUrl}
      onChange={(e) => handleUrlChange(e.target.value)}
      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white/80"
      placeholder="https://example.com/model.glb"
      required
    />
  </div>

                <div>
                  <label htmlFor="width" className="block text-sm font-medium text-gray-700 mb-2">
                    Width (grid units)
                  </label>
                  <input
                    type="number"
                    id="width"
                    min="1"
                    max="10"
                    value={width}
                    onChange={(e) => setWidth(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white/80"
                  />
                </div>

                <div>
                  <label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-2">
                    Height (grid units)
                  </label>
                  <input
                    type="number"
                    id="height"
                    min="1"
                    max="10"
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white/80"
                  />
                </div>
              </div>
            </div>

            {/* URL Preview Section */}
            {elementUrl && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-green-200/50 p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <svg className="w-6 h-6 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Element Preview
                </h2>

                <div className="text-center space-y-4">
                  <div className="relative inline-block">
                    {fileType === 'image' ? (
                      <Image
                        src={elementUrl}
                        alt="Element Preview"
                        width={300}
                        height={192}
                        className="max-w-xs max-h-48 rounded-lg object-contain border-4 border-white shadow-lg mx-auto"
                        style={{
                          aspectRatio: `${width}/${height}`
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : (
                      <div 
                        className="bg-gradient-to-br from-green-500 via-blue-600 to-purple-500 rounded-lg flex items-center justify-center border-4 border-white shadow-lg mx-auto relative overflow-hidden"
                        style={{
                          width: `${Math.max(width * 60, 120)}px`,
                          height: `${Math.max(height * 60, 120)}px`,
                          aspectRatio: `${width}/${height}`
                        }}
                      >
                        <div className="text-white text-center relative z-10">
                          <svg className="w-12 h-12 mx-auto mb-2 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <p className="text-sm font-bold">3D</p>
                          <p className="text-xs opacity-80">{elementUrl?.split('.').pop()?.toUpperCase()}</p>
                        </div>
                        
                        {[...Array(4)].map((_, i) => (
                          <div
                            key={i}
                            className="absolute w-1 h-1 bg-white/60 rounded-full animate-ping"
                            style={{
                              left: `${20 + (i * 20)}%`,
                              top: `${30 + (i % 2) * 20}%`,
                              animationDelay: `${i * 0.4}s`
                            }}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Fallback for broken images */}
                    <div className="hidden bg-gray-300 rounded-lg flex items-center justify-center border-4 border-white shadow-lg mx-auto" style={{
                      width: `${Math.max(width * 60, 120)}px`,
                      height: `${Math.max(height * 60, 120)}px`,
                      aspectRatio: `${width}/${height}`
                    }}>
                      <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-2 text-xs mb-2">
                      <div className={`w-2 h-2 rounded-full ${fileType === '3d' ? 'bg-purple-500' : 'bg-green-500'}`}></div>
                      <span className="text-gray-600">
                        {fileType === '3d' ? '3D Model URL' : 'Image URL'} • {width}×{height}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 break-all">
                      {elementUrl}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 3D Preview Section */}
            {elementUrl && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-green-200/50 p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <svg className="w-6 h-6 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  3D Element Preview
                </h2>

                <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-xl p-8 relative overflow-hidden">
                  {/* 3D Grid Background */}
                  <div className="absolute inset-0">
                    <div className="grid grid-cols-16 grid-rows-12 h-full w-full opacity-20">
                      {[...Array(192)].map((_, i) => (
                        <div key={i} className="border border-green-400/30"></div>
                      ))}
                    </div>
                  </div>

                  {/* Floating Particles */}
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 bg-green-400/50 rounded-full animate-float"
                      style={{
                        left: `${15 + (i * 12)}%`,
                        top: `${20 + (i % 3) * 20}%`,
                        animationDelay: `${i * 0.7}s`,
                        animationDuration: `${4 + i}s`
                      }}
                    />
                  ))}

                  <div className="relative z-10 text-center">
                    <div className="inline-block relative">
                      {/* 3D Element Container */}
                      <div className="relative mx-auto mb-6" style={{ width: `${Math.max(width * 60, 120)}px`, height: `${Math.max(height * 60, 120)}px` }}>
                        {/* Grid Outline */}
                        <div className="absolute inset-0 border-2 border-green-400/50 rounded-lg"></div>
                        <div className="absolute inset-2 border border-blue-400/30 rounded-lg"></div>
                        
                        {/* Element Display */}
                        <div className="absolute inset-4 rounded-lg overflow-hidden border-2 border-white/30 shadow-2xl">
                          {fileType === 'image' ? (
                            <>
                              <Image
                                src={elementUrl}
                                alt="3D Element Preview"
                                fill
                                className="object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10"></div>
                            </>
                          ) : fileType === '3d' ? (
                            <div className="w-full h-full bg-gradient-to-br from-green-600 via-blue-600 to-purple-600 flex items-center justify-center relative">
                              {/* 3D Model Visualization */}
                              <div className="text-white text-center relative z-10">
                                <svg className="w-16 h-16 mx-auto mb-2 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                <p className="text-sm font-bold">3D ELEMENT</p>
                                <p className="text-xs opacity-80">{elementUrl?.split('.').pop()?.toUpperCase()}</p>
                              </div>
                              
                              {/* Animated wireframe grid */}
                              <div className="absolute inset-0 opacity-20">
                                <div className="grid grid-cols-6 grid-rows-6 h-full w-full">
                                  {[...Array(36)].map((_, i) => (
                                    <div
                                      key={i}
                                      className="border border-white/30"
                                      style={{
                                        animationDelay: `${i * 0.1}s`
                                      }}
                                    />
                                  ))}
                                </div>
                                
                              </div>

                              {/* Floating geometric shapes */}
                              {[...Array(6)].map((_, i) => (
                                <div
                                  key={i}
                                  className="absolute w-2 h-2 bg-white/40 rounded-full animate-float"
                                  style={{
                                    left: `${15 + (i * 12)}%`,
                                    top: `${20 + (i % 3) * 20}%`,
                                    animationDelay: `${i * 0.5}s`,
                                    animationDuration: `${3 + i * 0.3}s`
                                  }}
                                />
                              ))}
                              
                              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/10"></div>
                            </div>
                          ) : null}
                        </div>

                        {/* Size Indicators */}
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-500/80 text-white text-xs px-2 py-1 rounded">
                          {width}×{height}
                        </div>

                        {/* Type Badge */}
                        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-blue-500/80 text-white text-xs px-3 py-1 rounded-full">
                          {selectedType?.icon} {selectedType?.label}
                        </div>
                      </div>

                      <div className="text-white">
                        <h3 className="text-2xl font-bold mb-2">{elementName || 'Unnamed Element'}</h3>
                        <p className="text-green-300 text-sm">
                          {fileType === '3d' ? 'Interactive 3D Element Ready' : 'Ready for placement in 3D spaces'}
                        </p>
                        {fileType === '3d' && (
                          <div className="mt-2 flex items-center justify-center space-x-2 text-xs">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-green-300">Full 3D Interaction</span>
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
                disabled={isUploading || !elementName.trim() || !elementUrl.trim()}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-xl transition-all duration-200 transform hover:scale-105 disabled:scale-100 shadow-lg disabled:cursor-not-allowed flex items-center"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Element...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Element
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
            50% { transform: translateY(-15px) rotate(180deg); opacity: 1; }
          }
          
          .animate-float { animation: float 4s ease-in-out infinite; }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
