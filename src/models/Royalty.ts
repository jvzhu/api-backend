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
      required: true,
      trim: true,
    },
    period: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'usd',
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
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

royaltySchema.index({ owner: 1, status: 1 });
royaltySchema.index({ owner: 1, source: 1 });
royaltySchema.index({ owner: 1, period: 1 });

export type RoyaltyDocument = InferSchemaType<typeof royaltySchema> & { _id: Schema.Types.ObjectId };
export const Royalty = model('Royalty', royaltySchema);
