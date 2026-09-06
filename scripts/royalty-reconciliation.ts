/**
 * Royalty Reconciliation Script
 * 
 * Automates parsing of royalty CSV/PDF downloads from publishers and cross-references
 * them against the custom ledger (MongoDB Royalty collection). Detects:
 * - New entries to import
 * - Discrepancies (mismatches in amounts, periods, ISBNs)
 * - Duplicates
 * - Missing metadata (titles, ISBNs)
 * 
 * Usage:
 *   npm run reconcile -- --source "Amazon KDP" --file ./downloads/kdp-royalties-2026-Q3.csv
 *   npm run reconcile -- --source "SSRN" --pdf ./downloads/ssrn-statement.pdf --period "2026-Q3"
 *   npm run reconcile -- --dry-run  (preview changes without committing)
 */

import fs from 'fs';
import path from 'path';
import PdfParse from 'pdf-parse';
import mongoose from 'mongoose';
import { Royalty } from '../src/models/Royalty';
import { User } from '../src/models/User';
import { normalizeIsbn } from '../src/validators/royalties';
import { AppError } from '../src/utils/app-error';

interface ReconciliationOptions {
  source: string;
  file?: string;
  pdf?: string;
  period?: string;
  userId?: string;
  dryRun?: boolean;
  discrepancyThreshold?: number; // cents; flag amounts differing by more than this
  outputReport?: string;
}

interface ParsedRoyalty {
  source: string;
  title?: string;
  isbn?: string;
  period: string;
  amount: number; // in cents
  currency: string;
  rawRow?: Record<string, string>; // original parsed data
}

interface ReconciliationReport {
  timestamp: string;
  source: string;
  importedRecords: number;
  skippedRecords: number;
  discrepancies: DiscrepancyRecord[];
  duplicates: DuplicateRecord[];
  missingMetadata: MissingMetadataRecord[];
  newEntries: ParsedRoyalty[];
  summary: {
    totalAmount: number;
    totalRecords: number;
    errorCount: number;
  };
}

interface DiscrepancyRecord {
  row: number;
  parsed: ParsedRoyalty;
  ledger: any;
  type: 'amountMismatch' | 'periodMismatch' | 'isbnMismatch' | 'titleMismatch';
  difference?: number; // for amount mismatches
}

interface DuplicateRecord {
  row: number;
  parsed: ParsedRoyalty;
  existingId: string;
  matchType: 'exact' | 'isbn+period+source' | 'period+source';
}

interface MissingMetadataRecord {
  row: number;
  parsed: ParsedRoyalty;
  missingFields: string[];
}

/**
 * Main reconciliation workflow
 */
export async function reconcile(options: ReconciliationOptions): Promise<ReconciliationReport> {
  console.log(`\n📋 Reconciliation: ${options.source}`);
  console.log(`Dry run: ${options.dryRun ? 'YES' : 'NO'}`);

  const report: ReconciliationReport = {
    timestamp: new Date().toISOString(),
    source: options.source,
    importedRecords: 0,
    skippedRecords: 0,
    discrepancies: [],
    duplicates: [],
    missingMetadata: [],
    newEntries: [],
    summary: { totalAmount: 0, totalRecords: 0, errorCount: 0 },
  };

  try {
    // Step 1: Parse file
    let records: ParsedRoyalty[];
    if (options.file) {
      records = await parseCSV(options.file, options.source, options.period);
    } else if (options.pdf) {
      records = await parsePDF(options.pdf, options.source, options.period);
    } else {
      throw new Error('--file or --pdf required');
    }

    console.log(`✓ Parsed ${records.length} records`);
    report.summary.totalRecords = records.length;

    // Step 2: Resolve user (use CLI arg or prompt)
    const userId = options.userId || (await getUserIdInteractive());
    const user = await User.findById(userId);
    if (!user) throw new Error(`User not found: ${userId}`);

    // Step 3: Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      record.rawRow = record.rawRow || {};

      // Check for missing metadata
      const missingFields = checkMissingMetadata(record);
      if (missingFields.length > 0) {
        report.missingMetadata.push({
          row: i + 1,
          parsed: record,
          missingFields,
        });
      }

      // Check for duplicates in ledger
      const duplicate = await findDuplicate(record, userId);
      if (duplicate) {
        report.duplicates.push({
          row: i + 1,
          parsed: record,
          existingId: String(duplicate._id),
          matchType: 'exact',
        });
        report.skippedRecords++;
        continue;
      }

      // Check for discrepancies with existing records
      const discrepancy = await findDiscrepancy(record, userId, options.discrepancyThreshold || 0);
      if (discrepancy) {
        report.discrepancies.push({
          row: i + 1,
          parsed: record,
          ledger: discrepancy.record,
          type: discrepancy.type,
          difference: discrepancy.difference,
        });
        // Continue processing (don't skip); flag for manual review
      }

      // Mark as new entry
      report.newEntries.push(record);
      report.summary.totalAmount += record.amount;

      if (!options.dryRun) {
        await Royalty.create({
          owner: new mongoose.Types.ObjectId(userId),
          source: record.source,
          title: record.title || '',
          isbn: record.isbn || null,
          period: record.period,
          amount: record.amount,
          currency: record.currency,
          status: 'pending',
        });
        report.importedRecords++;
      }
    }

    // Step 4: Generate report
    if (options.outputReport) {
      writeReport(report, options.outputReport);
    } else {
      console.log('\n' + generateReportSummary(report));
    }

    return report;
  } catch (error) {
    console.error('Reconciliation error:', error);
    throw error;
  }
}

