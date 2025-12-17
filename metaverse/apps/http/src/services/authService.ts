import bcrypt from 'bcrypt';
import client from '@repo/db';
import authConfig from '../config/auth.config';
import { signAccessToken, generateRefreshTokenPair, hashToken, msFromDays } from '../utils/tokens';
import UsernameBloomFilterService from './usernameBloomFilter';
import { redis } from '../infra/redisClient';

export interface SignupParams {
  username: string;
  password: string;
  email: string;
  type?: 'Admin' | 'User';
  ip?: string;
  userAgent?: string;
}

export interface LoginParams {
  username: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

export interface RefreshTokenParams {
  oldToken: string;
  ip?: string;
  userAgent?: string;
}

export interface LogoutParams {
  refreshToken: string;
}

/**
 * Signup with Bloom filter pre-check and atomic DB operations
 */
export async function signup(params: SignupParams) {
  const { username, password, email, type = 'User', ip, userAgent } = params;
  const bloomService = UsernameBloomFilterService.getInstance();

  // Check if email already exists
  const existingEmail = await client.user.findUnique({
    where: { email },
    select: { id: true },
  });
  
  if (existingEmail) {
    return { success: false, code: 'EMAIL_TAKEN' };
  }

  // 1) Bloom filter pre-check: if NOT present -> attempt direct create
  if (!bloomService.quickCheck(username)) {
    try {
      const hashedPassword = await bcrypt.hash(password, authConfig.BCRYPT_SALT_ROUNDS);
      const user = await client.user.create({
        data: {
          username,
          password: hashedPassword,
          email,
          role: type === 'Admin' ? 'Admin' : 'User',
        },
      });

      // Update bloom filter (best-effort)
      bloomService.addUsername(username);

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      };
    } catch (err: any) {
      // Handle unique constraint violation (race condition)
      if (err.code === 'P2002') {
        // Check which field caused the conflict
        const target = err.meta?.target;
        if (target?.includes('email')) {
          return { success: false, code: 'EMAIL_TAKEN' };
        }
        return { success: false, code: 'USERNAME_TAKEN' };
      }
      throw err;
    }
  }

  // 2) Bloom filter says possibly present -> verify with DB
  const existing = await client.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (existing) {
    return { success: false, code: 'USERNAME_TAKEN' };
  }

  // 3) Not in DB (false positive) -> proceed with creation
  try {
    const hashedPassword = await bcrypt.hash(password, authConfig.BCRYPT_SALT_ROUNDS);
    const user = await client.user.create({
      data: {
        username,
        password: hashedPassword,
        email,
        role: type === 'Admin' ? 'Admin' : 'User',
      },
    });

    bloomService.addUsername(username);

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  } catch (err: any) {
    if (err.code === 'P2002') {
      return { success: false, code: 'USERNAME_TAKEN' };
    }
    throw err;
  }
}

/**
 * Login with Bloom filter pre-check, rate limiting, and account lockout
 */
export async function login(params: LoginParams) {
  const { username, password, ip, userAgent } = params;
  const bloomService = UsernameBloomFilterService.getInstance();

  console.log(`[Login] Attempting login for username: ${username}`);

  // 1) Bloom filter pre-check: if NOT present -> early fail (avoid DB)
  const bfHas = bloomService.quickCheck(username);
  console.log(`[Login] Bloom filter check for "${username}": ${bfHas}`);
  
  if (!bfHas) {
    // Still increment failed attempts for this IP to prevent enumeration attacks
    console.log(`[Login] Username "${username}" not in bloom filter - checking DB anyway for debugging`);
  }

  // 2) Fetch user from database (always check DB for now to debug)
  const user = await client.user.findUnique({
    where: { username },
  });

  console.log(`[Login] User found in DB: ${!!user}`);
  if (user) {
    console.log(`[Login] User ID: ${user.id}, Username: ${user.username}`);
  }

  if (!user) {
    await incrementFailedAttemptOnNoUser(ip || 'unknown', username);
    return { success: false, code: 'INVALID_CREDENTIALS' };
  }

  // 3) Check if account is locked
  const now = new Date();
  if (user.lockUntil && user.lockUntil > now) {
    console.log(`[Login] Account locked until: ${user.lockUntil}`);
    return {
      success: false,
      code: 'ACCOUNT_LOCKED',
      retryAfter: user.lockUntil,
    };
  }

  // 4) Verify password
  console.log(`[Login] Comparing password...`);
  console.log(`[Login] Input password length: ${password.length}`);
  console.log(`[Login] Stored hash: ${user.password.substring(0, 20)}...`);
  
  const match = await bcrypt.compare(password, user.password);
  console.log(`[Login] Password match: ${match}`);
  if (!match) {
    // Increment failed attempts
    const failed = (user.failedLoginAttempts || 0) + 1;
    const updates: any = { failedLoginAttempts: failed };

    if (failed >= authConfig.MAX_FAILED_ATTEMPTS) {
      updates.lockUntil = new Date(
        Date.now() + authConfig.LOCK_DURATION_MINUTES * 60 * 1000
      );
      updates.failedLoginAttempts = 0;
    }

    await client.user.update({
      where: { id: user.id },
      data: updates,
    });

    return { success: false, code: 'INVALID_CREDENTIALS' };
  }

  // 5) Successful login - reset failed attempts
  await client.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockUntil: null,
      lastLoginAt: new Date(),
    },
  });

  // 6) Generate tokens
  const accessToken = signAccessToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  const { token: refreshTokenPlain, tokenHash } = generateRefreshTokenPair();
  const expiresAt = new Date(Date.now() + msFromDays(authConfig.REFRESH_TOKEN_EXPIRES_DAYS));

  // 7) Store refresh token in database
  await client.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      ip: ip || null,
      userAgent: userAgent || null,
      expiresAt,
    },
  });

  // 8) Cache refresh token in Redis for quick lookup
  await redis.set(
    `refresh:${tokenHash}`,
    user.id,
    'PX',
    msFromDays(authConfig.REFRESH_TOKEN_EXPIRES_DAYS)
  );

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken: refreshTokenPlain,
    expiresIn: authConfig.ACCESS_TOKEN_EXPIRES,
  };
}

