import mongoose, { Schema } from 'mongoose';

export interface ITask extends mongoose.Document {
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    completed: { type: Boolean, default: false },
    dueDate: { type: Date },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

taskSchema.index({ userId: 1, completed: 1, createdAt: -1 });

taskSchema.index({ userId: 1, dueDate: 1 });

export const Task = mongoose.model<ITask>('Task', taskSchema);
