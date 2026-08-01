import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../helpers/test-app';
import { User } from '../../src/models/User';

const registerAndLogin = async (email: string, password = 'StrongPass1') => {
  await request(app).post('/api/auth/register').send({ name: 'Royalties User', email, password });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.accessToken as string;
};

const authHeader = (token: string) => ({ Authorization: 'Bearer ' + token });

describe('Royalties CRUD', () => {
  let token: string;

  beforeEach(async () => {
    token = await registerAndLogin(`royalties-${Date.now()}@example.com`);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/royalties');
    expect(res.status).toBe(401);
  });

  it('creates a royalty', async () => {
    const res = await request(app)
      .post('/api/royalties')
      .set(authHeader(token))
      .send({
        source: 'Eliva Press',
        title: 'My Book',
        isbn: '978-99993-2-555-4',
        period: '2024',
        amount: 12345,
        currency: 'usd',
      });

    expect(res.status).toBe(201);
    expect(res.body.royalty.source).toBe('Eliva Press');
    expect(res.body.royalty.isbn).toBe('9789999325554'); // normalized
    expect(res.body.royalty.amount).toBe(12345);
    expect(res.body.royalty.status).toBe('pending');
  });

  it('rejects invalid ISBN', async () => {
    const res = await request(app)
      .post('/api/royalties')
      .set(authHeader(token))
      .send({ source: 'Test', isbn: 'bad-isbn', period: '2024', amount: 100, currency: 'usd' });
    expect(res.status).toBe(400);
  });

  it('lists royalties with pagination', async () => {
    await request(app).post('/api/royalties').set(authHeader(token)).send({ source: 'Eliva Press', period: '2024', amount: 1000, currency: 'usd' });
    await request(app).post('/api/royalties').set(authHeader(token)).send({ source: 'Bookshop.org', period: '2026-07', amount: 500, currency: 'usd' });

    const res = await request(app).get('/api/royalties').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.pagination).toBeDefined();
  });

  it('filters by source', async () => {
    await request(app).post('/api/royalties').set(authHeader(token)).send({ source: 'Eliva Press', period: '2024', amount: 1000, currency: 'usd' });
    await request(app).post('/api/royalties').set(authHeader(token)).send({ source: 'Bookshop.org', period: '2026-07', amount: 500, currency: 'usd' });

    const res = await request(app).get('/api/royalties?source=Eliva+Press').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.every((r: { source: string }) => r.source === 'Eliva Press')).toBe(true);
  });

  it('filters by isbn', async () => {
    await request(app).post('/api/royalties').set(authHeader(token)).send({
      source: 'Eliva Press', isbn: '978-99993-2-555-4', period: '2024', amount: 1000, currency: 'usd',
    });
    await request(app).post('/api/royalties').set(authHeader(token)).send({
      source: 'Eliva Press', isbn: '978-99993-3-863-9', period: '2026', amount: 500, currency: 'usd',
    });

    const res = await request(app).get('/api/royalties?isbn=978-99993-2-555-4').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isbn).toBe('9789999325554');
  });

  it('filters by status', async () => {
    await request(app).post('/api/royalties').set(authHeader(token)).send({ source: 'Test', period: '2024', amount: 1000, currency: 'usd' });

    const res = await request(app).get('/api/royalties?status=pending').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.every((r: { status: string }) => r.status === 'pending')).toBe(true);
  });

  it('gets a single royalty by id', async () => {
    const create = await request(app)
      .post('/api/royalties')
      .set(authHeader(token))
      .send({ source: 'Test', period: '2024', amount: 1000, currency: 'usd' });
    const id = create.body.royalty.id as string;

    const res = await request(app).get(`/api/royalties/${id}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.royalty.id).toBe(id);
  });

  it('returns 404 for non-existent royalty', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/royalties/${fakeId}`).set(authHeader(token));
    expect(res.status).toBe(404);
  });

  it('updates a royalty', async () => {
    const create = await request(app)
      .post('/api/royalties')
      .set(authHeader(token))
      .send({ source: 'Test', period: '2024', amount: 1000, currency: 'usd' });
    const id = create.body.royalty.id as string;

    const res = await request(app)
      .put(`/api/royalties/${id}`)
      .set(authHeader(token))
      .send({ amount: 2000 });
    expect(res.status).toBe(200);
    expect(res.body.royalty.amount).toBe(2000);
  });

  it('deletes a royalty', async () => {
    const create = await request(app)
      .post('/api/royalties')
      .set(authHeader(token))
      .send({ source: 'Test', period: '2024', amount: 1000, currency: 'usd' });
    const id = create.body.royalty.id as string;

    const del = await request(app).delete(`/api/royalties/${id}`).set(authHeader(token));
    expect(del.status).toBe(204);

    const get = await request(app).get(`/api/royalties/${id}`).set(authHeader(token));
    expect(get.status).toBe(404);
  });
});

