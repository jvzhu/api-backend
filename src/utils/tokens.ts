import jwt, { JwtPayload as BaseJwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { getConfig } from '../config/env';

export type JwtPayload = {
  sub: string;
  email: string;
  role: 'admin' | 'user';
};

type VerifiedJwtPayload = JwtPayload & BaseJwtPayload;

export const signAccessToken = (payload: JwtPayload): string => {
  const config = getConfig();
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.ACCESS_TOKEN_TTL as never,
    jwtid: crypto.randomUUID(),
  });
};

export const signRefreshToken = (payload: JwtPayload): string => {
  const config = getConfig();
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.REFRESH_TOKEN_TTL as never,
    jwtid: crypto.randomUUID(),
  });
};

export const verifyAccessToken = (token: string): VerifiedJwtPayload =>
  jwt.verify(token, getConfig().JWT_ACCESS_SECRET) as VerifiedJwtPayload;

export const verifyRefreshToken = (token: string): VerifiedJwtPayload =>
  jwt.verify(token, getConfig().JWT_REFRESH_SECRET) as VerifiedJwtPayload;

export const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');
