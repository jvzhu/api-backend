import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserRole } from '../models/User';

interface TokenPayload {
  sub: string;
  role: UserRole;
}

const accessExpiresIn = env.accessTokenExpiresIn as jwt.SignOptions['expiresIn'];
const refreshExpiresIn = env.refreshTokenExpiresIn as jwt.SignOptions['expiresIn'];

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: accessExpiresIn });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: refreshExpiresIn });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as TokenPayload;
}
