export const idParamSchema = {
  id: { type: 'string' as const, required: true }
};

export const registerSchema = {
  name: { type: 'string' as const, required: true },
  email: { type: 'string' as const, required: true },
  password: { type: 'string' as const, required: true }
};

export const loginSchema = {
  email: { type: 'string' as const, required: true },
  password: { type: 'string' as const, required: true }
};

export const refreshSchema = {
  refreshToken: { type: 'string' as const, required: true }
};

export const userCreateSchema = {
  name: { type: 'string' as const, required: true },
  email: { type: 'string' as const, required: true },
  password: { type: 'string' as const, required: true },
  role: { type: 'string' as const, enum: ['user', 'admin'] }
};

export const userUpdateSchema = {
  name: { type: 'string' as const },
  email: { type: 'string' as const },
  role: { type: 'string' as const, enum: ['user', 'admin'] }
};

export const taskCreateSchema = {
  title: { type: 'string' as const, required: true },
  description: { type: 'string' as const },
  priority: { type: 'string' as const, enum: ['low', 'medium', 'high'] }
};

export const taskUpdateSchema = {
  title: { type: 'string' as const },
  description: { type: 'string' as const },
  priority: { type: 'string' as const, enum: ['low', 'medium', 'high'] },
  completed: { type: 'boolean' as const }
};
