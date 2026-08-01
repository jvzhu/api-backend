# api-backend

Production-ready REST API backend with Express.js, TypeScript, MongoDB, JWT authentication, Swagger docs, Docker, and CI.

## Features

- Express 5 + TypeScript setup
- MongoDB integration with Mongoose models and indexes
- JWT access/refresh token authentication with refresh token revocation
- Role-based access control for admin user management
- User and task CRUD APIs with pagination, filtering, sorting, and caching
- **Royalties ledger** with CSV import, summary aggregation, and status tracking
- **Stripe Connect payouts** — Express account onboarding, Stripe transfers, and webhook handling
- Request validation with Zod
- Global error handling, rate limiting, Helmet, CORS, and request logging
- Swagger UI at `/docs` and OpenAPI JSON at `/docs.json`
- Jest unit + integration tests with in-memory MongoDB
- Dockerfile, docker-compose, and GitHub Actions CI workflow

## Getting started

```bash
cp .env.example .env
npm install
npm run dev
```

The API starts on `http://localhost:3000`.

## Environment variables

See `.env.example` for all supported variables. Stripe-related variables:

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...`) |
| `STRIPE_CONNECT_REFRESH_URL` | Redirect URL when onboarding link expires |
| `STRIPE_CONNECT_RETURN_URL` | Redirect URL after onboarding completes |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`) from Stripe dashboard |

## Scripts

- `npm run dev` - start the development server
- `npm run build` - compile TypeScript to `dist/`
- `npm start` - run the compiled server
- `npm run lint` - type-check the project
- `npm test` - run the Jest test suite
- `npm run test:coverage` - generate coverage output

## API overview

### Health
- `GET /health`

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Users
- `POST /api/users` (admin)
- `GET /api/users` (admin)
- `GET /api/users/:id`
- `PUT /api/users/:id`
- `DELETE /api/users/:id` (admin)
- `GET /api/users/:id/profile`

### Tasks
- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `PATCH /api/tasks/:id/complete`

### Royalties
Amounts are stored in **minor units** (cents). CSV import accepts decimal amounts (e.g., `12.34`) and converts them automatically.

- `POST /api/royalties` — create a royalty entry
- `GET /api/royalties` — list royalties (with `source`, `status`, `period` filters and pagination)
- `GET /api/royalties/summary` — totals by currency and status
- `POST /api/royalties/import` — import from `text/csv` body or multipart file upload
- `GET /api/royalties/:id`
- `PUT /api/royalties/:id`
- `DELETE /api/royalties/:id`

### Payouts
- `POST /api/payouts` — create a Stripe transfer payout for pending royalties
- `GET /api/payouts` — list payouts
- `GET /api/payouts/:id` — payout detail

### Stripe Connect
- `POST /api/stripe/connect/accounts` — create or return Stripe Express account
- `POST /api/stripe/connect/onboarding-link` — generate onboarding URL
- `GET /api/stripe/connect/account` — account status
- `POST /api/stripe/webhooks` — webhook endpoint (handles `transfer.reversed`)

## Docker

```bash
docker compose up --build
```

## CI

GitHub Actions runs type-checking, tests, and the production build on pushes and pull requests.


## Features

- Express 5 + TypeScript setup
- MongoDB integration with Mongoose models and indexes
- JWT access/refresh token authentication with refresh token revocation
- Role-based access control for admin user management
- User and task CRUD APIs with pagination, filtering, sorting, and caching
- Request validation with Zod
- Global error handling, rate limiting, Helmet, CORS, and request logging
- Swagger UI at `/docs` and OpenAPI JSON at `/docs.json`
- Jest unit + integration tests with in-memory MongoDB
- Dockerfile, docker-compose, and GitHub Actions CI workflow

## Getting started

```bash
cp .env.example .env
npm install
npm run dev
```

The API starts on `http://localhost:3000`.

## Environment variables

See `.env.example` for all supported variables.

## Scripts

- `npm run dev` - start the development server
- `npm run build` - compile TypeScript to `dist/`
- `npm start` - run the compiled server
- `npm run lint` - type-check the project
- `npm test` - run the Jest test suite
- `npm run test:coverage` - generate coverage output

## API overview

### Health
- `GET /health`

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Users
- `POST /api/users` (admin)
- `GET /api/users` (admin)
- `GET /api/users/:id`
- `PUT /api/users/:id`
- `DELETE /api/users/:id` (admin)
- `GET /api/users/:id/profile`

### Tasks
- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `PATCH /api/tasks/:id/complete`

## Docker

```bash
docker compose up --build
```

## CI

GitHub Actions runs type-checking, tests, and the production build on pushes and pull requests.
