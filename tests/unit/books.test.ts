import express from 'express';
import request from 'supertest';
import { booksRouter } from '../../src/routes/books.routes';
import { books } from '../../src/data/books';
import { errorHandler } from '../../src/middleware/error-handler';

const app = express();
app.use(express.json());
app.use('/api/books', booksRouter);
app.use(errorHandler);

describe('Books endpoints', () => {
  it('GET /api/books returns all books with bookshopUrl', async () => {
    const response = await request(app).get('/api/books');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ books });
  });

  it('GET /api/books/:isbn returns a single book', async () => {
    const response = await request(app).get(`/api/books/${books[0].isbn}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ book: books[0] });
  });

  it('GET /api/books/:isbn returns 404 for unknown ISBN', async () => {
    const response = await request(app).get('/api/books/0000000000000');

    expect(response.status).toBe(404);
  });

  it('GET /api/books/:isbn returns 400 for malformed ISBN', async () => {
    const response = await request(app).get('/api/books/not-an-isbn');

    expect(response.status).toBe(400);
  });
});
