"use client";

import { ENDPOINTS, ENV } from '@/CONFIG/env.config';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';
import ProtectedRoute from '@/components/ProtectedRoute';
import { clearTokenData, getTokenData } from '@/utils/auth';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  password: string;
  avatarId: string | null;
  role: string;
  avatar: string | null;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

interface Avatar {
  id: string;
  imageUrl: string;
  name?: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false);
  const [error, setError] = useState('');
  const [isSelectingAvatar, setIsSelectingAvatar] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const router = useRouter();

  const fetchCurrentAvatar = useCallback(async (avatarId: string) => {
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        clearTokenData();
        router.push('/login');
        return;
      }

  const baseUserUrl = `${ENV.API_URL}/api/v1/user`;
  const response = await fetch(`https://metaverse-http-u3ys.onrender.com/api/v1/user/avtars/${avatarId}`, {
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
      console.log('Current Avatar Response:', responseData);
      if (responseData.data && responseData.data.imageurl) {
        setCurrentAvatarUrl(responseData.data.imageurl);
        console.log('Current avatar URL set:', responseData.data.imageurl);
      }
    } catch (err) {
      console.error('Error fetching current avatar:', err);
    }
  }, [router]);

  const fetchUserProfile = useCallback(async () => {
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        clearTokenData();
        router.push('/login');
        return;
      }

  const response = await fetch(ENDPOINTS.auth.profile, {
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
      console.log('Profile API Response:', responseData);
      const profileData: UserProfile = responseData.data;
      console.log('Profile Data:', profileData);
      console.log('Current Avatar ID:', profileData.avatarId);
      console.log('Profile Avatar URL:', profileData.avatar);
      setProfile(profileData);
      setSelectedAvatarId(profileData.avatarId);
      
      // Fetch current avatar if user has one
      if (profileData.avatarId) {
        fetchCurrentAvatar(profileData.avatarId);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [router, fetchCurrentAvatar]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const fetchAvatars = async () => {
    setIsLoadingAvatars(true);
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        clearTokenData();
        router.push('/login');
        return;
      }

  const response = await fetch("https://metaverse-http-u3ys.onrender.com/api/v1/avatars", {
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
      console.log('Avatar API Response:', responseData);
      const avatarsData = responseData.avatars || [];
      console.log('Raw avatars data:', avatarsData);
      const processedAvatars = Array.isArray(avatarsData) ? avatarsData.map(avatar => ({
        id: avatar.id,
        imageUrl: avatar.imageurl, // Map imageurl to imageUrl
        name: avatar.name
      })) : [];
      console.log('Processed avatars:', processedAvatars);
      setAvatars(processedAvatars);
    } catch (err) {
      console.error('Error fetching avatars:', err);
      setError('Failed to load avatars');
    } finally {
      setIsLoadingAvatars(false);
    }
  };

  const handleAvatarSelect = () => {
    setIsSelectingAvatar(true);
    setError('');
    fetchAvatars();
  };

  const handleAvatarChange = (avatarId: string) => {
    setSelectedAvatarId(avatarId);
  };

  const handleSaveAvatar = async () => {
    if (!selectedAvatarId) {
      setError('Please select an avatar');
      return;
    }

    setIsUpdatingAvatar(true);
    try {
      const tokenData = getTokenData();
      if (!tokenData?.token) {
        clearTokenData();
        router.push('/login');
        return;
      }

      console.log('Updating avatar with ID:', selectedAvatarId);
      
  const response = await fetch("https://metaverse-http-u3ys.onrender.com/api/v1/user/metadata", {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarId: selectedAvatarId
        }),
      });

      console.log('Avatar update response status:', response.status);

      if (response.status === 401) {
        clearTokenData();
        router.push('/login');
        return;
      }

      const responseData = await response.json();
      console.log('Avatar update response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Refresh profile data and current avatar
      console.log('Refreshing profile data...');
      await fetchUserProfile();
      if (selectedAvatarId) {
        await fetchCurrentAvatar(selectedAvatarId);
      }
      setIsSelectingAvatar(false);
      setError('');
      console.log('Avatar updated successfully');
    } catch (err) {
      console.error('Error updating avatar:', err);
      setError(err instanceof Error ? err.message : 'Failed to update avatar');
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handleCancelAvatarSelection = () => {
    setIsSelectingAvatar(false);
    setSelectedAvatarId(profile?.avatarId || null);
    setError('');
  };

  const handleLogout = () => {
    clearTokenData();
    router.push('/login');
  };

  if (isLoading) {
    return <LoadingScreen message="Loading Profile" />;
  }

  return (
    <ProtectedRoute requiredRole="User">
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                  title="Back to Dashboard"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
              </div>

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
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {profile ? (
            <div className="bg-white rounded-lg shadow">
              {/* Profile Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Avatar Display */}
                    <div className="relative">
                      {currentAvatarUrl || profile.avatar ? (
                        <img
                          src={currentAvatarUrl || profile.avatar || ''}
                          alt="User Avatar"
                          className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                          onError={(e) => {
                            console.log('Avatar image failed to load:', currentAvatarUrl || profile.avatar);
                            e.currentTarget.style.display = 'none';
                          }}
                          onLoad={() => {
                            console.log('Avatar image loaded successfully:', currentAvatarUrl || profile.avatar);
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      <button
                        onClick={handleAvatarSelect}
                        className="absolute -bottom-1 -right-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-1 transition-colors"
                        title="Change Avatar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{profile.username}</h2>
                      <p className="text-gray-600">{profile.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {profile.isActive !== undefined && profile.isActive && (
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                      {profile.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Avatar Selection Modal */}
              {isSelectingAvatar && (
                <div className="p-6 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Avatar</h3>
                  
                  {isLoadingAvatars ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 mb-6">
                        {avatars.map((avatar) => (
                          <button
                            key={avatar.id}
                            onClick={() => handleAvatarChange(avatar.id)}
                            className={`relative rounded-full overflow-hidden border-2 transition-all ${
                              selectedAvatarId === avatar.id
                                ? 'border-gray-400 ring-2 ring-gray-300'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <img
                              src={avatar.imageUrl}
                              alt={avatar.name || `Avatar ${avatar.id}`}
                              className={`w-16 h-16 object-cover transition-all ${
                                selectedAvatarId === avatar.id ? 'opacity-60' : 'opacity-100'
                              }`}
                            />
                            {selectedAvatarId === avatar.id && (
                              <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      
                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={handleCancelAvatarSelection}
                          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveAvatar}
                          disabled={isUpdatingAvatar}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-md transition-colors disabled:cursor-not-allowed"
                        >
                          {isUpdatingAvatar ? 'Updating...' : 'Save Avatar'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Profile Details */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                      <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{profile.username}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{profile.email}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                      <p className="text-gray-600 bg-gray-50 px-3 py-2 rounded-md font-mono text-sm">{profile.id}</p>
                    </div>
                  </div>

                  {/* Account Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md">{profile.role}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Avatar</label>
                      <div className="flex items-center space-x-3 bg-gray-50 px-3 py-2 rounded-md">
                        {currentAvatarUrl || profile.avatar ? (
                          <>
                            <img
                              src={currentAvatarUrl || profile.avatar || ''}
                              alt="Current Avatar"
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            <span className="text-gray-900">Custom Avatar</span>
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <span className="text-gray-600">No avatar set</span>
                          </>
                        )}
                      </div>
                    </div>

                    {profile.createdAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Created</label>
                        <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                          {new Date(profile.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}

                    {profile.updatedAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                        <p className="text-gray-900 bg-gray-50 px-3 py-2 rounded-md">
                          {new Date(profile.updatedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}

                    {profile.isActive !== undefined && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <p className={`px-3 py-2 rounded-md ${profile.isActive ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                          {profile.isActive ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 text-lg">No profile data found</p>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
