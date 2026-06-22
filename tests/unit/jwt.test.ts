import { signAccessToken, verifyAccessToken } from '../../src/utils/jwt';

describe('jwt utility', () => {
  test('signs and verifies access token', () => {
    const token = signAccessToken({ sub: 'user-id', role: 'user' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-id');
    expect(payload.role).toBe('user');
  });
});
