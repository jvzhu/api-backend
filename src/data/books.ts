export const BOOKSHOP_LIST_URL = 'https://bookshop.org/lists/eliva-press-catalogue';

export interface Book {
  title: string;
  isbn: string;
  publisher: string;
  bookshopUrl: string;
}

export const books: Book[] = [
  {
    title: "The Visual Ethnographer's Data Other: Secrets Unveiled for a Sociological J. M. Coetzee",
    isbn: '9789999347532',
    publisher: 'Eliva Press',
    bookshopUrl: BOOKSHOP_LIST_URL,
  },
  {
    title: 'Exploring Art, Knowledge and Movement in Japanese Fashion',
    isbn: '9789999325554',
    publisher: 'Eliva Press',
    bookshopUrl: BOOKSHOP_LIST_URL,
  },
  {
    title: 'Sino-Japanese Literature in Perspective: A Short Communication to the World Literature',
    isbn: '9789999338639',
    publisher: 'Eliva Press',
    bookshopUrl: BOOKSHOP_LIST_URL,
  },
];
