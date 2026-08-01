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
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    stripeTransferId: {
      type: String,
      default: null,
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

export type PayoutDocument = InferSchemaType<typeof payoutSchema> & { _id: Schema.Types.ObjectId };
export const Payout = model('Payout', payoutSchema);
