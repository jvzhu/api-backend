import { books } from '../data/books';
import { Book } from '../types/book';

export const listBooks = (): Book[] => books;

export const getBookByIsbn = (isbn: string): Book | undefined => books.find((book) => book.isbn === isbn);
