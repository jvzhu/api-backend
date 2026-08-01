export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'API Backend',
    version: '1.0.0',
    description: 'Production-ready REST API backend with authentication, users, and tasks.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development server' }],
  tags: [
    { name: 'Health', description: 'Service health checks' },
    { name: 'Authentication', description: 'Registration, login, refresh, logout, and current user' },
    { name: 'Users', description: 'Administrative user management and profile access' },
    { name: 'Tasks', description: 'Authenticated task management' },
    { name: 'Books', description: 'Public books catalogue access' },
    { name: 'Stripe Connect', description: 'Stripe Express connected account creation and onboarding' },
    { name: 'Royalties', description: 'Royalties ledger with ISBN support and multi-source grouping' },
    { name: 'Payouts', description: 'Stripe Connect payouts for pending royalties' },
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
          refreshToken: { type: 'string', example: '******' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '6650a9cb3bfce3c4b0ef0f77' },
          name: { type: 'string', example: 'Jane Doe' },
          email: { type: 'string', example: 'jane@example.com' },
          role: { type: 'string', example: 'user' },
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
      Book: {
        type: 'object',
        required: ['title', 'isbn', 'publisher'],
        properties: {
          title: { type: 'string' },
          isbn: { type: 'string', example: '9789999347532' },
          publisher: { type: 'string', example: 'Eliva Press' },
          author: { type: 'string', example: 'Vivien Jiaqian Zhu' },
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
              schema: { $ref: '#/components/schemas/RegisterRequest' },
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
              schema: { $ref: '#/components/schemas/LoginRequest' },
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
              schema: { $ref: '#/components/schemas/RefreshTokenRequest' },
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
              schema: { $ref: '#/components/schemas/RefreshTokenRequest' },
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
    '/books': {
      get: {
        tags: ['Books'],
        summary: 'List all books in the catalogue',
        responses: {
          '200': {
            description: 'Books list',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Book' },
                },
              },
            },
          },
        },
      },
    },
    '/books/{isbn}': {
      get: {
        tags: ['Books'],
        summary: 'Get a book by ISBN',
        parameters: [
          {
            name: 'isbn',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^\\d{13}$' },
          },
        ],
        responses: {
          '200': {
            description: 'Book payload',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Book' },
              },
            },
          },
          '400': { description: 'Invalid ISBN format' },
          '404': { description: 'Book not found' },
        },
      },
    },
    '/api/stripe/connect/accounts': {
      post: {
        tags: ['Stripe Connect'],
        summary: 'Create or retrieve a Stripe Express connected account',
        description: 'Creates a new Stripe Express account for the authenticated user and stores its ID. Idempotent — returns the existing account ID if one already exists.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Existing connected account returned', content: { 'application/json': { schema: { type: 'object', properties: { stripeAccountId: { type: 'string', example: 'acct_1ExampleId' } } } } } },
          '201': { description: 'New connected account created', content: { 'application/json': { schema: { type: 'object', properties: { stripeAccountId: { type: 'string', example: 'acct_1ExampleId' } } } } } },
          '401': { description: 'Unauthorized' },
          '502': { description: 'Stripe API error' },
        },
      },
    },
    '/api/stripe/connect/onboarding-link': {
      post: {
        tags: ['Stripe Connect'],
        summary: 'Generate a Stripe Connect onboarding link',
        description: 'Creates an account link for the authenticated user\'s connected account to complete Stripe Express onboarding.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Onboarding link', content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string', example: 'https://connect.stripe.com/setup/e/...' }, expiresAt: { type: 'string', format: 'date-time' } } } } } },
          '401': { description: 'Unauthorized' },
          '404': { description: 'No connected Stripe account found' },
          '502': { description: 'Stripe API error' },
        },
      },
    },
    '/api/stripe/connect/account': {
      get: {
        tags: ['Stripe Connect'],
        summary: 'Get connected account status',
        description: 'Returns the onboarding status of the authenticated user\'s Stripe Express connected account.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Account status', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' }, charges_enabled: { type: 'boolean' }, payouts_enabled: { type: 'boolean' }, details_submitted: { type: 'boolean' } } } } } },
          '401': { description: 'Unauthorized' },
          '404': { description: 'No connected Stripe account found' },
          '502': { description: 'Stripe API error' },
        },
      },
    },
    '/api/royalties': {
      post: {
        tags: ['Royalties'],
        summary: 'Create a royalty entry',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['source', 'period', 'amount'],
                properties: {
                  source: { type: 'string', example: 'Eliva Press' },
                  title: { type: 'string', example: 'Exploring Art, Knowledge and Movement in Japanese Fashion' },
                  isbn: { type: 'string', example: '978-99993-2-555-4' },
                  period: { type: 'string', example: '2024' },
                  amount: { type: 'integer', description: 'Amount in minor units (cents)', example: 12345 },
                  currency: { type: 'string', example: 'USD' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Royalty created' },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthorized' },
        },
      },
      get: {
        tags: ['Royalties'],
        summary: 'List royalties',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'source', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'paid', 'failed'] } },
          { name: 'period', in: 'query', schema: { type: 'string' } },
          { name: 'isbn', in: 'query', schema: { type: 'string' } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', default: 'createdAt' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: {
          '200': { description: 'Paginated list of royalties' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/royalties/summary': {
      get: {
        tags: ['Royalties'],
        summary: 'Get royalties summary',
        description: 'Returns totals grouped by currency/status, by source (e.g. Eliva Press vs Bookshop.org), and by ISBN.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Summary data' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/royalties/import': {
      post: {
        tags: ['Royalties'],
        summary: 'Import royalties from CSV',
        description: 'Accepts a text/csv body or multipart file with columns: source, title, isbn (optional), period, amount, currency. Amounts should be in decimal (e.g. "12.34") and will be converted to minor units.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'text/csv': { schema: { type: 'string' } },
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Import result with imported/skipped/errors counts' },
          '400': { description: 'No CSV data or missing required columns' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/royalties/{id}': {
      get: {
        tags: ['Royalties'],
        summary: 'Get a royalty by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Royalty entry' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Royalty not found' },
        },
      },
      put: {
        tags: ['Royalties'],
        summary: 'Update a royalty',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '200': { description: 'Updated royalty' },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Royalty not found' },
        },
      },
      delete: {
        tags: ['Royalties'],
        summary: 'Delete a royalty',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '204': { description: 'Deleted' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Royalty not found' },
        },
      },
    },
    '/api/payouts': {
      post: {
        tags: ['Payouts'],
        summary: 'Create a payout',
        description: 'Transfers pending royalties to the user\'s Stripe Express connected account.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  royaltyIds: { type: 'array', items: { type: 'string' }, description: 'Specific royalty IDs (omit to pay all pending)' },
                  currency: { type: 'string', example: 'USD' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Payout created and marked paid' },
          '400': { description: 'Validation error' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'No pending royalties or Stripe account not connected' },
          '502': { description: 'Stripe transfer failed' },
        },
      },
      get: {
        tags: ['Payouts'],
        summary: 'List payouts',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['created', 'paid', 'failed'] } },
        ],
        responses: {
          '200': { description: 'Paginated list of payouts' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/payouts/{id}': {
      get: {
        tags: ['Payouts'],
        summary: 'Get a payout by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Payout entry' },
          '401': { description: 'Unauthorized' },
          '404': { description: 'Payout not found' },
        },
      },
    },
    '/api/stripe/webhooks': {
      post: {
        tags: ['Stripe Connect'],
        summary: 'Stripe webhook endpoint',
        description: 'Handles Stripe webhook events. Requires a raw body and valid stripe-signature header. Handles transfer.reversed to revert payout status.',
        parameters: [{ name: 'stripe-signature', in: 'header', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Event received' },
          '400': { description: 'Invalid signature or missing header' },
        },
      },
    },
  },
};