describe('GET /api/royalties/summary', () => {
  let token: string;

  beforeEach(async () => {
    token = await registerAndLogin(`summary-${Date.now()}@example.com`);
  });

  it('returns totals grouped by currency/status, source, and isbn', async () => {
    await request(app).post('/api/royalties').set(authHeader(token)).send({
      source: 'Eliva Press', isbn: '978-99993-2-555-4', period: '2024', amount: 5000, currency: 'usd',
    });
    await request(app).post('/api/royalties').set(authHeader(token)).send({
      source: 'Eliva Press', isbn: '978-99993-2-555-4', period: '2025', amount: 3000, currency: 'usd',
    });
    await request(app).post('/api/royalties').set(authHeader(token)).send({
      source: 'Bookshop.org', period: '2026-07', amount: 1850, currency: 'usd',
    });

    const res = await request(app).get('/api/royalties/summary').set(authHeader(token));
    expect(res.status).toBe(200);

    // byCurrencyStatus
    expect(res.body.byCurrencyStatus).toBeDefined();
    const pendingUsd = res.body.byCurrencyStatus.find(
      (x: { currency: string; status: string }) => x.currency === 'USD' && x.status === 'pending',
    );
    expect(pendingUsd).toBeDefined();
    expect(pendingUsd.total).toBe(9850);

    // bySource — should have both Eliva Press and Bookshop.org
    const sources = res.body.bySource.map((x: { source: string }) => x.source);
    expect(sources).toContain('Eliva Press');
    expect(sources).toContain('Bookshop.org');
    const eliva = res.body.bySource.find((x: { source: string }) => x.source === 'Eliva Press');
    expect(eliva.total).toBe(8000);

    // byIsbn — only entries with ISBN set
    expect(res.body.byIsbn).toHaveLength(1);
    expect(res.body.byIsbn[0].isbn).toBe('9789999325554');
    expect(res.body.byIsbn[0].total).toBe(8000);
  });
});

describe('POST /api/royalties/import', () => {
  let token: string;

  beforeEach(async () => {
    token = await registerAndLogin(`import-${Date.now()}@example.com`);
  });

  it('imports CSV with isbn column', async () => {
    const csv = [
      'source,title,isbn,period,amount,currency',
      'Eliva Press,My Book,978-99993-2-555-4,2024,123.45,usd',
      'Eliva Press,My Book,978-99993-2-555-4,2025,98.70,usd',
      'Eliva Press,Another Book,978-99993-3-863-9,2026,45.00,usd',
    ].join('\n');

    const res = await request(app)
      .post('/api/royalties/import')
      .set(authHeader(token))
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(3);
    expect(res.body.skipped).toBe(0);
    expect(res.body.errors).toHaveLength(0);
  });

  it('imports CSV without isbn column (backward compat)', async () => {
    const csv = [
      'source,title,period,amount,currency',
      'Bookshop.org,Affiliate commissions,2026-07,18.50,usd',
    ].join('\n');

    const res = await request(app)
      .post('/api/royalties/import')
      .set(authHeader(token))
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(1);
    expect(res.body.skipped).toBe(0);
  });

  it('skips duplicate rows (same owner + isbn + period + source)', async () => {
    const csv = [
      'source,title,isbn,period,amount,currency',
      'Eliva Press,My Book,978-99993-2-555-4,2024,123.45,usd',
    ].join('\n');

    // First import
    await request(app)
      .post('/api/royalties/import')
      .set(authHeader(token))
      .set('Content-Type', 'text/csv')
      .send(csv);

    // Second import (same data)
    const res = await request(app)
      .post('/api/royalties/import')
      .set(authHeader(token))
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(0);
    expect(res.body.skipped).toBe(1);
  });

  it('reports errors for invalid rows without aborting', async () => {
    const csv = [
      'source,title,isbn,period,amount,currency',
      'Eliva Press,Good Book,978-99993-2-555-4,2024,123.45,usd',
      'Bad Source,,invalid-isbn,2024,not-a-number,usd',
      'Eliva Press,Another Good,978-99993-3-863-9,2026,50.00,usd',
    ].join('\n');

    const res = await request(app)
      .post('/api/royalties/import')
      .set(authHeader(token))
      .set('Content-Type', 'text/csv')
      .send(csv);

    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('returns 400 when no CSV provided', async () => {
    const res = await request(app)
      .post('/api/royalties/import')
      .set(authHeader(token))
      .send({});

    expect(res.status).toBe(400);
  });
});
