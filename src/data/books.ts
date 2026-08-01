import { Book } from '../types/book';

export const BOOKSHOP_LIST_URL = 'https://bookshop.org/lists/eliva-press-catalogue';
export const THE_VISUAL_ETHNOGRAPHER_BOOKSHOP_URL = 'https://bookshop.org/p/books/the-visual-ethnographer-s-data-other-secrets-unveiled-for-a-sociological-j-m-coetzee-vivien-jiaqian-zhu-26417-22025-20521/e8697433f020833b?ean=9789999347532';

export const books: Book[] = [
  {
    title: "The Visual Ethnographer's Data Other: Secrets Unveiled for a Sociological J. M. Coetzee",
    isbn: '9789999347532',
    publisher: 'Eliva Press',
    author: 'Vivien Jiaqian Zhu',
    bookshopUrl: THE_VISUAL_ETHNOGRAPHER_BOOKSHOP_URL,
  },
  {
    title: 'Exploring Art, Knowledge and Movement in Japanese Fashion',
    isbn: '9789999325554',
    publisher: 'Eliva Press',
    author: 'Vivien Jiaqian Zhu',
    bookshopUrl: BOOKSHOP_LIST_URL,
  },
  {
    title: 'Sino-Japanese Literature in Perspective: A Short Communication to the World Literature',
    isbn: '9789999338639',
    publisher: 'Eliva Press',
    bookshopUrl: BOOKSHOP_LIST_URL,
  },
];