/**
 * Parse CSV file into royalty records
 */
async function parseCSV(
  filePath: string,
  source: string,
  defaultPeriod?: string,
): Promise<ParsedRoyalty[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) throw new Error('CSV must have header + data rows');

  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .reduce(
      (acc, h, i) => {
        acc[h] = i;
        return acc;
      },
      {} as Record<string, number>,
    );

  const records: ParsedRoyalty[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const rowObj: Record<string, string> = {};

    Object.entries(headers).forEach(([header, idx]) => {
      rowObj[header] = cols[idx]?.trim() || '';
    });

    const parsed = parseRoyaltyRow(rowObj, source, defaultPeriod);
    if (parsed) {
      parsed.rawRow = rowObj;
      records.push(parsed);
    }
  }

  return records;
}

/**
 * Parse PDF file (extract tables/text) into royalty records
 * NOTE: PDF parsing is source-specific; customize extractors per publisher
 */
async function parsePDF(
  filePath: string,
  source: string,
  defaultPeriod?: string,
): Promise<ParsedRoyalty[]> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await PdfParse(dataBuffer);
  const text = data.text;

  // Route to source-specific parser
  switch (source.toLowerCase()) {
    case 'amazon kdp':
      return parseAmazonKDPPDF(text, defaultPeriod);
    case 'smashwords':
      return parseSmashwordsPDF(text, defaultPeriod);
    case 'draft2digital':
      return parseDraft2DigitalPDF(text, defaultPeriod);
    case 'ssrn':
      return parseSSRNPDF(text, defaultPeriod);
    default:
      console.warn(`No PDF parser for source: ${source}; attempting generic extraction`);
      return parseGenericPDF(text, source, defaultPeriod);
  }
}

/**
 * Source-specific extractors
 */
function parseAmazonKDPPDF(text: string, period?: string): ParsedRoyalty[] {
  // Example: Extract royalty table from KDP PDF
  // Look for patterns like: "ISBN-13: 978-...", "Royalties: $X.XX", "Period: Q3 2026"
  const records: ParsedRoyalty[] = [];

  // Regex to find ISBN + royalty pairs
  const isbnPattern = /ISBN-13:\s*([\d-]+)/g;
  const royaltyPattern = /Royalties?:\s*\$?([\d,]+\.\d{2})/g;

  const isbns = [...text.matchAll(isbnPattern)].map((m) => m[1]);
  const royalties = [...text.matchAll(royaltyPattern)].map((m) =>
    Math.round(parseFloat(m[1].replace(/,/g, '')) * 100),
  );

  for (let i = 0; i < Math.min(isbns.length, royalties.length); i++) {
    records.push({
      source: 'Amazon KDP',
      isbn: normalizeIsbn(isbns[i]),
      period: period || extractPeriodFromText(text),
      amount: royalties[i],
      currency: 'USD',
    });
  }

  return records;
}

function parseSmashwordsPDF(text: string, period?: string): ParsedRoyalty[] {
  // Example: Extract from Smashwords earnings statement
  const records: ParsedRoyalty[] = [];

  const lines = text.split('\n');
  for (const line of lines) {
    // Smashwords format: "Title | ISBN | Royalty Amount"
    if (line.includes('$')) {
      const match = line.match(/(.+?)\s+(\d[\d-]*)\s+\$?([\d,]+\.\d{2})/);
      if (match) {
        records.push({
          source: 'Smashwords',
          title: match[1].trim(),
          isbn: normalizeIsbn(match[2]),
          period: period || extractPeriodFromText(text),
          amount: Math.round(parseFloat(match[3].replace(/,/g, '')) * 100),
          currency: 'USD',
        });
      }
    }
  }

  return records;
}

