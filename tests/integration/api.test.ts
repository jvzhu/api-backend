import request from 'supertest';
import { app } from '../../src/app';

describe('API integration', () => {
  test('health endpoint responds with service status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptime).toBe('number');
  });

  test('requires auth for protected me endpoint', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Missing bearer token');
  });

  test('returns validation errors for malformed auth request', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 42 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    expect(Array.isArray(response.body.errors)).toBe(true);
  });
});
