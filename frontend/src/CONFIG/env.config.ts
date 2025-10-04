// Centralized frontend environment configuration
const API_URL = (process.env.NEXT_PUBLIC_API_URL!);
const WS_URL = (process.env.NEXT_PUBLIC_WS_URL!);

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
		login: `${API_URL}/auth/login`,
		signup: `${API_URL}/auth/signup`,
		profile: `${API_URL}/user/profile/get/user`,
		forgetPassword: `${API_URL}/auth/forget/password`,
		resetPassword: `${API_URL}/auth/reset/password`
	},
	space: {
		base: `${API_URL}/space`,
	},
	chatroom: {
		base: `${API_URL}/chatroom`,
	}
} as const;

export type EnvConfig = typeof ENV;