function parseDraft2DigitalPDF(text: string, period?: string): ParsedRoyalty[] {
  // Implement Draft2Digital-specific parsing
  return [];
}

function parseSSRNPDF(text: string, period?: string): ParsedRoyalty[] {
  // SSRN royalty statements typically show: paper title, abstract ID, earnings
  const records: ParsedRoyalty[] = [];

  const lines = text.split('\n');
  for (const line of lines) {
    // Pattern: "Abstract #### | Title | $X.XX"
    const match = line.match(/Abstract\s+(\d+)\s+\|\s+(.+?)\s+\|\s+\$?([\d,]+\.\d{2})/);
    if (match) {
      records.push({
        source: 'SSRN',
        title: match[2].trim(),
        period: period || extractPeriodFromText(text),
        amount: Math.round(parseFloat(match[3].replace(/,/g, '')) * 100),
        currency: 'USD',
      });
    }
  }

  return records;
}

function parseGenericPDF(text: string, source: string, period?: string): ParsedRoyalty[] {
  // Last-resort parser: look for currency amounts
  const records: ParsedRoyalty[] = [];

  const amountPattern = /\$?([\d,]+\.\d{2})/g;
  const amounts = [...text.matchAll(amountPattern)].map((m) =>
    Math.round(parseFloat(m[1].replace(/,/g, '')) * 100),
  );

  amounts.forEach((amount) => {
    records.push({
      source,
      period: period || 'unknown',
      amount,
      currency: 'USD',
    });
  });

  return records;
}

/**
 * Parse a single royalty row from CSV (flexible schema detection)
 */
function parseRoyaltyRow(
  row: Record<string, string>,
  source: string,
  defaultPeriod?: string,
): ParsedRoyalty | null {
  // Map flexible column names to standard fields
  const getField = (names: string[]) => names.find((n) => row[n] || row[n.toLowerCase()] !== undefined);

  const titleCol = getField(['title', 'book_title', 'product_name', 'name']);
  const isbnCol = getField(['isbn', 'isbn-13', 'isbn13']);
  const periodCol = getField(['period', 'month', 'date', 'reporting_period']);
  const amountCol = getField(['amount', 'royalty', 'earnings', 'revenue']);
  const currencyCol = getField(['currency', 'currency_code']);

  const amount = parseAmount(row[amountCol || ''] || '');
  const period = (periodCol && row[periodCol]) || defaultPeriod || new Date().toISOString().slice(0, 7);

  if (!amount || !period) return null;

  return {
    source,
    title: titleCol ? row[titleCol] : undefined,
    isbn: isbnCol && row[isbnCol] ? normalizeIsbn(row[isbnCol]) : undefined,
    period,
    amount,
    currency: (currencyCol && row[currencyCol]?.toUpperCase()) || 'USD',
  };
}

/**
 * Check if parsed record has missing required metadata
 */
function checkMissingMetadata(record: ParsedRoyalty): string[] {
  const missing = [];
  if (!record.title) missing.push('title');
  if (!record.isbn) missing.push('isbn');
  return missing;
}

/**
 * Find exact duplicates in ledger
 */
async function findDuplicate(record: ParsedRoyalty, userId: string): Promise<any | null> {
  const query: Record<string, any> = {
    owner: new mongoose.Types.ObjectId(userId),
    source: record.source,
    period: record.period,
  };

  // If ISBN available, use as primary key
  if (record.isbn) {
    query.isbn = record.isbn;
    const dup = await Royalty.findOne(query);
    if (dup) return dup;
  }

  // Fallback: match on source + period + amount (within 1 cent tolerance)
  if (record.title) {
    const dup = await Royalty.findOne({
      owner: new mongoose.Types.ObjectId(userId),
      source: record.source,
      period: record.period,
      title: record.title,
      amount: { $gte: record.amount - 1, $lte: record.amount + 1 },
    });
    if (dup) return dup;
  }

  return null;
}

/**
 * Find similar records that may have discrepancies
 */
