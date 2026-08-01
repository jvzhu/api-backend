export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'API Backend',
    version: '1.0.0',
    description: 'Production-ready REST API backend with authentication, users, tasks, royalties, and payouts.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development server' }],
  tags: [
    { name: 'Health', description: 'Service health checks' },
    { name: 'Authentication', description: 'Registration, login, refresh, logout, and current user' },
    { name: 'Users', description: 'Administrative user management and profile access' },
    { name: 'Tasks', description: 'Authenticated task management' },
    { name: 'Royalties', description: 'Royalty ledger management with CSV import and summaries' },
    { name: 'Payouts', description: 'Stripe Connect payouts for accumulated royalties' },
    { name: 'Stripe', description: 'Stripe Connect onboarding and webhook handling' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', example: 'Jane Doe' },
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          password: { type: 'string', example: 'StrongPass1' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          password: { type: 'string', example: 'StrongPass1' },
        },
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string', example: 'replace-me' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '6650a9cb3bfce3c4b0ef0f77' },
          name: { type: 'string', example: 'Jane Doe' },
          email: { type: 'string', example: 'jane@example.com' },
          role: { type: 'string', example: 'user' },
          stripeAccountId: { type: 'string', nullable: true, example: 'acct_1TeL4n...' },
          profile: {
            type: 'object',
            properties: {
              bio: { type: 'string', example: 'Backend engineer' },
              avatarUrl: { type: 'string', example: 'https://example.com/avatar.png' },
              timezone: { type: 'string', example: 'UTC' },
            },
          },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string', example: 'Ship API docs' },
          description: { type: 'string', example: 'Publish Swagger docs before release.' },
          status: { type: 'string', example: 'pending' },
          priority: { type: 'string', example: 'high' },
          dueDate: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
          owner: { type: 'string' },
        },
      },
      Royalty: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          owner: { type: 'string', example: '6650a9cb3bfce3c4b0ef0f77' },
          source: { type: 'string', example: 'Eliva Press' },
          title: { type: 'string', example: 'My Book' },
          period: { type: 'string', example: '2026-06' },
          amount: { type: 'integer', description: 'Amount in minor units (cents)', example: 1234 },
          currency: { type: 'string', example: 'usd' },
          status: { type: 'string', enum: ['pending', 'paid', 'failed'], example: 'pending' },
          payoutId: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Payout: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          owner: { type: 'string' },
          royalties: { type: 'array', items: { type: 'string' } },
          amount: { type: 'integer', description: 'Total amount in minor units (cents)', example: 5000 },
          currency: { type: 'string', example: 'usd' },
          stripeTransferId: { type: 'string', nullable: true, example: 'tr_...' },
          status: { type: 'string', enum: ['created', 'paid', 'failed'], example: 'paid' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check API health',
        responses: {
          '200': {
            description: 'API health payload',
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '201': { description: 'User registered successfully' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login and receive JWT tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Authentication succeeded' },
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh an access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/RefreshTokenRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Tokens rotated successfully' },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout and revoke a refresh token',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { '$ref': '#/components/schemas/RefreshTokenRequest' },
            },
          },
        },
        responses: {
          '204': { description: 'Logout succeeded' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Current user profile' },
        },
      },
    },
    '/api/users': {
      post: {
        tags: ['Users'],
        summary: 'Create a new user (admin only)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'User created' } },
      },
      get: {
        tags: ['Users'],
        summary: 'List users with pagination (admin only)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated users' } },
      },
    },
    '/api/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get a user by ID',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'User payload' } },
      },
      put: {
        tags: ['Users'],
        summary: 'Update a user by ID',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Updated user payload' } },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete a user by ID',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'User deleted' } },
      },
    },
    '/api/users/{id}/profile': {
      get: {
        tags: ['Users'],
        summary: 'Get extended user profile information',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'User profile summary' } },
      },
    },
    '/api/tasks': {
      post: {
        tags: ['Tasks'],
        summary: 'Create a task',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Task created' } },
      },
      get: {
        tags: ['Tasks'],
        summary: 'List tasks for the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated tasks' } },
      },
    },
    '/api/tasks/{id}': {
      get: {
        tags: ['Tasks'],
        summary: 'Get a task by ID',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Task payload' } },
      },
      put: {
        tags: ['Tasks'],
        summary: 'Update a task by ID',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Updated task payload' } },
      },
      delete: {
        tags: ['Tasks'],
        summary: 'Delete a task by ID',
        security: [{ bearerAuth: [] }],
        responses: { '204': { description: 'Task deleted' } },
      },
    },
    '/api/tasks/{id}/complete': {
      patch: {
        tags: ['Tasks'],
        summary: 'Mark a task as complete',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Task marked complete' } },
      },
    },
    '/api/royalties': {
      post: {
        tags: ['Royalties'],
        summary: 'Create a royalty entry',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Royalty created' } },
      },
      get: {
        tags: ['Royalties'],
        summary: 'List royalties for the authenticated user',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'source', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'paid', 'failed'] } },
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'createdAt' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: { '200': { description: 'Paginated royalties' } },
      },
    },
    '/api/royalties/summary': {
      get: {
        tags: ['Royalties'],
        summary: 'Get royalty totals grouped by currency and status',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Royalty summary' } },
      },
    },
    '/api/royalties/import': {
      post: {
        tags: ['Royalties'],
        summary: 'Import royalties from a CSV file',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Import result with imported, skipped, and errors counts' } },
      },
    },
    '/api/royalties/{id}': {
      get: {
        tags: ['Royalties'],
        summary: 'Get a royalty by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Royalty payload' }, '404': { description: 'Not found' } },
      },
      put: {
        tags: ['Royalties'],
        summary: 'Update a royalty by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Updated royalty' }, '404': { description: 'Not found' } },
      },
      delete: {
        tags: ['Royalties'],
        summary: 'Delete a royalty by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } },
      },
    },
    '/api/payouts': {
      post: {
        tags: ['Payouts'],
        summary: 'Create a Stripe payout for pending royalties',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Payout created' },
          '400': { description: 'No pending royalties or validation error' },
          '404': { description: 'Stripe account not connected' },
          '502': { description: 'Stripe transfer failed' },
        },
      },
      get: {
        tags: ['Payouts'],
        summary: 'List payouts for the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated payouts' } },
      },
    },
    '/api/payouts/{id}': {
      get: {
        tags: ['Payouts'],
        summary: 'Get a payout by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Payout detail' }, '404': { description: 'Not found' } },
      },
    },
    '/api/stripe/connect/accounts': {
      post: {
        tags: ['Stripe'],
        summary: 'Create or return an existing Stripe Express connected account',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Account ID returned' } },
      },
    },
    '/api/stripe/connect/onboarding-link': {
      post: {
        tags: ['Stripe'],
        summary: 'Generate a Stripe Connect onboarding URL',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Onboarding URL' } },
      },
    },
    '/api/stripe/connect/account': {
      get: {
        tags: ['Stripe'],
        summary: 'Get Stripe connected account status',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Account status' }, '404': { description: 'Account not connected' } },
      },
    },
    '/api/stripe/webhooks': {
      post: {
        tags: ['Stripe'],
        summary: 'Stripe webhook endpoint',
        description: 'Handles transfer.reversed events to revert payouts and royalties.',
        responses: { '200': { description: 'Event received' }, '400': { description: 'Signature verification failed' } },
      },
    },
  },
};
