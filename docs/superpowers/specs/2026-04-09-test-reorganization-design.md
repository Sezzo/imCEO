# Test-Reorganisation mit SQLite - Design Document

**Datum:** 2026-04-09  
**Author:** Claude Code  
**Status:** Approved

---

## 1. Executive Summary

Dieses Dokument beschreibt die Reorganisation der imCEO-Teststruktur. Die Hauptziele sind:
- Umstellung von PostgreSQL auf SQLite für Tests
- Klare Trennung zwischen Unit-, Integration- und E2E-Tests
- Vereinheitlichung auf Vitest (keine Jest/Vitest-Konflikte mehr)
- Schnelle, zuverlässige Test-Ausführung ohne Docker

---

## 2. Current State Analysis

### 2.1 Bestehende Probleme

| Problem | Impact | Frequency |
|---------|--------|-----------|
| PostgreSQL-Abhängigkeit | Tests hängen/fail ohne DB | Always |
| Jest/Vitest gemischt | Konfigurationskonflikte | Always |
| Tests in `src/` gemischt | Unübersichtliche Struktur | Always |
| Keine klare Trennung | Unit vs Integration unklar | Often |

### 2.2 Bestehende Test-Dateien

**Backend (18 Dateien):**
- 8 Service Tests in `src/application/services/`
- 10 Route Tests in `src/interface/http/routes/`

**Frontend (9 Dateien):**
- 9 Component Tests in `frontend/src/components/**/*.test.tsx`

**E2E (4 Dateien):**
- 4 Playwright Specs in `frontend/e2e/`

---

## 3. Proposed Solution

### 3.1 Architecture

```
imCEO/
├── src/                          # Produktionscode (keine Tests)
├── tests/                        # Backend Tests
│   ├── unit/                     # Service Tests mit Prisma Mock
│   ├── integration/              # API Tests mit SQLite
│   ├── setup.ts                  # Globales Test Setup
│   └── database.ts               # SQLite Test Database Helper
├── frontend/
│   ├── src/                      # Frontend Produktionscode
│   ├── tests/unit/               # Component Tests
│   └── e2e/                      # Playwright Tests
├── vitest.config.ts              # Einheitliche Konfiguration
└── package.json                  # Bereinigte Scripts
```

### 3.2 Database Strategy

| Test Type | Database | Rationale |
|-----------|----------|-----------|
| Unit Tests | Prisma Mock | Fast, isolated, no DB needed |
| Integration Tests | SQLite (file) | Real DB operations, no Docker |
| E2E Tests | SQLite (file) | Full API tests with real server |

### 3.3 Technology Stack

- **Test Runner:** Vitest (einheitlich für Backend & Frontend)
- **Mocking:** Vitest built-in mocks
- **Database:** SQLite via Prisma
- **E2E:** Playwright
- **Coverage:** Vitest v8 provider

---

## 4. Implementation Details

### 4.1 Test Categories

#### Unit Tests (`tests/unit/`)
- **Scope:** Service-Logik in Isolation
- **Mocking:** Prisma Client vollständig gemockt
- **Speed:** < 100ms pro Test
- **Count:** 8 Test-Dateien

#### Integration Tests (`tests/integration/`)
- **Scope:** API Routes mit echtem HTTP + SQLite
- **Setup:** Fastify Server + SQLite DB
- **Speed:** < 500ms pro Test
- **Count:** 10 Test-Dateien

#### E2E Tests (`frontend/e2e/`)
- **Scope:** Komplette User Flows
- **Setup:** Playwright + laufende App
- **Speed:** Sekunden bis Minuten
- **Count:** 4 Test-Dateien

### 4.2 NPM Scripts

```json
{
  "test": "vitest run",
  "test:unit": "vitest run tests/unit",
  "test:integration": "vitest run tests/integration",
  "test:frontend": "cd frontend && vitest run",
  "test:e2e": "cd frontend && playwright test",
  "test:coverage": "vitest run --coverage"
}
```

### 4.3 Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
```

---

## 5. Migration Plan

### Phase 1: Setup (1h)
- [ ] Prisma Schema für SQLite vorbereiten
- [ ] `tests/` Ordnerstruktur erstellen
- [ ] `tests/setup.ts` erstellen
- [ ] `tests/database.ts` SQLite Helper erstellen

### Phase 2: Unit Tests (2h)
- [ ] Service Tests aus `src/` nach `tests/unit/` verschieben
- [ ] Imports korrigieren
- [ ] Prisma Mock Setup verifizieren

### Phase 3: Integration Tests (2h)
- [ ] Route Tests aus `src/` nach `tests/integration/` verschieben
- [ ] SQLite Datenbank-Setup integrieren
- [ ] Fastify Test-Server anpassen

### Phase 4: Frontend Tests (1h)
- [ ] Component Tests in `frontend/tests/unit/` organisieren
- [ ] Vitest Config für Frontend anpassen

### Phase 5: Cleanup (1h)
- [ ] Jest Konfiguration entfernen
- [ ] Alte Test-Dateien löschen
- [ ] package.json Scripts aktualisieren
- [ ] README Dokumentation aktualisieren

---

## 6. Success Criteria

- [ ] Alle Tests laufen ohne PostgreSQL
- [ ] Test-Ausführung < 30 Sekunden (Unit + Integration)
- [ ] 80%+ Code Coverage
- [ ] Keine Jest/Vitest Konflikte
- [ ] Klare Ordnerstruktur
- [ ] Einfache CI/CD Integration

---

## 7. Risks & Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| SQLite vs PostgreSQL Differences | Medium | Test queries are simple CRUD |
| File Migration Issues | Low | Git history preserved |
| Test Breakage | Medium | Run tests after each phase |

---

## 8. Approval

Design approved by: **User**  
Date: **2026-04-09**
