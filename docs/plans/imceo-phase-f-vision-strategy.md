# Phase F: Vision & Strategy - Implementierungsplan

**Ziel:** Vision Intake (22 Felder), Executive Structuring, Programme, Initiativen, Workstreams, Decision Console

**Dauer:** 6 Wochen

**Abhängigkeiten:** Phase A, Phase B, Phase C

---

## CEO Vision Template (22 Abschnitte)

| # | Feld | Typ | Pflicht |
|---|------|-----|---------|
| 1 | Executive Summary | Textarea | Ja |
| 2 | Geschäftsziel | Select | Ja |
| 3 | Problemdefinition | Textarea | Ja |
| 4 | Zielgruppe | Textarea | Ja |
| 5 | Gewünschtes Ergebnis | Textarea | Ja |
| 6 | Vision im Idealzustand | Textarea | Nein |
| 7 | Scope | Textarea | Ja |
| 8 | Nicht-Scope | Textarea | Ja |
| 9 | Prioritäten | JSON | Ja |
| 10 | Qualitätsanspruch | Select | Ja |
| 11 | Zeitrahmen | String | Nein |
| 12 | Budget | String | Nein |
| 13 | Technische Vorgaben | Textarea | Nein |
| 14 | Technische Verbote | Textarea | Nein |
| 15 | Organisatorische Vorgaben | Textarea | Nein |
| 16 | Risiken | Textarea | Nein |
| 17 | Annahmen | Textarea | Nein |
| 18 | Offene Fragen | Textarea | Nein |
| 19 | Entscheidungsfreiheit | Textarea | Nein |
| 20 | Definition von Erfolg | Textarea | Ja |
| 21 | Definition von Misserfolg | Textarea | Nein |
| 22 | Referenzen | JSON | Nein |

---

## Vision Workflow

```
Draft → Submitted → Parsing → Structured → Approved → In Execution
                                           ↓
                                      Rejected
                                           ↓
                                         Revise
```

---

## Betriebsablauf

```
1. Vision Intake (CEO)
   ↓
2. Executive Structuring (AI + Executive)
   ↓
3. Functional Planning (Management)
   ↓
4. Team Planning (Leads)
   ↓
5. Execution (Specialists)
   ↓
6. Validation (Governance)
   ↓
7. Completion / Release
```

---

## Datenbankschema

```sql
-- Visions
CREATE TABLE visions (
    vision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(company_id),
    submitted_by_role_id UUID,
    
    -- 22 Template Fields
    executive_summary TEXT NOT NULL,
    business_goal_type VARCHAR(50) NOT NULL,
    problem_definition TEXT,
    target_audience TEXT,
    desired_outcome TEXT,
    ideal_state_vision TEXT,
    scope_included TEXT,
    scope_excluded TEXT,
    priorities JSONB,
    quality_level VARCHAR(50),
    timeframe TEXT,
    budget_resources TEXT,
    technical_constraints TEXT,
    technical_prohibitions TEXT,
    organizational_requirements TEXT,
    risks_concerns TEXT,
    assumptions JSONB,
    open_questions TEXT,
    decision_authority TEXT,
    success_definition TEXT,
    failure_definition TEXT,
    references JSONB,
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft',
    parsed_result JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Programs
CREATE TABLE programs (
    program_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(company_id),
    vision_id UUID REFERENCES visions(vision_id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'proposed',
    goals JSONB,
    priority VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Initiatives
CREATE TABLE initiatives (
    initiative_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES programs(program_id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'proposed',
    deliverables JSONB,
    dependencies JSONB,
    priority VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Workstreams
CREATE TABLE workstreams (
    workstream_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initiative_id UUID REFERENCES initiatives(initiative_id),
    owning_team_id UUID REFERENCES teams(team_id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'planned',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Decisions
CREATE TABLE decisions (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    decision_type VARCHAR(50),
    proposed_by_role_id UUID,
    proposed_rationale TEXT,
    approved_by_role_id UUID,
    decision_rationale TEXT,
    program_id UUID REFERENCES programs(program_id),
    status VARCHAR(50) DEFAULT 'proposed',
    created_at TIMESTAMP DEFAULT NOW(),
    decided_at TIMESTAMP
);
```

