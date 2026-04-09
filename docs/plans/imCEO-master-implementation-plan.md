# imCEO - Master Implementierungsplan

**Projekt:** imCEO - AI Company Operating System for Claude Agent Teams  
**Version:** 1.0  
**Datum:** 2026-04-09  
**Status:** Planung Abgeschlossen

---

## Überblick

Dieser Master-Plan führt alle 7 Phasen des imCEO-Systems zusammen:

| Phase | Name | Dauer | Kernkomponenten |
|-------|------|-------|-----------------|
| A | Core Foundation | 10 Wochen | Domain Model, DB Schema, API |
| B | Organization & Roles | 8 Wochen | Company Designer, Teams, Rollen |
| C | Work & Artifacts | 8 Wochen | WorkItems, State Machine, Reviews |
| D | Runtime & Claude Adapter | 8 Wochen | Sessions, Delegation, Cost Tracking |
| E | Governance & Integrations | 8 Wochen | Policies, MCPs, Plugins |
| F | Vision & Strategy | 6 Wochen | Vision Intake, Programme, Entscheidungen |
| G | Observability | 12 Wochen | Audit, Metrics, 12 Ansichten |

**Gesamtdauer:** ~60 Wochen (parallele Entwicklung möglich)

---

## Technologie-Stack

### Backend
| Komponente | Technologie |
|------------|-------------|
| Runtime | Node.js 20+ LTS |
| Sprache | TypeScript 5.4+ |
| Framework | Fastify 4.x |
| ORM | Prisma 5.x |
| Validierung | Zod 3.x |
| Testing | Vitest |
| Datenbank | PostgreSQL 16+ |

### Frontend
| Komponente | Technologie |
|------------|-------------|
| Framework | React 18+ |
| Sprache | TypeScript 5+ |
| State | Zustand/Redux Toolkit |
| UI | Radix UI / Headless UI |
| Styling | Tailwind CSS |
| Diagramme | react-flow / @xyflow/react |
| Forms | React Hook Form + Zod |

---

## Phase A: Core Foundation (10 Wochen)

### Ziele
- Domain Model mit ~40 Entitäten
- PostgreSQL Datenbankschema
- REST API Grundgerüst
- Authentifizierung & Settings
- Template System Basis

### Kritische Dateien
```
prisma/schema/
├── core.prisma          # Company, Division, Department, Team
├── roles.prisma         # RoleTemplate, AgentProfile
├── capabilities.prisma  # Skills, MCPs, Plugins
├── work.prisma          # WorkItem, Decision, Delegation
├── artifacts.prisma     # Artifact, Review, Test
├── runtime.prisma       # Sessions, Events, Failures
├── governance.prisma    # Policy, Approval
├── observability.prisma   # CostRecord, AuditEvent
└── templates.prisma       # Template System
```

### API Endpunkte (120+)
- `/api/v1/companies` - CRUD + Hierarchie
- `/api/v1/divisions` - CRUD
- `/api/v1/departments` - CRUD
- `/api/v1/teams` - CRUD
- `/api/v1/role-templates` - CRUD + Vererbung
- `/api/v1/agent-profiles` - CRUD + Aktivierung
- `/api/v1/skills` - CRUD
- `/api/v1/mcps` - CRUD
- `/api/v1/plugins` - CRUD
- `/api/v1/work-items` - CRUD + State Transitions
- `/api/v1/artifacts` - CRUD + Versionierung
- `/api/v1/policies` - CRUD + Enforcement

---

## Phase B: Organization & Roles (8 Wochen)

### Ziele
- Visueller Company Designer (Organigramm)
- Hierarchisches Management (CEO → Executive → Management → Lead → Specialist)
- Reporting Lines (5 Typen)
- Escalation Chains
- Role Templates mit Vererbung
- Agent Profiles

### UI-Komponenten
```
src/components/company-designer/
├── OrgChartCanvas.tsx
├── OrgNode.tsx
├── OrgNodeTypes/
│   ├── DivisionNode.tsx
│   ├── DepartmentNode.tsx
│   ├── TeamNode.tsx
│   └── RoleNode.tsx
├── Connections/
│   ├── ReportingLine.tsx
│   ├── DisciplinaryLine.tsx
│   ├── OperationalLine.tsx
│   ├── ApprovalLine.tsx
│   └── AdvisoryLine.tsx
└── Toolbar/

src/components/teams-roles/
├── TeamsList.tsx
├── RoleTemplateList.tsx
├── RoleTemplateHierarchy.tsx
└── AgentProfileList.tsx
```

