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
