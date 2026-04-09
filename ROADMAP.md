# imCEO Roadmap

## Aktueller Stand

### Backend (Phase A - Core Foundation) ✅ 80%
- [x] Fastify Server mit Swagger
- [x] Prisma Schema (komplettes Domain Model)
- [x] Company/Division/Department/Team CRUD
- [x] Role Template Management
- [x] Agent Profile Management
- [x] Work Item Service mit State Transitions
- [x] Artifact Service mit Versioning
- [x] Policy Routes
- [ ] Work Item History (Audit Log)
- [ ] Review Management Service
- [ ] Delegation Service
- [ ] Audit Event Service
- [ ] Cost Tracking Service

### Frontend (Phase B - UI Foundation) 🚧 40%
- [x] React + Vite Setup
- [x] Basic Layout mit Sidebar
- [x] React Flow Org Chart (Basis)
- [ ] API Client an Backend-Datenmodell anpassen
- [ ] Company Store erweitern (Divisions, Departments, Teams)
- [ ] Organisation Tree UI (Company → Division → Department → Team)
- [ ] Work Item Kanban Board
- [ ] Work Item Detail/Editor
- [ ] Team & Agent Management UI

## Nächste Schritte (Priorität)

### 1. Frontend-Datenmodell anpassen (KRITISCH)
**Problem:** Frontend hat vereinfachtes Modell (Organization/Roles), Backend hat komplexes Modell (Company/Division/Department/Team/Agent)

**Aktionen:**
- API Client Interfaces aktualisieren
- Neue Endpoints: `/companies`, `/divisions`, `/departments`, `/teams`, `/agent-profiles`
- Store Struktur erweitern
- UI Komponenten anpassen

### 2. Work Item System vervollständigen
- History/Audit Log Tabelle erstellen
- State Transition Events loggen
- Frontend Kanban Board implementieren

### 3. Organization Tree UI
- React Flow Nodes für jede Hierarchie-Ebene
- Drag & Drop für Reorganisation
- Detail-Panels für Editieren

### 4. Governance Features
- Review Workflow implementieren
- Policy Enforcement
- Approval Request System

## Technische Schulden
- [ ] Unit Tests für Services
- [ ] Integration Tests für API Routes
- [ ] Frontend E2E Tests
- [ ] Error Handling konsistent machen
- [ ] Logging Strategy verfeinern

## Phase C+D Planung (Post-MVP)
- Team Session Management
- Agent Runtime/Execution
- MCP Integration
- Real-time Updates (WebSockets)
- Cost Budget Controls
- Advanced Analytics Dashboard
