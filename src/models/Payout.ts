import { InferSchemaType, Schema, model } from 'mongoose';

const payoutSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    royalties: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Royalty',
      },
    ],
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      uppercase: true,
      required: true,
      trim: true,
    },
    stripeTransferId: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['created', 'paid', 'failed'],
      default: 'created',
      index: true,
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

// Stripe transfer IDs are globally unique; index keeps webhook lookups fast and
// the unique+sparse constraint prevents two payouts sharing one transfer.
payoutSchema.index({ stripeTransferId: 1 }, { unique: true, sparse: true });

export type PayoutDocument = InferSchemaType<typeof payoutSchema> & { _id: Schema.Types.ObjectId };
export const Payout = model('Payout', payoutSchema);
