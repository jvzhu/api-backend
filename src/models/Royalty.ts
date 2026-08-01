import { InferSchemaType, Schema, model } from 'mongoose';

const royaltySchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    isbn: {
      type: String,
      trim: true,
      default: null,
    },
    period: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      uppercase: true,
      default: 'USD',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
      index: true,
    },
    payoutId: {
      type: Schema.Types.ObjectId,
      ref: 'Payout',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const serialized = ret as Record<string, unknown>;
        serialized.id = String(serialized._id);
        serialized.owner =
          serialized.owner && typeof serialized.owner === 'object' && 'toString' in serialized.owner
            ? String(serialized.owner)
            : serialized.owner;
        delete serialized._id;
        delete serialized.__v;
        return ret;
      },
    },
  },
);

royaltySchema.index({ owner: 1, isbn: 1 });
// Enforce duplicate prevention at the DB level; only applies when isbn is set (a string),
// matching the application-side duplicate check during CSV import.
royaltySchema.index(
  { owner: 1, isbn: 1, period: 1, source: 1 },
  { unique: true, partialFilterExpression: { isbn: { $type: 'string' } } },
);

export type RoyaltyDocument = InferSchemaType<typeof royaltySchema> & { _id: Schema.Types.ObjectId };
export const Royalty = model('Royalty', royaltySchema);
