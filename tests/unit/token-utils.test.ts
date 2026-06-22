import { hashToken, signAccessToken, verifyAccessToken } from '../../src/utils/tokens';

describe('token utilities', () => {
  it('signs and verifies access tokens', () => {
    const token = signAccessToken({
      sub: 'user-id',
      email: 'user@example.com',
      role: 'user',
    });

    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-id');
    expect(payload.email).toBe('user@example.com');
  });

  it('hashes tokens deterministically', () => {
    expect(hashToken('refresh-token')).toBe(hashToken('refresh-token'));
  });
});
