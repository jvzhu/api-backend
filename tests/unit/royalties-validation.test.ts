import { isbnSchema, normalizeIsbn, csvRowSchema } from '../../src/validators/royalties';

describe('isbnSchema', () => {
  it('accepts a valid 13-digit ISBN with hyphens', () => {
    expect(isbnSchema.safeParse('978-99993-2-555-4').success).toBe(true);
  });

  it('accepts a valid 13-digit ISBN without hyphens', () => {
    expect(isbnSchema.safeParse('9789999325554').success).toBe(true);
  });

  it('accepts a valid 10-digit ISBN', () => {
    expect(isbnSchema.safeParse('0-306-40615-2').success).toBe(true);
  });

  it('accepts ISBN-10 with X check digit', () => {
    expect(isbnSchema.safeParse('0-19-852663-X').success).toBe(true);
  });

  it('accepts ISBN-10 with lowercase x check digit', () => {
    expect(isbnSchema.safeParse('0-19-852663-x').success).toBe(true);
  });

  it('rejects an ISBN with wrong length', () => {
    expect(isbnSchema.safeParse('12345').success).toBe(false);
  });

  it('rejects a non-digit string', () => {
    expect(isbnSchema.safeParse('abc-def-ghi-jk').success).toBe(false);
  });

  it('accepts ISBNs with spaces', () => {
    expect(isbnSchema.safeParse('978 99993 2 555 4').success).toBe(true);
  });
});

describe('normalizeIsbn', () => {
  it('strips hyphens', () => {
    expect(normalizeIsbn('978-99993-2-555-4')).toBe('9789999325554');
  });

  it('strips spaces', () => {
    expect(normalizeIsbn('978 99993 2 555 4')).toBe('9789999325554');
  });

  it('uppercases X check digit', () => {
    expect(normalizeIsbn('0-19-852663-x')).toBe('019852663X');
  });
});

describe('csvRowSchema', () => {
  it('parses a valid row with isbn', () => {
    const result = csvRowSchema.safeParse({
      source: 'Eliva Press',
      title: 'My Book',
      isbn: '978-99993-2-555-4',
      period: '2024',
      amount: '123.45',
      currency: 'usd',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(12345); // converted to cents
      expect(result.data.isbn).toBe('9789999325554'); // normalized
      expect(result.data.currency).toBe('USD'); // uppercased
    }
  });

  it('parses a row without isbn (backward compat)', () => {
    const result = csvRowSchema.safeParse({
      source: 'Bookshop.org',
      title: '',
      isbn: '',
      period: '2026-07',
      amount: '18.50',
      currency: 'usd',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isbn).toBeUndefined();
      expect(result.data.amount).toBe(1850);
    }
  });

  it('rejects a row with invalid amount', () => {
    const result = csvRowSchema.safeParse({
      source: 'Test',
      period: '2024',
      amount: 'not-a-number',
      currency: 'usd',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a row with invalid isbn', () => {
    const result = csvRowSchema.safeParse({
      source: 'Test',
      isbn: '12345',
      period: '2024',
      amount: '10.00',
      currency: 'usd',
    });
    expect(result.success).toBe(false);
  });

  it('defaults currency to USD when missing', () => {
    const result = csvRowSchema.safeParse({
      source: 'Test',
      period: '2024',
      amount: '10.00',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('USD');
    }
  });

  it('converts decimal amount to minor units (cents)', () => {
    const result = csvRowSchema.safeParse({
      source: 'Test',
      period: '2024',
      amount: '9.99',
      currency: 'usd',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(999);
    }
  });
});