### Standard-Hierarchie
```
CEO
├── Executive Office
│   ├── Chief of Staff
│   ├── Strategy Director
│   └── Portfolio Director
├── Product Division
│   ├── Product Director
│   ├── Product Manager
│   └── Product Analyst
├── Engineering Division
│   ├── Principal Architect
│   ├── Engineering Manager
│   ├── Backend Lead
│   ├── Frontend Lead
│   └── Fullstack Lead
├── Quality & Governance
│   ├── QA Lead
│   ├── Security Reviewer
│   └── Compliance Reviewer
└── Support
    ├── Technical Writer
    ├── Research Analyst
    └── DevOps Engineer
```

---

## Phase C: Work & Artifacts (8 Wochen)

### Ziele
- WorkItem Management (Epic, Story, Task, Bug, etc.)
- State Machine (Draft → Proposed → Approved → Planned → Ready → In Progress → In Review → Done)
- Artifact Management & Versionierung
- Review System (peer, lead, architecture, qa, security, compliance, executive)
- Test Management (lint, unit, integration, e2e, security, acceptance)
- Workflow Engine

### WorkItem State Machine
```
Draft → Proposed → Approved → Planned → Ready
                                         ↓
In Progress → In Review → Changes Requested
      ↓            ↓              ↓
Waiting on Dependency    In Test
      ↓                    ↓
      └──────────→ Awaiting Approval
                          ↓
              Approved for Completion
                          ↓
                         Done
                          ↓
                       Archived
```

### Artifact-Typen
- **Strategisch:** Vision Brief, Strategic Memo, Goal Definition
- **Technisch:** Architecture Proposal, ADR, System Design, API Contract
- **Delivery:** Task Brief, Implementation Plan, Test Plan, Release Notes
- **Governance:** Security Review, Compliance Report, Audit Report

---

## Phase D: Runtime & Claude Adapter (8 Wochen)

### Ziele
- Team Session Management
- Agent Session Lifecycle
- Delegation Engine
- Claude Team Adapter
- Cost Tracking
- Runtime Event System
- Failure Recovery

### Session States
```
Team Session:   Queued → Launching → Active → Waiting → Idle → Completed
Agent Session:  Assigned → Running → Waiting → Idle → Blocked → Completed
```

### Delegationstypen
- research, planning, analysis, architecture, implementation, testing
- review, documentation, compliance, release_preparation, incident_response

### Cost Tracking
```
Cost Types:
- token_input, token_output
- session_cost, task_cost, team_cost
- plugin_cost, mcp_cost, tool_execution_cost
```

---

## Phase E: Governance & Integrations (8 Wochen)

### Ziele
- Policy Engine (tool, mcp, plugin, skill, filesystem, git policies)
- Approval Workflow System
- MCP Management
- Plugin Management
- Skill Management
- Integration Framework

### Harte Systemregeln
1. Kein Merge ohne verpflichtende Reviews
2. Kein Release ohne Release-Gate
3. Kein sensibler MCP-Zugriff ohne passende Policy
4. Keine Shell-Nutzung außerhalb definierter Command-Policies
5. Keine Architekturänderung ohne Architecture Review
6. Keine Security-Änderung ohne Security Gate
7. Keine kostenintensive Delegation ohne Budgetprüfung
8. Keine unbeschränkte Team-Parallelität
9. Keine ungenehmigte Plugin-Aktivierung mit erhöhtem Risiko
10. Kein Abschluss ohne Definition of Done

### Integrationstypen
- filesystem, git, ci_cd, docs, issue_tracker, design_source
- mcp, terminal, notifications, secrets_manager

---

## Phase F: Vision & Strategy (6 Wochen)

### Ziele
- CEO Vision Intake (22 Felder)
- Executive Structuring
- Programme & Initiativen
- Workstreams
- Decision Console
- Executive Summaries

