import multer from 'multer';
import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { Royalty } from '../models/Royalty';
import { AppError } from '../utils/app-error';
import {
  createRoyaltySchema,
  csvRowSchema,
  listRoyaltiesSchema,
  royaltyIdSchema,
  updateRoyaltySchema,
} from '../validators/royalties';

export const royaltyRouter = Router();

royaltyRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 },
});

// POST / – create a royalty entry
royaltyRouter.post('/', validate(createRoyaltySchema), async (req, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.role === 'admin';

  const owner = isAdmin && req.body.owner ? req.body.owner : userId;

  const royalty = await Royalty.create({
    owner: new mongoose.Types.ObjectId(String(owner)),
    source: req.body.source,
    title: req.body.title,
    period: req.body.period,
    amount: req.body.amount,
    currency: req.body.currency ?? 'usd',
    status: req.body.status ?? 'pending',
  });

  res.status(201).json({ royalty });
});

// GET /summary – totals by currency and status
royaltyRouter.get('/summary', async (req, res) => {
  const ownerId = new mongoose.Types.ObjectId(req.user!.id);

  const results = await Royalty.aggregate([
    { $match: { owner: ownerId } },
    {
      $group: {
        _id: { currency: '$currency', status: '$status' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.currency',
        statuses: {
          $push: {
            status: '$_id.status',
            total: '$total',
            count: '$count',
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const summary = results.map((r) => ({
    currency: r._id,
    statuses: r.statuses,
  }));

  res.json({ summary });
});

// GET / – list royalties with pagination and filters
royaltyRouter.get('/', validate(listRoyaltiesSchema), async (req, res) => {
  const { page, limit, source, status, period, sortBy, order } = req.query as unknown as {
    page: number;
    limit: number;
    source?: string;
    status?: 'pending' | 'paid' | 'failed';
    period?: string;
    sortBy: string;
    order: 'asc' | 'desc';
  };

  const filter: Record<string, unknown> = { owner: new mongoose.Types.ObjectId(req.user!.id) };
  if (source) filter.source = source;
  if (status) filter.status = status;
  if (period) filter.period = period;

  const safeFilter = mongoose.sanitizeFilter(filter);

  const [data, total] = await Promise.all([
    Royalty.find(safeFilter)
      .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Royalty.countDocuments(safeFilter),
  ]);

  res.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
});

// GET /:id
royaltyRouter.get('/:id', validate(royaltyIdSchema), async (req, res) => {
  const royaltyId = new mongoose.Types.ObjectId(String(req.params.id));
  const isAdmin = req.user!.role === 'admin';
  const ownerId = new mongoose.Types.ObjectId(req.user!.id);

  const filter = isAdmin ? { _id: royaltyId } : { _id: royaltyId, owner: ownerId };
  const royalty = await Royalty.findOne(mongoose.sanitizeFilter(filter));
  if (!royalty) {
    throw new AppError('Royalty not found', 404);
  }

  res.json({ royalty });
});

// PUT /:id
royaltyRouter.put('/:id', validate(updateRoyaltySchema), async (req, res) => {
  const royaltyId = new mongoose.Types.ObjectId(String(req.params.id));
  const isAdmin = req.user!.role === 'admin';
  const ownerId = new mongoose.Types.ObjectId(req.user!.id);

  const filter = isAdmin ? { _id: royaltyId } : { _id: royaltyId, owner: ownerId };
  const royalty = await Royalty.findOne(mongoose.sanitizeFilter(filter));
  if (!royalty) {
    throw new AppError('Royalty not found', 404);
  }

  const updates: Record<string, unknown> = {};
  const allowed = ['source', 'title', 'period', 'amount', 'currency', 'status'] as const;
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  Object.assign(royalty, updates);
  await royalty.save();

  res.json({ royalty });
});

// DELETE /:id
royaltyRouter.delete('/:id', validate(royaltyIdSchema), async (req, res) => {
  const royaltyId = new mongoose.Types.ObjectId(String(req.params.id));
  const isAdmin = req.user!.role === 'admin';
  const ownerId = new mongoose.Types.ObjectId(req.user!.id);

  const filter = isAdmin ? { _id: royaltyId } : { _id: royaltyId, owner: ownerId };
  const royalty = await Royalty.findOneAndDelete(mongoose.sanitizeFilter(filter));
  if (!royalty) {
    throw new AppError('Royalty not found', 404);
  }

  res.status(204).send();
});

// POST /import – CSV import
function parseCSV(csvText: string): Array<Record<string, string>> {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return rows;
}

royaltyRouter.post('/import', upload.single('file'), async (req, res) => {
  let csvText: string | undefined;

  if (req.file) {
    csvText = req.file.buffer.toString('utf-8');
  } else if (
    req.headers['content-type']?.includes('text/csv') ||
    req.headers['content-type']?.includes('text/plain')
  ) {
    csvText = req.body as unknown as string;
  }

  if (!csvText || typeof csvText !== 'string') {
    throw new AppError('CSV body or file required', 400);
  }

  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    throw new AppError('No data rows found in CSV', 400);
  }

  const ownerId = new mongoose.Types.ObjectId(req.user!.id);
  let imported = 0;
  let skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const parsed = csvRowSchema.safeParse(row);
    if (!parsed.success) {
      skipped++;
      errors.push({ row: i + 1, message: parsed.error.issues.map((e: { message: string }) => e.message).join('; ') });
      continue;
    }

    const { source, title, period, amount, currency } = parsed.data;
    await Royalty.create({ owner: ownerId, source, title, period, amount, currency, status: 'pending' });
    imported++;
  }

  res.status(201).json({ imported, skipped, errors });
});
