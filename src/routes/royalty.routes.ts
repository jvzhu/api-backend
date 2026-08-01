import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Royalty } from '../models/Royalty';
import { AppError } from '../utils/app-error';
import { csvRowSchema, createRoyaltySchema, listRoyaltiesSchema, royaltyIdSchema, updateRoyaltySchema } from '../validators/royalties';

export const royaltyRouter = Router();

royaltyRouter.use(requireAuth);

const MAX_CSV_LINES = 10000;
const MAX_CSV_LINE_LENGTH = 10000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

// POST /api/royalties
royaltyRouter.post('/', validate(createRoyaltySchema), async (req, res) => {
  const isAdmin = req.user!.role === 'admin';
  const ownerId = isAdmin && req.body.owner ? req.body.owner : req.user!.id;

  const royalty = await Royalty.create({
    ...req.body,
    owner: new mongoose.Types.ObjectId(ownerId),
  });

  res.status(201).json({ royalty });
});

// GET /api/royalties
royaltyRouter.get('/', validate(listRoyaltiesSchema), async (req, res) => {
  const { page, limit, source, status, period, isbn, sortBy, order } = req.query as unknown as {
    page: number;
    limit: number;
    source?: string;
    status?: 'pending' | 'paid' | 'failed';
    period?: string;
    isbn?: string;
    sortBy: string;
    order: 'asc' | 'desc';
  };

  const isAdmin = req.user!.role === 'admin';
  const filter: Record<string, unknown> = isAdmin ? {} : { owner: new mongoose.Types.ObjectId(req.user!.id) };

  if (source) filter.source = source;
  if (status) filter.status = status;
  if (period) filter.period = period;
  if (isbn) filter.isbn = isbn.replace(/[-\s]/g, '').toUpperCase();

  const safeFilter = mongoose.sanitizeFilter(filter);

  const [royalties, total] = await Promise.all([
    Royalty.find(safeFilter)
      .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Royalty.countDocuments(safeFilter),
  ]);

  res.json({
    data: royalties,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

// GET /api/royalties/summary — must be before /:id
royaltyRouter.get('/summary', async (req, res) => {
  const isAdmin = req.user!.role === 'admin';
  const ownerMatch = isAdmin ? {} : { owner: new mongoose.Types.ObjectId(req.user!.id) };

  const [byCurrencyStatus, bySource, byIsbn] = await Promise.all([
    // Group by currency + status
    Royalty.aggregate([
      { $match: ownerMatch },
      {
        $group: {
          _id: { currency: '$currency', status: '$status' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          currency: '$_id.currency',
          status: '$_id.status',
          total: 1,
          count: 1,
        },
      },
      { $sort: { currency: 1, status: 1 } },
    ]),
    // Group by source
    Royalty.aggregate([
      { $match: ownerMatch },
      {
        $group: {
          _id: '$source',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, source: '$_id', total: 1, count: 1 } },
      { $sort: { source: 1 } },
    ]),
    // Group by isbn (only where isbn is set)
    Royalty.aggregate([
      { $match: { ...ownerMatch, isbn: { $ne: null } } },
      {
        $group: {
          _id: '$isbn',
          title: { $first: '$title' },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          periods: { $addToSet: '$period' },
        },
      },
      { $project: { _id: 0, isbn: '$_id', title: 1, total: 1, count: 1, periods: 1 } },
      { $sort: { isbn: 1 } },
    ]),
  ]);

  res.json({ byCurrencyStatus, bySource, byIsbn });
});

// GET /api/royalties/:id
royaltyRouter.get('/:id', validate(royaltyIdSchema), async (req, res) => {
  const royaltyId = new mongoose.Types.ObjectId(String(req.params.id));
  const isAdmin = req.user!.role === 'admin';
  const filter: Record<string, unknown> = { _id: royaltyId };
  if (!isAdmin) filter.owner = new mongoose.Types.ObjectId(req.user!.id);

  const royalty = await Royalty.findOne(filter);
  if (!royalty) {
    throw new AppError('Royalty not found', 404);
  }

  res.json({ royalty });
});

// PUT /api/royalties/:id
royaltyRouter.put('/:id', validate(updateRoyaltySchema), async (req, res) => {
  const royaltyId = new mongoose.Types.ObjectId(String(req.params.id));
  const isAdmin = req.user!.role === 'admin';
  const filter: Record<string, unknown> = { _id: royaltyId };
  if (!isAdmin) filter.owner = new mongoose.Types.ObjectId(req.user!.id);

  const royalty = await Royalty.findOne(filter);
  if (!royalty) {
    throw new AppError('Royalty not found', 404);
  }

  Object.assign(royalty, req.body);
  await royalty.save();

  res.json({ royalty });
});

// DELETE /api/royalties/:id
royaltyRouter.delete('/:id', validate(royaltyIdSchema), async (req, res) => {
  const royaltyId = new mongoose.Types.ObjectId(String(req.params.id));
  const isAdmin = req.user!.role === 'admin';
  const filter: Record<string, unknown> = { _id: royaltyId };
  if (!isAdmin) filter.owner = new mongoose.Types.ObjectId(req.user!.id);

  const royalty = await Royalty.findOneAndDelete(filter);
  if (!royalty) {
    throw new AppError('Royalty not found', 404);
  }

  res.status(204).send();
});

// POST /api/royalties/import
royaltyRouter.post('/import', upload.single('file'), async (req, res) => {
  let csvText: string;

  if (req.file) {
    csvText = req.file.buffer.toString('utf-8');
  } else if (typeof req.body === 'string' && req.body.length > 0) {
    csvText = req.body;
  } else if (req.headers['content-type']?.startsWith('text/csv')) {
    // Body parsed as raw buffer or string when content-type is text/csv
    csvText = req.body as string;
  } else {
    throw new AppError('No CSV data provided. Send as text/csv body or multipart file field "file"', 400);
  }

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new AppError('CSV must have a header row and at least one data row', 400);
  }
  if (lines.length > MAX_CSV_LINES) {
    throw new AppError(`CSV has too many rows (max ${MAX_CSV_LINES})`, 400);
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const requiredHeaders = ['source', 'period', 'amount'];
  const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new AppError(`CSV missing required columns: ${missingHeaders.join(', ')}`, 400);
  }

  const ownerId = new mongoose.Types.ObjectId(req.user!.id);

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; error: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.length > MAX_CSV_LINE_LENGTH) {
      errors.push({ row: i + 1, error: `Row exceeds maximum length of ${MAX_CSV_LINE_LENGTH} characters` });
      skipped++;
      continue;
    }

    // Simple CSV parse (handles basic quoted fields)
    const values = parseCSVLine(line);
    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx] ?? '';
    });

    const parsed = csvRowSchema.safeParse(rowObj);
    if (!parsed.success) {
      errors.push({ row: i + 1, error: parsed.error.flatten().fieldErrors ? JSON.stringify(parsed.error.flatten().fieldErrors) : parsed.error.message });
      continue;
    }

    const { source, title, isbn, period, amount, currency } = parsed.data;

    // Duplicate check when isbn is present
    if (isbn) {
      const exists = await Royalty.exists({
        owner: ownerId,
        isbn,
        period,
        source,
      });
      if (exists) {
        skipped++;
        continue;
      }
    }

    await Royalty.create({
      owner: ownerId,
      source,
      title,
      isbn: isbn ?? null,
      period,
      amount,
      currency,
    });
    imported++;
  }

  res.status(201).json({ imported, skipped, errors });
});

/** Minimal CSV line parser — handles simple comma-separated values and basic double-quoted fields */
function parseCSVLine(line: string): string[] {
  if (typeof line !== 'string') {
    throw new AppError('Invalid CSV row type', 400);
  }
  if (line.length > MAX_CSV_LINE_LENGTH) {
    throw new AppError(`CSV row exceeds maximum length of ${MAX_CSV_LINE_LENGTH} characters`, 400);
  }

  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  // Cap iteration to prevent excessive processing of oversized user-supplied lines
  const maxLen = Math.min(line.length, 5000);

  for (let i = 0; i < maxLen; i++) {
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
