'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadingScreen from '@/components/LoadingScreen';
import { clearTokenData, getTokenData } from '@/utils/auth';

interface Map {
    id: string;
    name: string;
    width: number;
    height: number;
    thumbnail: string | null;
    creatorId: string;
    createdAt: string;
    updatedAt: string;
}



export default function AdminPage() {
    const [maps, setMaps] = useState<Map[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const router = useRouter();

    const fetchMaps = useCallback(async () => {
        setIsLoading(true);
        setError('');

        try {
            const tokenData = getTokenData();
            if (!tokenData?.token) {
                clearTokenData();
                router.push('/login');
                return;
            }

            const response = await fetch('https://metaverse-http-u3ys.onrender.com/api/v1/admin/get-all/maps', {
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

            const data = await response.json();
            setMaps(Array.isArray(data) ? data : data.data || []);
        } catch (err) {
            console.error('Error fetching maps:', err);
            setError('Failed to load maps');
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchMaps();
    }, [fetchMaps]);



    const handleCreateMap = () => {
        router.push('/admin/map-editor');
    };



    const handleEditMap = (mapId: string) => {
        router.push(`/admin/map-editor?id=${mapId}`);
    };

    const handleOpenSpace = async (mapId: string, mapName: string) => {
        try {
            const tokenData = getTokenData();
            if (!tokenData?.token) {
                clearTokenData();
                router.push('/login');
                return;
            }

            // Fetch space data with all elements
            const response = await fetch(`https://metaverse-http-u3ys.onrender.com/api/v1/space/${mapId}`, {
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

            const spaceData = await response.json();
            console.log('Space data with elements:', spaceData);

            // Navigate to space view with the space data
            router.push(`/space/${mapId}`);
        } catch (err) {
            console.error('Error opening space:', err);
            setError(`Failed to open space: ${mapName}`);
        }
    };

    const handleDeleteMap = async (mapId: string, mapName: string) => {
        if (!confirm(`Are you sure you want to delete "${mapName}"?`)) {
            return;
        }

        try {
            const tokenData = getTokenData();
            if (!tokenData?.token) {
                clearTokenData();
                router.push('/login');
                return;
            }

            const response = await fetch(`https://metaverse-http-u3ys.onrender.com/api/v1/maps/${mapId}`, {
                method: 'DELETE',
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

            // Remove from local state and refresh
            await fetchMaps();
        } catch (err) {
            console.error('Error deleting map:', err);
            setError('Failed to delete map');
        }
    };



    const handleLogout = () => {
        clearTokenData();
        router.push('/login');
    };

    if (isLoading) {
        return <LoadingScreen message="Loading Admin Panel" />;
    }

    return (
        <ProtectedRoute requiredRole="Admin">
            <div className="min-h-screen bg-gray-100">
                {/* Header */}
                <div className="bg-white border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center py-4">
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
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
                                    <p className="text-sm text-gray-600">Manage your maps, avatars, and elements</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
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

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                            {error}
                        </div>
                    )}

                    {/* Maps Section */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-semibold text-gray-900">My Maps</h2>
                            <p className="text-gray-600">Manage and edit your created maps</p>
                        </div>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => router.push('/admin/element-editor')}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors flex items-center"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                New Element
                            </button>
                            <button
                                onClick={() => router.push('/admin/avatar-editor')}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors flex items-center"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                New Avatar
                            </button>
                            <button
                                onClick={handleCreateMap}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors flex items-center"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                New Map
                            </button>
                        </div>
                    </div>

                    {maps.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-12 text-center">
                            <svg className="w-20 h-20 text-gray-400 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            <h3 className="text-xl font-medium text-gray-900 mb-3">No maps found</h3>
                            <p className="text-gray-600 mb-6">You haven&apos;t created any maps yet. Create your first map to get started with building virtual spaces.</p>
                            <button
                                onClick={handleCreateMap}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-md transition-colors inline-flex items-center"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Create Your First Map
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {maps.map((map) => (
                                <div key={map.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-all duration-200 overflow-hidden group">
                                    {/* Clickable thumbnail area */}
                                    <div
                                        className="relative cursor-pointer"
                                        onClick={() => handleOpenSpace(map.id, map.name)}
                                        title={`Open ${map.name} space`}
                                    >
                                        {map.thumbnail ? (
                                            <Image
                                                src={map.thumbnail}
                                                alt={map.name}
                                                width={400}
                                                height={192}
                                                className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-200"
                                            />
                                        ) : (
                                            <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                                </svg>
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3 bg-white bg-opacity-90 backdrop-blur-sm rounded-full px-2 py-1">
                                            <span className="text-xs font-medium text-gray-700">{map.width} × {map.height}</span>
                                        </div>
                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white rounded-full p-3">
                                                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-semibold text-gray-900 mb-2 text-lg">{map.name}</h3>
                                        <p className="text-sm text-gray-500 mb-4">
                                            Created {new Date(map.createdAt).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </p>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => handleOpenSpace(map.id, map.name)}
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
                                            >
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                View
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditMap(map.id);
                                                }}
                                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
                                            >
                                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                Edit
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteMap(map.id, map.name);
                                                }}
                                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
