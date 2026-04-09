# imCEO Test Organization Design

**Datum:** 2026-04-09  
**Option:** A - SQLite + Clear Test Structure

---

## Ziele

1. **Keine PostgreSQL-Abhängigkeit** für Tests (SQLite stattdessen)
2. **Klare Trennung** zwischen Unit, Integration und E2E Tests
3. **Schnelle Test-Ausführung** (< 30 Sekunden für alle Unit-Tests)
4. **Einfache CI/CD Integration** (keine Docker-Container nötig)
5. **Konsistente Konfiguration** (nur Vitest, kein Jest-Mix)

---

## Neue Verzeichnisstruktur

```
imCEO/
├── src/                          # Produktionscode (unverändert)
│   ├── application/
│   ├── domain/
│   ├── infrastructure/
│   └── interface/
│
├── tests/                        # NEU: Alle Tests
│   ├── unit/                     # Unit Tests (keine DB)
│   │   ├── services/             # Service-Tests mit Mocks
│   │   │   ├── company.service.test.ts
│   │   │   ├── division.service.test.ts
│   │   │   ├── department.service.test.ts
│   │   │   ├── team.service.test.ts
│   │   │   ├── role-template.service.test.ts
│   │   │   ├── agent-profile.service.test.ts
│   │   │   ├── artifact.service.test.ts
│   │   │   └── work-item.service.test.ts
│   │   └── setup.ts              # Unit-Test-Setup
│   │
│   ├── integration/              # Integration Tests (SQLite)
│   │   ├── routes/               # API Route Tests
│   │   │   ├── company.routes.test.ts
│   │   │   ├── division.routes.test.ts
│   │   │   ├── department.routes.test.ts
│   │   │   ├── team.routes.test.ts
│   │   │   ├── role-template.routes.test.ts
│   │   │   ├── agent-profile.routes.test.ts
│   │   │   ├── work-item.routes.test.ts
│   │   │   ├── artifact.routes.test.ts
│   │   │   ├── policy.routes.test.ts
│   │   │   └── sessions.routes.test.ts
│   │   ├── database/             # SQLite DB-Setup
│   │   │   ├── setup.ts          # DB-Verbindung & Migrations
│   │   │   └── seed.ts           # Test-Daten
│   │   └── setup.ts              # Integration-Test-Setup
│   │
│   └── shared/                   # Gemeinsame Test-Utils
│       ├── mocks/                # Prisma Mocks
│       │   └── prisma.mock.ts
│       └── factories/            # Testdaten-Factories
│           ├── company.factory.ts
│           ├── user.factory.ts
│           └── work-item.factory.ts
│
├── frontend/
│   ├── src/                      # Frontend-Code
│   │   └── components/
│   │
│   ├── tests/                    # NEU: Frontend Tests
│   │   ├── unit/                 # Component Tests
│   │   │   ├── components/
│   │   │   │   ├── WorkItemBoard.test.tsx
│   │   │   │   ├── ArtifactList.test.tsx
│   │   │   │   ├── TeamsList.test.tsx
│   │   │   │   └── ...
│   │   │   └── setup.ts
│   │   └── mocks/                # API & Store Mocks
│   │       ├── api.mock.ts
│   │       └── store.mock.ts
│   │
│   └── e2e/                      # Playwright Tests
│       ├── company-creation.spec.ts
│       ├── organization-hierarchy.spec.ts
│       ├── work-item-kanban.spec.ts
│       └── artifact-management.spec.ts
│
└── prisma/
    ├── schema.prisma             # Produktion (PostgreSQL)
    └── schema.test.prisma        # Tests (SQLite)
```

---

## SQLite Integration

### Warum SQLite?

| Aspekt | PostgreSQL | SQLite |
|--------|-----------|--------|
| Setup | Docker/Service nötig | File-basiert |
| Geschwindigkeit | ~100ms pro Test | ~1ms pro Test |
| CI/CD | Komplex | Trivial |
| Parallelität | Connection Pooling | File-Locks |

### Prisma Schema für Tests

```prisma
// prisma/schema.test.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/test-client"
}

datasource db {
  provider = "sqlite"
  url      = env("TEST_DATABASE_URL")
}

// ... gleiche Models wie schema.prisma
```

### Environment Variables

```bash
# .env.test
TEST_DATABASE_URL="file:./test.db"
NODE_ENV="test"
LOG_LEVEL="error"
```

---

## Test-Kategorien

