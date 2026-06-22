import { InferSchemaType, Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
      index: true,
    },
    profile: {
      bio: { type: String, default: '' },
      avatarUrl: { type: String, default: '' },
      timezone: { type: String, default: 'UTC' },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const serialized = ret as Record<string, unknown>;
        serialized.id = String(serialized._id);
        delete serialized._id;
        delete serialized.__v;
        delete serialized.password;
        return ret;
      },
    },
  },
);

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId };
export const User = model('User', userSchema);
