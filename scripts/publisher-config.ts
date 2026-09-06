/**
 * Publisher Source Configuration
 * Maps publisher names to expected CSV/PDF column names and parsing templates
 */

export interface PublisherConfig {
  name: string;
  aliases: string[];
  csvColumns: {
    title?: string[];
    isbn?: string[];
    period?: string[];
    amount?: string[];
    currency?: string[];
  };
  pdfPatterns?: {
    isbn?: RegExp;
    amount?: RegExp;
    period?: RegExp;
  };
  notes?: string;
}

export const PUBLISHER_CONFIGS: Record<string, PublisherConfig> = {
  amazon_kdp: {
    name: 'Amazon KDP',
    aliases: ['kdp', 'amazon'],
    csvColumns: {
      title: ['Title', 'product_name', 'book_title'],
      isbn: ['ISBN', 'ISBN-13', 'ASIN'],
      period: ['Reporting Period', 'Period', 'Month'],
      amount: ['Royalty Amount', 'Royalties', 'Earnings'],
      currency: ['Currency', 'Currency Code'],
    },
    pdfPatterns: {
      isbn: /ISBN-13:\s*([\d-]+)/g,
      amount: /Royalties?:\s*\$?([\d,]+\.\d{2})/g,
      period: /(\d{4})-Q([1-4])/i,
    },
    notes: 'KDP reports are typically monthly; uses ISBN-13 as primary identifier',
  },

  smashwords: {
    name: 'Smashwords',
    aliases: ['sw'],
    csvColumns: {
      title: ['Title', 'Book Title', 'Product'],
      isbn: ['ISBN', 'ISBN-13'],
      period: ['Period', 'Month', 'Report Period'],
      amount: ['Earnings', 'Royalties', 'Net Revenue'],
      currency: ['Currency'],
    },
    pdfPatterns: {
      title: /Title:\s*(.+)/,
      amount: /Earnings?:\s*\$?([\d,]+\.\d{2})/g,
    },
    notes: 'Smashwords includes aggregated earnings across all channels',
  },

  draft2digital: {
    name: 'Draft2Digital',
    aliases: ['d2d'],
    csvColumns: {
      title: ['Title', 'Book Name'],
      isbn: ['ISBN'],
      period: ['Period', 'Month'],
      amount: ['Net Revenue', 'Earnings'],
      currency: ['Currency'],
    },
    notes: 'D2D reports distinguish between sales and free distributions',
  },

  ssrn: {
    name: 'SSRN',
    aliases: ['ssrn_royalties', 'ssrn_earnings'],
    csvColumns: {
      title: ['Paper Title', 'Title'],
      isbn: [], // SSRN uses Abstract IDs, not ISBNs
      period: ['Period', 'Month', 'Report Period'],
      amount: ['Downloads Royalty', 'Earnings', 'Amount'],
      currency: ['Currency'],
    },
    pdfPatterns: {
      title: /Title:\s*(.+)/i,
      amount: /Earnings?:\s*\$?([\d,]+\.\d{2})/g,
      period: /(\d{4})-Q([1-4])/i,
    },
    notes: 'SSRN tracks earnings from paper downloads; no ISBN field',
  },

  ingram: {
    name: 'Ingram',
    aliases: ['ingram_spark'],
    csvColumns: {
      title: ['Title', 'Product Title'],
      isbn: ['ISBN', 'ISBN-13'],
      period: ['Period', 'Month'],
      amount: ['Royalties', 'Revenue', 'Net Proceeds'],
      currency: ['Currency'],
    },
    notes: 'Ingram Spark reports for print and ebook distributions',
  },

  google_play: {
    name: 'Google Play Books',
    aliases: ['google_play_books', 'gplay'],
    csvColumns: {
      title: ['Title', 'Book Title'],
      isbn: ['ISBN', 'ISBN-13'],
      period: ['Period', 'Month', 'Reporting Period'],
      amount: ['Earnings', 'Revenue', 'Royalties'],
      currency: ['Currency'],
    },
    notes: 'Google Play reports daily revenue; aggregate by period',
  },

  apple_books: {
    name: 'Apple Books',
    aliases: ['apple', 'ibooks'],
    csvColumns: {
      title: ['Title', 'Book Title'],
      isbn: [],
      period: ['Period', 'Month'],
      amount: ['Royalties', 'Earnings', 'Proceeds'],
      currency: ['Currency'],
    },
    notes: 'Apple Books uses provider-specific identifiers',
  },

  kobo: {
    name: 'Kobo',
    aliases: [],
    csvColumns: {
      title: ['Title'],
      isbn: ['ISBN'],
      period: ['Period'],
      amount: ['Royalties', 'Earnings'],
      currency: ['Currency'],
    },
    notes: 'Kobo provides detailed sales breakdown by region',
  },

  generic: {
    name: 'Generic Publisher',
    aliases: ['unknown', 'other'],
    csvColumns: {
      title: ['title', 'name', 'product'],
      isbn: ['isbn', 'isbn-13', 'id'],
      period: ['period', 'month', 'date'],
      amount: ['amount', 'royalty', 'earnings', 'revenue'],
      currency: ['currency'],
    },
    notes: 'Fallback parser; attempts flexible column matching',
  },
};

/**
 * Find publisher config by name or alias
 */
export function getPublisherConfig(source: string): PublisherConfig {
  const normalized = source.toLowerCase().trim();

  for (const config of Object.values(PUBLISHER_CONFIGS)) {
    if (
      config.name.toLowerCase() === normalized ||
      config.aliases.some((alias) => alias === normalized)
    ) {
      return config;
    }
  }

  return PUBLISHER_CONFIGS.generic;
}

/**
 * Suggest likely column name for a CSV header
 */
export function suggestColumn(columnHeader: string, fieldType: 'title' | 'isbn' | 'period' | 'amount' | 'currency'): string | null {
  const normalized = columnHeader.toLowerCase().trim();

  const allOptions = new Map<'title' | 'isbn' | 'period' | 'amount' | 'currency', string[]>([
    ['title', ['title', 'book', 'product', 'name', 'book_name', 'book_title']],
    ['isbn', ['isbn', 'isbn-13', 'isbn13', 'asin', 'ean']],
    ['period', ['period', 'month', 'date', 'reporting_period', 'report_period', 'reporting period']],
    ['amount', ['amount', 'royalty', 'earnings', 'revenue', 'proceeds', 'royalties', 'net', 'net_proceeds']],
    ['currency', ['currency', 'currency_code', 'currency code', 'curr', 'ccy']],
  ]);

  const options = allOptions.get(fieldType);
  if (!options) return null;

  // Exact match
  if (options.includes(normalized)) return columnHeader;

  // Partial match
  for (const opt of options) {
    if (normalized.includes(opt) || opt.includes(normalized)) {
      return columnHeader;
    }
  }

  return null;
}
