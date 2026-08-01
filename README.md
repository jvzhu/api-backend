# api-backend

Production-ready REST API backend with Express.js, TypeScript, MongoDB, JWT authentication, Swagger docs, Docker, and CI.

## Features

- Express 5 + TypeScript setup
- MongoDB integration with Mongoose models and indexes
- JWT access/refresh token authentication with refresh token revocation
- Role-based access control for admin user management
- User and task CRUD APIs with pagination, filtering, sorting, and caching
- Public books catalogue endpoints (`/books` and `/books/:isbn`)
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

### Books
- `GET /books`
- `GET /books/:isbn`

### Stripe Connect
- `POST /api/stripe/connect/accounts` — create (or return) a Stripe Express connected account
- `POST /api/stripe/connect/onboarding-link` — generate an onboarding link
- `GET /api/stripe/connect/account` — get connected account status
- `POST /api/stripe/webhooks` — Stripe webhook endpoint (handles `transfer.reversed`)

### Royalties
- `POST /api/royalties` — create a royalty entry (amount in minor units; ISBN normalized)
- `GET /api/royalties` — list royalties with pagination, filtering by source/status/period/isbn
- `GET /api/royalties/summary` — totals grouped by currency/status, by source, and by ISBN
- `POST /api/royalties/import` — CSV import (`source,title,isbn,period,amount,currency`; isbn optional; decimal amounts converted to cents; duplicate guard)
- `GET /api/royalties/:id`, `PUT /api/royalties/:id`, `DELETE /api/royalties/:id`

### Payouts
- `POST /api/payouts` — transfer pending royalties to Stripe Express connected account
- `GET /api/payouts` — list payouts with pagination
- `GET /api/payouts/:id` — get a specific payout

## Docker

```bash
docker compose up --build
```

## CI

GitHub Actions runs type-checking, tests, and the production build on pushes and pull requests.
