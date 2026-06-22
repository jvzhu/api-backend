import { InferSchemaType, Schema, model } from 'mongoose';

const taskSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

taskSchema.index({ owner: 1, status: 1, dueDate: -1 });
taskSchema.index({ title: 'text', description: 'text' });

export type TaskDocument = InferSchemaType<typeof taskSchema> & { _id: Schema.Types.ObjectId };
export const Task = model('Task', taskSchema);
