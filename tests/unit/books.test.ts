import express from 'express';
import request from 'supertest';
import { booksRouter } from '../../src/routes/books.routes';
import { books, BOOKSHOP_LIST_URL } from '../../src/data/books';
import { errorHandler } from '../../src/middleware/error-handler';

const app = express();
app.use(express.json());
app.use('/api/books', booksRouter);
app.use(errorHandler);

describe('Books endpoints', () => {
  it('GET /api/books returns all books with bookshopUrl', async () => {
    const response = await request(app).get('/api/books');

    expect(response.status).toBe(200);
    expect(response.body.books).toHaveLength(books.length);

    for (const book of response.body.books) {
      expect(book).toMatchObject({
        title: expect.any(String),
        isbn: expect.any(String),
        publisher: expect.any(String),
        bookshopUrl: BOOKSHOP_LIST_URL,
      });
    }
  });

  it('GET /api/books/:isbn returns a single book', async () => {
    const { isbn } = books[0];
    const response = await request(app).get(`/api/books/${isbn}`);

    expect(response.status).toBe(200);
    expect(response.body.book).toMatchObject({
      isbn,
      bookshopUrl: BOOKSHOP_LIST_URL,
    });
  });

  it('GET /api/books/:isbn returns 404 for unknown ISBN', async () => {
    const response = await request(app).get('/api/books/0000000000000');

    expect(response.status).toBe(404);
  });
});
