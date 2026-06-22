import { RefreshToken } from '../models/RefreshToken';
import { User } from '../models/User';
import mongoose from 'mongoose';
import { AppError } from '../utils/app-error';
import { comparePassword, hashPassword } from '../utils/password';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens';

const buildAuthResponse = (user: { id: string; email: string; role: 'admin' | 'user'; name: string; profile?: unknown }, refreshToken: string) => ({
  user,
  accessToken: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
  refreshToken,
});

export const issueTokensForUser = async (user: { id: string; email: string; role: 'admin' | 'user'; name: string; profile?: unknown }) => {
  const refreshToken = signRefreshToken({ sub: user.id, email: user.email, role: user.role });
  const decoded = verifyRefreshToken(refreshToken);
  const expiresAt = new Date((decoded.exp ?? 0) * 1000);

  await RefreshToken.create({
    user: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
  });

  return buildAuthResponse(user, refreshToken);
};

export const registerUser = async (input: { name: string; email: string; password: string }) => {
  const email = String(input.email);
  const existing = await User.findOne(mongoose.sanitizeFilter({ email }));
  if (existing) {
    throw new AppError('A user with that email already exists', 409);
  }

  const user = await User.create({
    ...input,
    email,
    password: await hashPassword(input.password),
  });

  return issueTokensForUser({
    id: String(user._id),
    email: String(user.email),
    role: user.role as 'admin' | 'user',
    name: String(user.name),
    profile: user.profile,
  });
};

export const loginUser = async (input: { email: string; password: string }) => {
  const email = String(input.email);
  const user = await User.findOne(mongoose.sanitizeFilter({ email })).select('+password');
  if (!user || !(await comparePassword(input.password, String(user.password)))) {
    throw new AppError('Invalid email or password', 401);
  }

  return issueTokensForUser({
    id: String(user._id),
    email: String(user.email),
    role: user.role as 'admin' | 'user',
    name: String(user.name),
    profile: user.profile,
  });
};

export const refreshUserTokens = async (refreshToken: string) => {
  const payload = verifyRefreshToken(refreshToken);
  const storedToken = await RefreshToken.findOne({
    tokenHash: hashToken(refreshToken),
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });

  if (!storedToken) {
    throw new AppError('Refresh token is invalid or has been revoked', 401);
  }

  storedToken.isRevoked = true;
  await storedToken.save();

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new AppError('User no longer exists', 401);
  }

  return issueTokensForUser({
    id: String(user._id),
    email: String(user.email),
    role: user.role as 'admin' | 'user',
    name: String(user.name),
    profile: user.profile,
  });
};

export const revokeRefreshToken = async (refreshToken: string): Promise<void> => {
  await RefreshToken.findOneAndUpdate(
    { tokenHash: hashToken(refreshToken) },
    { isRevoked: true },
    { returnDocument: 'after' },
  );
};

export const removeUserTokens = async (userId: string): Promise<void> => {
  await RefreshToken.deleteMany({ user: userId });
};
