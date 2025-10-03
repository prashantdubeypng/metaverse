// Centralized frontend environment configuration

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const WS_URL = (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001').replace(/^http(s?):\/\//, 'ws$1://');

export const ENV = {
	API_URL,
	WS_URL,
	// Optional TURN configuration for WebRTC
	TURN: {
		url: process.env.NEXT_PUBLIC_TURN_SERVER_URL || '',
		username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
		credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || ''
	}
} as const;

// Convenience helpers for common endpoints used throughout the app
export const ENDPOINTS = {
	auth: {
		login: `${API_URL}/api/v1/auth/login`,
		signup: `${API_URL}/api/v1/auth/signup`,
		profile: `${API_URL}/api/v1/user/profile/get/user`
	},
	space: {
		base: `${API_URL}/api/v1/space`,
	},
	chatroom: {
		base: `${API_URL}/api/v1/chatroom`,
	}
} as const;

export type EnvConfig = typeof ENV;
