'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';
import ProtectedRoute from '@/components/ProtectedRoute';
import { clearTokenData, getTokenData } from '@/utils/auth';
import { ENV } from '@/CONFIG/env.config';

interface Space {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail: string | null;
  creatorId: string;
}

interface SpaceMembership {
  id: string;
  userId: string;
  spaceId: string;
  joinedAt: string;
  isActive: boolean;
  space: Space;
}

interface User {
  id: string;
  username: string;
  email: string;
  avatarId?: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<SpaceMembership[]>([]);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const fetchUserAvatar = useCallback(async (avatarId: string) => {
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) return;

      const response = await fetch(`${ENV.API_URL}/user/avtars/${avatarId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const responseData = await response.json();
        if (responseData.data && responseData.data.imageurl) {
          setUserAvatarUrl(responseData.data.imageurl);
        }
      }
    } catch (err) {
      console.error('Error fetching user avatar:', err);
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        clearTokenData();
        router.push('/login');
        return;
      }

      // Fetch full user profile data
      const response = await fetch(`${ENV.API_URL}/user/profile/get/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        clearTokenData();
        router.push('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      const userData = responseData.data;
      setUser(userData);

      // Fetch user avatar if they have one
      if (userData.avatarId) {
        fetchUserAvatar(userData.avatarId);
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      clearTokenData();
      router.push('/login');
    }
  }, [router, fetchUserAvatar]);

  const fetchUserSpaces = useCallback(async () => {
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        clearTokenData();
        router.push('/login');
        return;
      }

      const response = await fetch(`${ENV.API_URL}/space/all`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        // Token expired or invalid
        clearTokenData();
        router.push('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      setSpaces(Array.isArray(responseData.data) ? responseData.data : []);
    } catch (err) {
      console.error('Error fetching spaces:', err);
      setError('Failed to load spaces');
      setSpaces([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUserData();
    fetchUserSpaces();
  }, [fetchUserData, fetchUserSpaces]);

  const handleJoinSpace = async () => {
    if (!joinRoomId.trim()) return;

    setIsJoining(true);
    setError('');

    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${ENV.API_URL}/space/room/join-room/${joinRoomId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.message || 'Failed to join space');
        return;
      }

      if (result.alreadyMember) {
        setError('Already a member of this space');
      } else if (result.status === 200) {
        setError('Successfully joined the space');
        // Optionally, you can show a success toast or modal here
      } else {
        setError(result.message || 'Failed to join space');
      }

      // Refresh the spaces list
      await fetchUserSpaces();
      setJoinRoomId('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join space';
      setError(errorMessage);
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateRoom = () => {
    router.push('/create-room');
  };

  const handleRemoveSpace = async (spaceId: string, spaceName: string) => {
    if (!confirm(`Are you sure you want to leave "${spaceName}"?`)) {
      return;
    }

    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${ENV.API_URL}/space/${spaceId}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to leave space');
      }

      // Remove space from the list
      setSpaces(prev => prev.filter(space => space.spaceId !== spaceId));
    } catch (err) {
      console.error('Error leaving space:', err);
      setError('Failed to leave space');
    }
  };

  const handleLogout = () => {
    clearTokenData();
    router.push('/login');
  };

  const copyJoinUrl = (spaceId: string) => {
    const url = `${ENV.API_URL}/space/room/join-room/${spaceId}`;
    navigator.clipboard.writeText(url);
    setError('Join URL copied!'); // Reuse error for feedback, or use a dedicated state
  };

  if (isLoading) {
    return <LoadingScreen message="Loading Dashboard" />;
  }

  return (
    <ProtectedRoute requiredRole="User">
      <div className="min-h-screen bg-gray-50">
        {/* Header with Profile */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              </div>

              {/* Profile Section */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/profile')}
                  className="text-right hover:bg-gray-50 rounded-lg p-2 transition-colors group"
                >
                  <p className="text-sm text-gray-600 group-hover:text-gray-700">Welcome back,</p>
                  <p className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600">{user?.username}</p>
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => router.push('/profile')}
                    className="rounded-full transition-all hover:ring-2 hover:ring-indigo-200"
                    title="View Profile"
                  >
                    {userAvatarUrl ? (
                      <img
                        src={userAvatarUrl}
                        alt="User Avatar"
                        className="w-10 h-10 rounded-full object-cover border-2 border-indigo-200 hover:border-indigo-300"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-indigo-100 hover:bg-indigo-200 rounded-full flex items-center justify-center text-indigo-600 hover:text-indigo-700 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="bg-gray-100 hover:bg-gray-200 rounded-full p-2 text-gray-600 hover:text-gray-900 transition-colors"
                    title="Logout"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Room Management Section */}
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Space Management</h2>

              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                {/* Create New 3D Space Button */}
                <button
                  onClick={handleCreateRoom}
                  className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-xl hover:shadow-2xl flex items-center justify-center group overflow-hidden"
                >
                  {/* 3D Background Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  {/* Floating Particles */}
                  <div className="absolute inset-0 overflow-hidden">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-2 h-2 bg-white/30 rounded-full animate-float"
                        style={{
                          left: `${20 + i * 30}%`,
                          top: `${30 + i * 20}%`,
                          animationDelay: `${i * 0.5}s`,
                          animationDuration: `${2 + i}s`
                        }}
                      />
                    ))}
                  </div>

                  <div className="relative z-10 flex items-center space-x-3">
                    <div className="relative">
                      <svg className="w-6 h-6 transform group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-0 group-hover:opacity-100"></div>
                    </div>
                    <span className="text-lg">Create 3D Space</span>
                  </div>

                  {/* 3D Depth Shadow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/20 rounded-2xl"></div>
                </button>

                {/* Join Room Input */}
                <div className="flex-1 flex">
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    placeholder="Enter space ID to join"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleJoinSpace}
                    disabled={isJoining || !joinRoomId.trim()}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium px-4 py-2 rounded-r-md transition-colors disabled:cursor-not-allowed"
                  >
                    {isJoining ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* User Spaces Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Your Spaces</h2>
              <p className="text-sm text-gray-600 mt-1">Spaces you are a member of</p>
            </div>

            <div className="p-6">
              {spaces.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 text-lg">No data found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {spaces && spaces.length > 0 && spaces.map((spaceMembership) => (
                    <div
                      key={spaceMembership.id}
                      className="relative group cursor-pointer transform transition-all duration-300 hover:scale-105 hover:-translate-y-2"
                      onClick={() => spaceMembership.space?.id && router.push(`/space/${spaceMembership.space.id}`)}
                    >
                      {/* 3D Card Container */}
                      <div className="relative bg-gradient-to-br from-white via-gray-50 to-gray-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200/50">
                        {/* 3D Space Visualization */}
                        <div className="relative h-48 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 overflow-hidden">
                          {/* Map Thumbnail */}
                          {spaceMembership.space?.thumbnail && (
                            <img
                              src={spaceMembership.space.thumbnail}
                              alt="Map Thumbnail"
                              className="absolute inset-0 w-full h-full object-cover z-0"
                              style={{ opacity: 0.7 }}
                            />
                          )}
                          {/* 3D Grid Background */}
                          <div className="absolute inset-0 opacity-20">
                            <div className="grid grid-cols-8 grid-rows-6 h-full w-full">
                              {[...Array(48)].map((_, i) => (
                                <div key={i} className="border border-white/30"></div>
                              ))}
                            </div>
                          </div>

                          {/* 3D Floating Elements */}
                          <div className="absolute inset-0">
                            {/* Floating Cubes */}
                            {[...Array(6)].map((_, i) => (
                              <div
                                key={i}
                                className="absolute w-4 h-4 bg-white/20 rounded transform rotate-45 animate-float"
                                style={{
                                  left: `${15 + (i * 12)}%`,
                                  top: `${20 + (i % 3) * 20}%`,
                                  animationDelay: `${i * 0.5}s`,
                                  animationDuration: `${3 + i}s`
                                }}
                              />
                            ))}

                            {/* 3D Spheres */}
                            {[...Array(4)].map((_, i) => (
                              <div
                                key={i}
                                className="absolute w-6 h-6 bg-gradient-to-br from-white/30 to-white/10 rounded-full animate-bounce-slow shadow-lg"
                                style={{
                                  right: `${10 + (i * 15)}%`,
                                  top: `${30 + (i % 2) * 25}%`,
                                  animationDelay: `${i * 0.7}s`,
                                  animationDuration: `${4 + i}s`
                                }}
                              />
                            ))}
                          </div>

                          {/* Space Dimensions Indicator */}
                          <div className="absolute top-4 left-4 flex items-center space-x-2 z-10">
                            <div className="bg-black/20 backdrop-blur-sm rounded-lg px-3 py-1 text-white text-sm font-medium">
                              {spaceMembership.space?.width || 0} × {spaceMembership.space?.height || 0}
                            </div>
                            {/* Three-dot menu */}
                            <div className="relative group">
                              <button className="p-2 rounded-full hover:bg-gray-200" title="More actions">
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <circle cx="5" cy="12" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="19" cy="12" r="2" />
                                </svg>
                              </button>
                              <div className="absolute left-0 mt-2 w-32 bg-white border rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-auto">
                                <button
                                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-700"
                                  onClick={() => copyJoinUrl(spaceMembership.space.id)}
                                >
                                  Share
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Leave Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (spaceMembership.space?.id) {
                                handleRemoveSpace(spaceMembership.space.id, spaceMembership.space.name || 'Unnamed Space');
                              }
                            }}
                            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-red-500/80 hover:bg-red-600 text-white rounded-full p-2 backdrop-blur-sm transform hover:scale-110"
                            title="Leave space"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>

                          {/* 3D Depth Effect */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
                        </div>

                        {/* Card Content */}
                        <div className="p-6">
                          <div className="mb-4">
                            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                              {spaceMembership.space?.name || 'Unnamed Space'}
                            </h3>
                            <p className="text-sm text-gray-500 font-mono bg-gray-100 rounded px-2 py-1 inline-block">
                              ID: {spaceMembership.space?.id?.slice(0, 8) || 'N/A'}...
                            </p>
                          </div>

                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                              <span className="text-sm text-gray-600">Active Space</span>
                            </div>
                            <span className="text-xs text-gray-400">
                              Joined {new Date(spaceMembership.joinedAt).toLocaleDateString()}
                            </span>
                          </div>

                          {/* 3D Action Buttons */}
                          <div className="flex space-x-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (spaceMembership.space?.id) {
                                  router.push(`/space/${spaceMembership.space.id}`);
                                }
                              }}
                              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                              </svg>
                              <span>Enter Space</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (spaceMembership.space?.id) {
                                  handleRemoveSpace(spaceMembership.space.id, spaceMembership.space.name || 'Unnamed Space');
                                }
                              }}
                              className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* 3D Glow Effect */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                      </div>

                      {/* 3D Shadow */}
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl transform translate-y-2 translate-x-2 -z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 blur-sm"></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Custom 3D Animations */}
        <style jsx>{`
          @keyframes float {
            0%, 100% { 
              transform: translateY(0px) rotate(0deg); 
              opacity: 0.7;
            }
            50% { 
              transform: translateY(-10px) rotate(180deg); 
              opacity: 1;
            }
          }
          
          @keyframes bounce-slow {
            0%, 100% { 
              transform: translateY(0px) scale(1); 
            }
            50% { 
              transform: translateY(-15px) scale(1.1); 
            }
          }
          
          @keyframes pulse-glow {
            0%, 100% { 
              box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
            }
            50% { 
              box-shadow: 0 0 40px rgba(99, 102, 241, 0.6);
            }
          }
          
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
          
          .animate-bounce-slow {
            animation: bounce-slow 4s ease-in-out infinite;
          }
          
          .animate-pulse-glow {
            animation: pulse-glow 2s ease-in-out infinite;
          }
          
          /* 3D Transform Effects */
          .transform-3d {
            transform-style: preserve-3d;
          }
          
          .rotate-y-12 {
            transform: rotateY(12deg);
          }
          
          .perspective-1000 {
            perspective: 1000px;
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}