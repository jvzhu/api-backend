import request from 'supertest';
import { createApp } from '../../src/app';
import { books } from '../../src/data/books';

describe('books routes', () => {
  const app = createApp();

  it('returns the full list of books', async () => {
    const response = await request(app).get('/books');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(books);
  });

  it('returns a book by ISBN', async () => {
    const response = await request(app).get(`/books/${books[1].isbn}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(books[1]);
  });

  it('returns 404 for an unknown ISBN', async () => {
    const response = await request(app).get('/books/9780000000000');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Book not found' });
  });

  it('returns 400 for an invalid ISBN', async () => {
    const response = await request(app).get('/books/invalid-isbn');

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
  });
});
