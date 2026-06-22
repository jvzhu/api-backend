# api-backend

Production-ready REST API backend with Express.js and TypeScript.

## Features

- Express.js + TypeScript server
- MongoDB with Mongoose models and indexing
- JWT auth with access/refresh tokens and RBAC
- User and Task CRUD APIs with validation and pagination
- Security middleware (helmet, CORS, rate limiting)
- Logging, centralized error handling, and health check endpoint
- Swagger docs at `/docs`
- Unit and integration tests with Jest + Supertest
- Docker + docker-compose setup
- CI workflow with lint/build/test checks

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm start
npm run lint
npm test
```

## API docs

- Swagger UI: `http://localhost:3000/docs`
- Health check: `GET /health`
