# imCEO Project Guidelines

## Agent Configuration

### Default Model
- Always use `sonnet` model for agents unless otherwise specified
- Model: `accounts/fireworks/routers/kimi-k2p5-turbo`

### Team Management
- When spawning parallel agents, explicitly specify the model
- Use `model: "sonnet"` in Agent tool calls
- Clean up teams properly after task completion

## Project Structure
- Backend: Fastify + Prisma + TypeScript
- Frontend: React + Vite + TypeScript
- Tests: Vitest (unified, no Jest)
- Database: PostgreSQL (production), SQLite (tests)

## Test Organization
- `tests/unit/` - Unit tests with Prisma mocks
- `tests/integration/` - Integration tests with SQLite
- `frontend/tests/unit/` - Frontend component tests
- `frontend/e2e/` - Playwright E2E tests

## SQLite Test Database Setup

The test database uses SQLite instead of PostgreSQL for fast, Docker-free test execution.

### Test Schema Location
- `prisma/schema.test.prisma` - SQLite-compatible Prisma schema
- Generated Prisma Client: Standard location (node_modules/.prisma/client)

### Type Conversions for SQLite
SQLite has limited type support compared to PostgreSQL. The following conversions were made:

| PostgreSQL Type | SQLite Type |
|-----------------|-------------|
| `Enum` | `String` |
| `Json` | `String` |
| `Decimal` | `Float` |
| `@db.Real` | Removed (not supported) |

### Running Tests
```bash
# Validate test schema
DATABASE_URL="file:./tests/test.db" npx prisma validate --schema=prisma/schema.test.prisma

# Push schema to test database
DATABASE_URL="file:./tests/test.db" npx prisma db push --schema=prisma/schema.test.prisma --accept-data-loss

# Run integration tests
npm run test:integration
```
