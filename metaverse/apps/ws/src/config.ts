export const jwt_password = process.env.JWT_SECRET || '123bsdkmcbcanu';
export const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
export const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
export const WS_PORT = parseInt(process.env.WS_PORT || '3001', 10);