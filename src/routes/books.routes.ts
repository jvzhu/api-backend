import { Router } from 'express';
import { books } from '../data/books';
import { AppError } from '../utils/app-error';

export const booksRouter = Router();

booksRouter.get('/', (_req, res) => {
  res.json({ books });
});

booksRouter.get('/:isbn', (req, res) => {
  const { isbn } = req.params;
  if (!/^\d{13}$/.test(isbn)) {
    throw new AppError('Invalid ISBN', 400);
  }

  const book = books.find((b) => b.isbn === isbn);
  if (!book) {
    throw new AppError('Book not found', 404);
  }
  res.json({ book });
});
