# Phase C: Work & Artifacts - Implementierungsplan

**Ziel:** WorkItem Management, State Machine, Artifacts, Reviews, Tests, Workflow Engine

**Dauer:** 8 Wochen

**Abhängigkeiten:** Phase A (Core Foundation)

---

## WorkItem State Machine

```
Draft → Proposed → Approved → Planned → Ready
                                         ↓
                              In Progress → In Review
                                   ↓            ↓
                    Waiting on Dependency    Changes Requested
                          ↓                      ↓
                          └──────────→ In Test
                                          ↓
                              Awaiting Approval
                                     ↓
                        Approved for Completion
                                     ↓
                                    Done
                                     ↓
                                  Archived
```

**Zustände:** Draft, Proposed, Approved, Planned, Ready, In Progress, Waiting on Dependency, In Review, Changes Requested, In Test, Awaiting Approval, Approved for Completion, Done, Archived, Reopened, Rejected, Cancelled

---

## WorkItem-Typen

| Kategorie | Typen |
|-----------|-------|
| Strategisch | Vision, Goal, Initiative, Program, Workstream |
| Delivery | Epic, Story, Task, Subtask, Bug, Spike |
| Governance | ReviewTask, TestTask, ReleaseTask |

---

## Artifact-Typen

| Kategorie | Typen |
|-----------|-------|
| Strategisch | Vision Brief, Strategic Memo, Goal Definition |
| Technisch | Architecture Proposal, ADR, System Design, API Contract |
| Delivery | Task Brief, Test Plan, Test Report, Review Report |
| Governance | Security Review, Compliance Report, Audit Report |

---

## Review-Typen

- peer_review
- lead_review
- architecture_review
- qa_review
- security_review
- compliance_review
- executive_review

**Ergebnisse:** approved, approved_with_notes, changes_requested, rejected, escalated

---

## Test-Typen

- lint, static_analysis, unit, integration, e2e
- regression, smoke, security, policy_verification, acceptance

---

## Domain-Struktur

```
src/domains/
├── work/
│   ├── entities/
│   │   ├── WorkItem.ts
│   │   ├── WorkItemState.ts
│   │   └── WorkItemTransition.ts
│   ├── services/
│   │   ├── WorkItemService.ts
│   │   └── StateMachine.ts
│   └── repositories/
│       └── WorkItemRepository.ts
├── artifacts/
│   ├── entities/
│   │   ├── Artifact.ts
│   │   └── ArtifactVersion.ts
│   └── services/
│       └── ArtifactService.ts
├── reviews/
│   ├── entities/
│   │   └── Review.ts
│   └── services/
│       └── ReviewService.ts
└── tests/
    ├── entities/
    │   └── TestRun.ts
    └── services/
        └── TestService.ts
```

---

## Workflow Engine

```typescript
interface WorkflowDefinition {
  workflowId: string;
  name: string;
  appliesTo: WorkItemType[];
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  triggers: WorkflowTrigger[];
}

interface WorkflowTransition {
  from: WorkItemState;
  to: WorkItemState;
  guards: Guard[];
  requiredArtifacts?: ArtifactType[];
  requiredReviews?: ReviewType[];
}
```

---

## API Endpunkte

### WorkItems
```
GET    /api/v1/work-items
POST   /api/v1/work-items
GET    /api/v1/work-items/:id
PUT    /api/v1/work-items/:id
DELETE /api/v1/work-items/:id
POST   /api/v1/work-items/:id/transition
GET    /api/v1/work-items/:id/history
GET    /api/v1/work-items/board
```

### Reviews
```
GET    /api/v1/reviews
POST   /api/v1/reviews
GET    /api/v1/reviews/:id
PUT    /api/v1/reviews/:id/complete
```

### Tests
```
GET    /api/v1/test-runs
POST   /api/v1/test-runs
GET    /api/v1/test-runs/:id
POST   /api/v1/test-runs/:id/execute
```

---

## Implementierungssequenz (8 Wochen)

### Sprint 1-2: WorkItem Domain
- WorkItem Entity
- State Machine
- WorkItemService

### Sprint 3-4: Workflow Engine
- Workflow Definition
- Transitions & Guards
- Trigger System

### Sprint 5-6: Artifacts
- Artifact Entity
- Versioning
- Storage

### Sprint 7-8: Reviews & Tests
- Review System
- Test Management
- Integration

---

## Akzeptanzkriterien

- [ ] WorkItems in 16 Zuständen führbar
- [ ] State Machine mit Guards
- [ ] Artifact Versionierung
- [ ] Alle 7 Review-Typen
- [ ] Alle 10 Test-Typen
- [ ] Workflow Engine mit Triggern
