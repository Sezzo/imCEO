# imCEO - AI Company Operating System

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Sezzo/imCEO)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> Ein visuelles Unternehmensbetriebssystem für Claude Agent Teams. Der Nutzer agiert als CEO und steuert das Unternehmen über Vision, Prioritäten, Entscheidungen und Freigaben.

## 🎯 Vision

imCEO ermöglicht es, ohne Code eine künstliche Firma zu entwerfen und zu betreiben, in der Claude Agent Teams arbeitsteilig handeln. Der Nutzer formuliert nicht jeden Task selbst, sondern gibt die Unternehmensrichtung vor - das System übersetzt diese in strukturierte Arbeit.

## 🏗️ Architektur

### Backend (TypeScript/Fastify)
```
src/
├── application/services/    # Business Logic
├── interface/http/routes/   # API Endpoints
├── config/                  # Database, Env, Logger
└── server.ts               # Fastify Server
```

### Frontend (React/Vite)
```
frontend/src/
├── components/
│   ├── company-designer/   # Org Chart Visualization
│   └── teams-roles/        # Team & Role Management
├── store/                  # State Management
└── api/                    # API Client
```

### Datenmodell
```
Company
├── Division
│   └── Department
│       └── Team
│           └── AgentProfile
├── WorkItem (Hierarchie: Vision → Goal → Initiative → Epic → Story → Task)
├── Artifact (VisionBrief, ADR, TechnicalSpec, TestReport, etc.)
└── Policy (Tool, MCP, Review, Budget Policies)
```

## 🚀 Schnellstart

### Voraussetzungen
- Node.js ≥ 20
- PostgreSQL ≥ 14

### Installation

```bash
# 1. Repository klonen
git clone https://github.com/Sezzo/imCEO.git
cd imCEO

# 2. Dependencies installieren
npm install

# 3. Datenbank konfigurieren
# .env Datei erstellen:
DATABASE_URL="postgresql://user:password@localhost:5432/imceo"
PORT=3000
HOST=0.0.0.0

# 4. Datenbank migrieren
npm run db:migrate

# 5. Server starten
npm run dev
```

### API Dokumentation

Nach dem Start ist die Swagger-Dokumentation verfügbar unter:
http://localhost:3000/documentation

## 📊 Features

### Phase A: Core Foundation ✅
- [x] Clean Architecture Setup
- [x] Domain Models (Company, Division, Department, Team)
- [x] Agent Profile Management
- [x] Role Templates
- [x] Database Schema (Prisma)
- [x] REST API mit Fastify
- [x] Swagger Dokumentation

### Phase B: Work Management 🚧
- [ ] Work Item Lifecycle
- [ ] State Transitions
- [ ] Kanban Board
- [ ] Assignment & Delegation
- [ ] Priority & Severity

### Phase C: Governance & Operations 🚧
- [ ] Policy Framework
- [ ] Artifact Management
- [ ] Review Workflows
- [ ] Audit Events
- [ ] Cost Tracking

### Phase D: Runtime & Execution 🚧
- [ ] Team Session Management
- [ ] Agent Session Lifecycle
- [ ] Real-time Updates
- [ ] MCP Integration

## 🔧 Entwicklung

### Scripts
```bash
npm run dev              # Entwicklungsserver
npm run build            # Produktionsbuild
npm run test             # Tests ausführen
npm run db:generate      # Prisma Client generieren
npm run db:migrate       # Migrationen ausführen
npm run db:studio        # Prisma Studio öffnen
```

### Projektstruktur
Das Projekt folgt Clean Architecture Principles:
- **Domain**: Entities und Business Rules
- **Application**: Use Cases und Services
- **Interface**: HTTP Routes und Controller
- **Infrastructure**: Database, Logger, Config

## 📝 Lizenz

MIT License - siehe [LICENSE](LICENSE)

## 🤝 Mitwirken

Beiträge sind willkommen! Bitte folge den bestehenden Code-Standards und erstelle Pull Requests für neue Features.

---

Built with ❤️ by the imCEO Team
