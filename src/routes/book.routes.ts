import { Router } from 'express';
import { validate } from '../middleware/validate';
import { getBookByIsbn, listBooks } from '../services/book-service';
import { AppError } from '../utils/app-error';
import { bookIsbnSchema } from '../validators/books';

export const bookRouter = Router();

bookRouter.get('/', (_req, res) => {
  res.json(listBooks());
});

bookRouter.get('/:isbn', validate(bookIsbnSchema), (req, res) => {
  const book = getBookByIsbn(String(req.params.isbn));
  if (!book) {
    throw new AppError('Book not found', 404);
  }

  res.json(book);
});