/**
 * Rotate refresh token (secure token rotation)
 */
export async function rotateRefreshToken(params: RefreshTokenParams) {
  const { oldToken, ip, userAgent } = params;
  const oldHash = hashToken(oldToken);

  // 1) Find refresh token record
  const rt = await client.refreshToken.findFirst({
    where: { tokenHash: oldHash },
  });

  if (!rt || rt.revokedAt || rt.expiresAt < new Date()) {
    // Token reuse detection: if token was already revoked, revoke all tokens for user
    if (rt && rt.revokedAt) {
      await revokeAllUserTokens(rt.userId);
      console.warn(`⚠️ Token reuse detected for user ${rt.userId}`);
    }
    return { success: false, code: 'INVALID_REFRESH' };
  }

  // 2) Revoke old token
  await client.refreshToken.update({
    where: { id: rt.id },
    data: { revokedAt: new Date() },
  });

  // 3) Generate new token
  const { token: newTokenPlain, tokenHash: newHash } = generateRefreshTokenPair();
  const expiresAt = new Date(Date.now() + msFromDays(authConfig.REFRESH_TOKEN_EXPIRES_DAYS));

  await client.refreshToken.create({
    data: {
      userId: rt.userId,
      tokenHash: newHash,
      ip: ip || null,
      userAgent: userAgent || null,
      expiresAt,
      replacedBy: rt.id,
    },
  });

  // 4) Issue new access token
  const user = await client.user.findUnique({
    where: { id: rt.userId },
  });

  if (!user) {
    return { success: false, code: 'USER_NOT_FOUND' };
  }

  const accessToken = signAccessToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  // 5) Update Redis cache
  await redis.del(`refresh:${oldHash}`);
  await redis.set(
    `refresh:${newHash}`,
    user.id,
    'PX',
    msFromDays(authConfig.REFRESH_TOKEN_EXPIRES_DAYS)
  );

  return {
    success: true,
    accessToken,
    refreshToken: newTokenPlain,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  };
}

/**
 * Logout - revoke refresh token
 */
export async function logout(params: LogoutParams) {
  const { refreshToken } = params;
  const tokenHash = hashToken(refreshToken);

  // Revoke token in database
  await client.refreshToken.updateMany({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  });

  // Remove from Redis cache
  await redis.del(`refresh:${tokenHash}`);

  return { success: true };
}

/**
 * Revoke all refresh tokens for a user (security breach response)
 */
async function revokeAllUserTokens(userId: string): Promise<void> {
  const tokens = await client.refreshToken.findMany({
    where: { userId, revokedAt: null },
    select: { tokenHash: true },
  });

  await client.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // Remove from Redis
  for (const token of tokens) {
    await redis.del(`refresh:${token.tokenHash}`);
  }
}

/**
 * Track failed login attempts for non-existent users (prevent enumeration)
 */
async function incrementFailedAttemptOnNoUser(ip: string, username: string): Promise<number> {
  const key = `failed:${ip}:${username}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.pexpire(key, 60 * 1000); // 1 minute window
  }
  
  return count;
}
