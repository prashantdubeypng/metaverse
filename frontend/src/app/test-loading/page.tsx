'use client';

import { useState } from 'react';
import LoadingScreen from '@/components/LoadingScreen';

export default function TestLoadingPage() {
    const [showLoading, setShowLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Loading');
    const [isFullScreen, setIsFullScreen] = useState(true);

    const messages = [
        'Loading',
        'Processing Data',
        'Fetching Records',
        'Synchronizing',
        'Connecting to Server',
        'Initializing System',
        'Analyzing Data',
        'Building Dashboard',
        'Preparing Workspace',
        'Authenticating User',
        'Loading Resources',
        'Optimizing Performance'
    ];

    const startLoading = (duration: number = 5000) => {
        setShowLoading(true);
        setTimeout(() => {
            setShowLoading(false);
        }, duration);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                    Loading Component Test
                </h1>

                {/* Controls */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <h2 className="text-xl font-semibold mb-4">Test Controls</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Message Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Loading Message
                            </label>
                            <select
                                value={loadingMessage}
                                onChange={(e) => setLoadingMessage(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {messages.map((msg) => (
                                    <option key={msg} value={msg}>
                                        {msg}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Full Screen Toggle */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Display Mode
                            </label>
                            <div className="flex items-center space-x-4">
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        checked={isFullScreen}
                                        onChange={() => setIsFullScreen(true)}
                                        className="mr-2"
                                    />
                                    Full Screen
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        checked={!isFullScreen}
                                        onChange={() => setIsFullScreen(false)}
                                        className="mr-2"
                                    />
                                    Inline
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Test Buttons */}
                    <div className="mt-6 flex flex-wrap gap-4">
                        <button
                            onClick={() => startLoading(3000)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors"
                        >
                            Quick Load (3s)
                        </button>
                        <button
                            onClick={() => startLoading(5000)}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors"
                        >
                            Standard Load (5s)
                        </button>
                        <button
                            onClick={() => startLoading(10000)}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
                        >
                            Heavy Load (10s)
                        </button>
                        <button
                            onClick={() => startLoading(15000)}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md transition-colors"
                        >
                            Data Sync (15s)
                        </button>
                        <button
                            onClick={() => setShowLoading(!showLoading)}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
                        >
                            Toggle Loading
                        </button>
                    </div>
                </div>

                {/* Features List */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <h2 className="text-xl font-semibold mb-4">Loading Component Features</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h3 className="font-medium text-gray-900">Data Visualization</h3>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Central data hub with orbiting nodes</li>
                                <li>• Animated data packets traveling in circles</li>
                                <li>• Connection lines with pulsing effects</li>
                                <li>• Dynamic gradient color transitions</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-medium text-gray-900">Status Indicators</h3>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Connected, Processing, and Syncing states</li>
                                <li>• Orbital dots around status balls</li>
                                <li>• Animated progress bar with gradients</li>
                                <li>• Flipping status messages</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-medium text-gray-900">Visual Effects</h3>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Floating orbs with blur effects</li>
                                <li>• Grid pattern background overlay</li>
                                <li>• Pulsing and ping animations</li>
                                <li>• Light reflections on status balls</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-medium text-gray-900">Customization</h3>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Custom loading messages</li>
                                <li>• Full screen or inline display</li>
                                <li>• Responsive design</li>
                                <li>• Easy to integrate</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Usage Example */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">Usage Example</h2>
                    <div className="bg-gray-100 rounded-md p-4 overflow-x-auto">
                        <pre className="text-sm text-gray-800">
                            {`import LoadingScreen from '@/components/LoadingScreen';

// Full screen loading
<LoadingScreen message="Loading your data" fullScreen={true} />

// Inline loading
<LoadingScreen message="Processing" fullScreen={false} />

// Default loading
<LoadingScreen />`}
                        </pre>
                    </div>
                </div>

                {/* Inline Preview */}
                {!isFullScreen && (
                    <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold mb-4">Inline Preview</h2>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg">
                            <LoadingScreen
                                message={loadingMessage}
                                fullScreen={false}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Full Screen Loading Overlay */}
            {showLoading && (
                <LoadingScreen
                    message={loadingMessage}
                    fullScreen={isFullScreen}
                />
            )}
        </div>
    );
}