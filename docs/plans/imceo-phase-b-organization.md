# Phase B: Organization & Roles - Implementierungsplan

**Ziel:** Visueller Company Designer, Hierarchien, Reporting Lines, Role Templates, Agent Profiles

**Dauer:** 8 Wochen

**Abhängigkeiten:** Phase A (Core Foundation)

---

## Hierarchiemodell

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
│   ├── Fullstack Lead
│   ├── Senior Engineer
│   └── Engineer
├── Quality & Governance
│   ├── QA Lead
│   ├── QA Engineer
│   ├── Security Reviewer
│   ├── Compliance Reviewer
│   └── Release Manager
└── Support
    ├── Technical Writer
    ├── Research Analyst
    ├── Documentation Specialist
    ├── DevOps Engineer
    └── Platform Engineer
```

---

## UI-Komponenten: Company Designer

```
src/components/company-designer/
├── OrgChartCanvas.tsx           # Haupt-Canvas
├── OrgNode.tsx                  # Einzelner Knoten
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
├── DragAndDrop/
│   ├── DraggableNode.tsx
│   └── DropZone.tsx
└── Toolbar/
    ├── AddDivisionButton.tsx
    ├── AddTeamButton.tsx
    └── LineTypeSelector.tsx
```

---

## UI-Komponenten: Teams & Roles

```
src/components/teams-roles/
├── TeamsList.tsx
├── TeamEditor.tsx
├── TeamDetailView.tsx
├── RoleTemplateList.tsx
├── RoleTemplateEditor.tsx
├── RoleTemplateHierarchy.tsx
├── AgentProfileList.tsx
├── AgentProfileEditor.tsx
└── AgentStatusIndicator.tsx
```

---

## Datenbankschema Erweiterungen

### Reporting Lines
```sql
CREATE TYPE line_type AS ENUM ('disciplinary', 'operational', 'escalation', 'approval', 'advisory');

CREATE TABLE reporting_lines (
    reporting_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_role_id UUID NOT NULL,
    target_role_id UUID NOT NULL,
    line_type line_type NOT NULL,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Escalation Chains
```sql
CREATE TABLE escalation_chains (
    escalation_chain_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(company_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    ordered_role_ids UUID[] NOT NULL,
    trigger_conditions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpunkte

### Reporting Lines
```
GET    /api/v1/reporting-lines
POST   /api/v1/reporting-lines
DELETE /api/v1/reporting-lines/:id
GET    /api/v1/roles/:id/reporting-lines
```

### Escalation Chains
```
GET    /api/v1/escalation-chains
POST   /api/v1/escalation-chains
GET    /api/v1/escalation-chains/:id
PUT    /api/v1/escalation-chains/:id
DELETE /api/v1/escalation-chains/:id
```

---

## Implementierungssequenz (8 Wochen)

### Sprint 1-2: Datenbank & API Foundation
- Reporting Lines Schema
- Escalation Chains Schema
- API Routes für Organization

### Sprint 3-4: Company Designer UI
- OrgChartCanvas
- OrgNode Komponenten
- Drag-and-Drop

### Sprint 5-6: Teams & Roles UI
- Teams List & Editor
- Role Template Editor
- Agent Profile Management

### Sprint 7-8: Integration & Polishing
- State Management
- API-Integration
- Real-time Updates
- E2E Tests

---

## Akzeptanzkriterien

- [ ] Visuelles Organigramm funktioniert
- [ ] Drag-and-Drop für Hierarchie
- [ ] 5 Reporting Line Types
- [ ] Escalation Chains konfigurierbar
- [ ] 7 Hierarchieebenen
- [ ] Agent Profiles aktivieren/deaktivieren
- [ ] Real-time Updates
