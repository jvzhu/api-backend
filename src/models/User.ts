import mongoose, { Schema } from 'mongoose';

export type UserRole = 'user' | 'admin';

export interface IUser extends mongoose.Document {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  refreshTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /.+@.+\..+/
    },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    refreshTokens: { type: [String], default: [] }
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model<IUser>('User', userSchema);
