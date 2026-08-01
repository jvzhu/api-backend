import request from 'supertest';
import { createApp } from '../../src/app';

describe('books routes', () => {
  const app = createApp();

  it('returns the full list of books', async () => {
    const response = await request(app).get('/books');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        title: "The Visual Ethnographer's Data Other: Secrets Unveiled for a Sociological J. M. Coetzee",
        isbn: '9789999347532',
        publisher: 'Eliva Press',
      },
      {
        title: 'Exploring Art, Knowledge and Movement in Japanese Fashion',
        isbn: '9789999325554',
        publisher: 'Eliva Press',
        author: 'Vivien Jiaqian Zhu',
      },
      {
        title: 'Sino-Japanese Literature in Perspective: A Short Communication to the World Literature',
        isbn: '9789999338639',
        publisher: 'Eliva Press',
      },
    ]);
  });

  it('returns a book by ISBN', async () => {
    const response = await request(app).get('/books/9789999325554');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      title: 'Exploring Art, Knowledge and Movement in Japanese Fashion',
      isbn: '9789999325554',
      publisher: 'Eliva Press',
      author: 'Vivien Jiaqian Zhu',
    });
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