### CEO Vision Template (22 Abschnitte)
1. Executive Summary
2. Geschäftsziel
3. Problemdefinition
4. Zielgruppe / Stakeholder
5. Gewünschtes Ergebnis
6. Vision im Idealzustand
7. Scope
8. Nicht-Scope
9. Prioritäten
10. Qualitätsanspruch
11. Zeitrahmen
12. Budget / Ressourcenrahmen
13. Technische Vorgaben
14. Technische Verbote
15. Organisatorische Vorgaben
16. Risiken und Bedenken
17. Bekannte Annahmen
18. Offene Fragen
19. Entscheidungsfreiheit des Managements
20. Definition von Erfolg
21. Definition von Misserfolg
22. Zusätzliche Referenzen

### Betriebsablauf
```
Vision Intake → Executive Structuring → Functional Planning → Team Planning → Execution → Validation → Completion
```

---

## Phase G: Observability (12 Wochen)

### Ziele
- Audit Event System (jede Aktion protokolliert)
- Metrics Dashboard (Business, Runtime, Cost, Quality)
- 12 Observability Views
- Failure Recovery System
- Performance Optimierung

### 12 Observability Views
1. Organigramm
2. Aktive Teams
3. Aktive Agenten
4. Delegationsgraph
5. WorkItem-Board
6. Artefaktzentrum
7. Kosten-Dashboard
8. Policy-Verstöße
9. Approvals
10. Idle-States
11. Fehlercluster
12. Audit-Timeline

### Audit Event Types
- COMPANY_CREATED, DIVISION_UPDATED, TEAM_CREATED
- WORK_ITEM_STATE_CHANGED, DELEGATION_COMPLETED
- APPROVAL_GRANTED, POLICY_VIOLATION
- COST_THRESHOLD_REACHED, ESCALATION_TRIGGERED

---

## Implementierungs-Strategie

### Option 1: Sequentiell (Empfohlen für erstes MVP)
```
A → B → C → D → E → F → G
(60 Wochen total)
```

### Option 2: Parallel (Schneller, komplexer)
```
Woche 1-10:  Phase A (Foundation)
Woche 6-14:  Phase B (Organization) - startet nach A.5
Woche 12-20: Phase C (Work) - startet nach A.7
Woche 16-24: Phase D (Runtime) - startet nach C.3
Woche 20-28: Phase E (Governance) - startet nach D.2
Woche 24-30: Phase F (Vision) - startet nach B+C
Woche 28-40: Phase G (Observability) - startet nach D+E
```

---

## Kritische Abhängigkeiten

```
A (Foundation)
├── B (Organization) - benötigt A
├── C (Work) - benötigt A
├── E (Governance) - benötigt A
└── G (Audit) - benötigt A

B (Organization)
├── D (Runtime) - benötigt B für Agent-Sessions
└── F (Vision) - benötigt B für Executive-Rollen

C (Work)
├── D (Runtime) - benötigt C für WorkItem-Delegation
└── E (Governance) - benötigt C für Approval-Flows

D (Runtime)
├── E (Governance) - benötigt D für Policy-Enforcement
└── G (Observability) - benötigt D für Metrics

E (Governance)
└── G (Observability) - benötigt E für Policy-Verstöße
```

---

## Akzeptanzkriterien (Gesamtprojekt)

1. **Organization:** Unternehmen visuell modellierbar mit 7 Hierarchieebenen
2. **Teams:** Agenten mit Rollen, Modellen und Prompts definierbar
3. **Work:** Vision in strukturierte Arbeit überführbar
4. **State Machine:** Arbeit in 16 Zuständen führbar
5. **Artifacts:** Alle Ergebnisse als strukturierte Artefakte
6. **Delegation:** Delegationen nachvollziehbar
7. **Governance:** Reviews, Tests und Approvals erzwingbar
8. **Cost:** Kosten und Risiken transparent
9. **CEO:** Führung auf Führungsebene arbeitsfähig
10. **Audit:** Jede wesentliche Aktion protokolliert in <50ms

---

## Nächste Schritte

1. **Genehmigung:** Master-Plan vom CEO (Benutzer) genehmigen lassen
2. **Agent-Team:** Implementation-Agenten für jede Phase spawnen
3. **Phase A Start:** Core Foundation implementieren
4. **Sprint-Planung:** 2-Wochen-Sprints mit Deliverables

---

**Plan erstellt von:** Claude Agent Teams (7 parallele Plan-Agenten)  
**Basierend auf:** imCEO Master Blueprint v1.0