async function findDiscrepancy(
  record: ParsedRoyalty,
  userId: string,
  thresholdCents: number = 0,
): Promise<{ type: string; record: any; difference?: number } | null> {
  const owner = new mongoose.Types.ObjectId(userId);

  // Search 1: Same ISBN + period, different amount
  if (record.isbn) {
    const candidates = await Royalty.find({
      owner,
      isbn: record.isbn,
      period: record.period,
    });

    for (const cand of candidates) {
      const diff = Math.abs((cand.amount as number) - record.amount);
      if (diff > thresholdCents && diff > 0) {
        return {
          type: 'amountMismatch',
          record: cand,
          difference: diff,
        };
      }
    }
  }

  // Search 2: Same title + period, different ISBN
  if (record.title) {
    const cand = await Royalty.findOne({
      owner,
      title: record.title,
      period: record.period,
      source: record.source,
    });
    if (cand && cand.isbn && cand.isbn !== record.isbn) {
      return {
        type: 'isbnMismatch',
        record: cand,
      };
    }
  }

  return null;
}

/**
 * Utility: Parse currency amount (handles $1,234.56 format)
 */
function parseAmount(amountStr: string): number | null {
  const match = amountStr.match(/[\d,]+\.?\d*/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(/,/g, ''));
  return isNaN(num) ? null : Math.round(num * 100); // Convert to cents
}

/**
 * Utility: Extract period/date from text (YYYY-MM, YYYY-Q#, etc.)
 */
function extractPeriodFromText(text: string): string {
  // Try YYYY-QX format
  const qMatch = text.match(/(\d{4})-Q([1-4])/i);
  if (qMatch) return `${qMatch[1]}-Q${qMatch[2]}`;

  // Try YYYY-MM format
  const mmMatch = text.match(/(\d{4})-(\d{2})/);
  if (mmMatch) return `${mmMatch[1]}-${mmMatch[2]}`;

  // Default to current month
  return new Date().toISOString().slice(0, 7);
}

/**
 * Utility: Parse CSV line (handles quoted fields)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Generate human-readable report summary
 */
function generateReportSummary(report: ReconciliationReport): string {
  return `
📊 Reconciliation Report: ${report.source}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Imported: ${report.importedRecords} records
⊘ Skipped: ${report.skippedRecords} records (duplicates)
⚠ Discrepancies: ${report.discrepancies.length}
⚠ Missing metadata: ${report.missingMetadata.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total amount: $${(report.summary.totalAmount / 100).toFixed(2)}
Processing time: ${new Date(report.timestamp).toLocaleString()}

${
  report.discrepancies.length > 0
    ? `⚠ DISCREPANCIES (review manually):\n${report.discrepancies
        .slice(0, 5)
        .map(
          (d) =>
            `  Row ${d.row}: ${d.type} — parsed $${(d.parsed.amount / 100).toFixed(2)} vs. ledger $${((d.ledger.amount as number) / 100).toFixed(2)}`,
        )
        .join('\n')}\n`
    : ''
}

${
  report.missingMetadata.length > 0
    ? `⚠ MISSING METADATA (auto-import, but review):\n${report.missingMetadata
        .slice(0, 5)
        .map((m) => `  Row ${m.row}: missing ${m.missingFields.join(', ')}`)
        .join('\n')}\n`
    : ''
}
`;
}

/**
 * Write detailed JSON report
 */
function writeReport(report: ReconciliationReport, outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ Report written to ${outputPath}`);
}

/**
 * Interactive user selection (CLI)
 */
async function getUserIdInteractive(): Promise<string> {
  // In a real scenario, prompt the user or read from env
  const users = await User.find().select('_id email role');
  if (users.length === 0) throw new Error('No users found');
  if (users.length === 1) return String(users[0]._id);

  console.log('\nSelect user:');
  users.forEach((u, i) => console.log(`  ${i + 1}. ${u.email} (${u.role})`));
  // In production, use `prompt()` or similar
  return String(users[0]._id);
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2).reduce(
    (acc, arg) => {
      const [key, val] = arg.split('=');
      acc[key.replace(/^--/, '')] = val || true;
      return acc;
    },
    {} as Record<string, string | boolean>,
  );

  mongoose
    .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/api-backend')
    .then(() =>
      reconcile({
        source: (args.source as string) || 'Unknown',
        file: args.file as string,
        pdf: args.pdf as string,
        period: args.period as string,
        userId: args.userId as string,
        dryRun: args['dry-run'] === 'true',
        outputReport: args.outputReport as string,
      }),
    )
    .then((report) => {
      console.log('\n✓ Reconciliation complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
}

export { ReconciliationOptions, ParsedRoyalty, ReconciliationReport };
