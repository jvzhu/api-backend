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
  },
};