---

## UI-Komponenten

```
src/components/vision/
├── VisionIntakeForm.tsx        # 22-Feld Formular
├── VisionSectionNav.tsx        # Abschnitts-Navigation
├── VisionStatusBadge.tsx       # Status-Anzeige
├── VisionList.tsx              # Vision-Liste
└── VisionDetail.tsx            # Detail-Ansicht

src/components/strategy/
├── ProgramBoard.tsx            # Kanban-Board für Programme
├── ProgramCard.tsx
├── InitiativeColumn.tsx
├── WorkstreamTree.tsx          # Hierarchische Ansicht
└── StrategyOverview.tsx

src/components/executive/
├── DecisionConsole.tsx         # Entscheidungs-Dashboard
├── DecisionCard.tsx
├── ExecutiveSummary.tsx        # KI-generierte Zusammenfassung
└── DecisionFilters.tsx
```

---

## Services

```typescript
// VisionService
interface VisionService {
  createVision(data: CreateVisionDTO): Promise<Vision>;
  submitVision(visionId: string, roleId: string): Promise<Vision>;
  parseAndStructureVision(visionId: string): Promise<ParsedVision>;
  approveVision(visionId: string, roleId: string): Promise<Vision>;
}

// ExecutiveStructuringService
interface ExecutiveStructuringService {
  structureFromParsedVision(
    companyId: string,
    visionId: string,
    parsedVision: ParsedVision,
    executiveRoleId: string
  ): Promise<StructureResult>;
  createProgram(data: CreateProgramDTO): Promise<Program>;
  createInitiative(data: CreateInitiativeDTO): Promise<Initiative>;
  activateProgram(programId: string): Promise<Program>;
}

// DecisionEngine
interface DecisionEngine {
  createDecision(data: CreateDecisionDTO): Promise<Decision>;
  updateDecision(
    decisionId: string,
    update: UpdateDecisionDTO,
    approverRoleId: string
  ): Promise<Decision>;
  getDecisionsForRole(roleId: string): Promise<Decision[]>;
  batchDecisions(decisionIds: string[], action: string): Promise<Decision[]>;
}
```

---

## API Endpunkte

### Visions
```
GET    /api/v1/visions
POST   /api/v1/visions
GET    /api/v1/visions/:id
PUT    /api/v1/visions/:id
POST   /api/v1/visions/:id/submit
POST   /api/v1/visions/:id/parse
POST   /api/v1/visions/:id/approve
```

### Programs
```
GET    /api/v1/programs
POST   /api/v1/programs
GET    /api/v1/programs/:id
PUT    /api/v1/programs/:id
POST   /api/v1/programs/:id/activate
GET    /api/v1/programs/:id/initiatives
```

### Initiatives
```
GET    /api/v1/initiatives
POST   /api/v1/initiatives
GET    /api/v1/initiatives/:id
PUT    /api/v1/initiatives/:id
```

### Workstreams
```
GET    /api/v1/workstreams
POST   /api/v1/workstreams
GET    /api/v1/workstreams/:id
```

### Executive
```
GET    /api/v1/executive/decisions
POST   /api/v1/executive/decisions
PUT    /api/v1/executive/decisions/:id
POST   /api/v1/executive/decisions/batch
GET    /api/v1/executive/summaries
POST   /api/v1/executive/summaries/generate
```

---

## Implementierungssequenz (6 Wochen)

### Sprint 1-2: Vision Intake
- 22-Feld Formular
- Section Navigation
- Draft Saving
- Submit Workflow

### Sprint 3-4: Executive Structuring
- Vision Parser
- Program/Initiative Erstellung
- Workstream Zuordnung
- AI-Integration

### Sprint 5-6: Decision Console & UI
- Decision Workflow
- Batch Operations
- Executive Summary Generation
- Strategy Views

---

## Akzeptanzkriterien

- [ ] 22-Feld Vision Template
- [ ] Vision Status Workflow
- [ ] Executive Structuring mit AI
- [ ] Programme, Initiativen, Workstreams
- [ ] Decision Console
- [ ] Batch-Entscheidungen
- [ ] Executive Summaries