### 1. Unit Tests (tests/unit/)

**Ziel:** Teste einzelne Funktionen/Methoden in Isolation  
**Datenbank:** Prisma Mock (keine echte DB)  
**Geschwindigkeit:** < 1s pro Test-Datei

```typescript
// tests/unit/services/company.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CompanyService } from '../../../src/application/services/company.service';
import { mockPrisma } from '../../shared/mocks/prisma.mock';

describe('CompanyService', () => {
  const service = new CompanyService();

  it('should create a company with valid data', async () => {
    // Arrange
    const data = { name: 'Test Co' };
    mockPrisma.company.create.mockResolvedValue({ ...data, id: '1' });

    // Act
    const result = await service.create(data);

    // Assert
    expect(result.name).toBe('Test Co');
    expect(mockPrisma.company.create).toHaveBeenCalledWith({ data });
  });
});
```

### 2. Integration Tests (tests/integration/)

**Ziel:** Teste API Endpoints mit echter Datenbank  
**Datenbank:** SQLite (file:./test.db)  
**Geschwindigkeit:** < 5s pro Test-Datei

```typescript
// tests/integration/routes/company.routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestServer } from './helpers/server';
import { prisma } from '../../integration/database/setup';

describe('Company Routes', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await buildTestServer();
    await prisma.$executeRaw`DELETE FROM companies`;
  });

  it('POST /api/v1/companies should create a company', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/companies',
      payload: { name: 'Test Co' },
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.payload).name).toBe('Test Co');
  });
});
```

### 3. E2E Tests (frontend/e2e/)

**Ziel:** Teste komplette User Flows im Browser  
**Werkzeug:** Playwright  
**Datenbank:** Entweder SQLite oder Mock-Server

```typescript
// frontend/e2e/company-creation.spec.ts
import { test, expect } from '@playwright/test';

test('user can create a company', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Create Company');
  await page.fill('input[name="name"]', 'My Company');
  await page.click('button[type="submit"]');
  await expect(page.locator('text=My Company')).toBeVisible();
});
```

---

## Konfiguration

### Backend vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    
    // Unit Tests: Schnell, ohne DB
    include: ['tests/unit/**/*.test.ts'],
    
    // Integration Tests: Mit SQLite
    // Ausgeführt separat: vitest run --config vitest.integration.config.ts
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/test/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
```

### Frontend vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.tsx'],
    deps: {
      inline: ['zustand'],
    },
  },
});
```

---

## NPM Scripts

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration --config vitest.integration.config.ts",
    "test:e2e": "cd frontend && npx playwright test",
    "test:frontend": "cd frontend && vitest run tests/unit",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch tests/unit"
  }
}
```

---

## Migrations-Plan

### Phase 1: Setup (30 Min)
1. SQLite Prisma Schema erstellen
2. Test-Verzeichnisstruktur aufbauen
3. Shared Mocks und Factories erstellen

### Phase 2: Unit Tests (2 Stunden)
1. Bestehende Service-Tests in `tests/unit/services/` verschieben
2. Prisma Mock aktualisieren (Vitest Syntax)
3. Tests laufen lassen und fixen

### Phase 3: Integration Tests (3 Stunden)
1. SQLite Datenbank-Setup erstellen
2. Bestehende Route-Tests in `tests/integration/routes/` verschieben
3. PostgreSQL-Abhängigkeit entfernen
4. Tests mit SQLite laufen lassen

### Phase 4: Frontend Tests (1 Stunde)
1. Component Tests in `frontend/tests/unit/` verschieben
2. Store-Mocking fixen
3. Tests laufen lassen

### Phase 5: Cleanup (30 Min)
1. Jest-Konfiguration entfernen
2. Alte Test-Dateien löschen
3. Dokumentation aktualisieren

---

## Akzeptanzkriterien

- [ ] `npm run test:unit` läuft in < 10 Sekunden
- [ ] `npm run test:integration` läuft in < 60 Sekunden
- [ ] `npm run test:e2e` läuft in < 5 Minuten
- [ ] Keine PostgreSQL-Abhängigkeit für Tests
- [ ] 80%+ Code Coverage
- [ ] Alle Tests sind grün

---

**Empfohlene nächste Schritte:**

1. Dieses Design reviewen und approven
2. Implementation Plan erstellen mit writing-plans skill
3. Team spawnen für die Umsetzung

Soll ich mit dem **Implementation Plan** fortfahren?
