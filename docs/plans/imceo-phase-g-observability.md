# Phase G: Observability & Hardening - Implementierungsplan

**Ziel:** Audit Events, Metrics, 12 Observability Views, Failure Recovery, Performance

**Dauer:** 12 Wochen

**Abhängigkeiten:** Alle vorherigen Phasen (A-F)

---

## 12 Observability Views

| # | Ansicht | Zweck |
|---|---------|-------|
| 1 | Organigramm | Hierarchische Struktur |
| 2 | Aktive Teams | Team-Sessions & Status |
| 3 | Aktive Agenten | Agent-Sessions & Zustände |
| 4 | Delegationsgraph | Delegations-Beziehungen |
| 5 | WorkItem-Board | Kanban-Ansicht |
| 6 | Artefaktzentrum | Artefakt-Browser |
| 7 | Kosten-Dashboard | Echtzeit-Kosten |
| 8 | Policy-Verstöße | Compliance-Übersicht |
| 9 | Approvals | Offene Freigaben |
| 10 | Idle-States | Inaktive Agenten |
| 11 | Fehlercluster | Failure-Übersicht |
| 12 | Audit-Timeline | Event-History |

---

## Audit Event System

### Event-Typen
```typescript
enum AuditEventType {
  // Organization
  COMPANY_CREATED = 'company_created',
  DIVISION_UPDATED = 'division_updated',
  TEAM_CREATED = 'team_created',
  
  // Work
  WORK_ITEM_CREATED = 'work_item_created',
  WORK_ITEM_STATE_CHANGED = 'work_item_state_changed',
  WORK_ITEM_COMPLETED = 'work_item_completed',
  
  // Delegation
  DELEGATION_CREATED = 'delegation_created',
  DELEGATION_COMPLETED = 'delegation_completed',
  
  // Approval
  DECISION_APPROVED = 'decision_approved',
  APPROVAL_REQUESTED = 'approval_requested',
  
  // Policy
  POLICY_VIOLATION = 'policy_violation',
  
  // Cost
  COST_THRESHOLD_REACHED = 'cost_threshold_reached',
  
  // Runtime
  AGENT_SESSION_FAILED = 'agent_session_failed'
}
```

### AuditService
```typescript
interface AuditService {
  log(event: AuditEventInput): Promise<AuditEvent>;
  logBatch(events: AuditEventInput[]): Promise<void>;
  query(filters: AuditQueryFilters): Promise<AuditEvent[]>;
  getTimeline(start: Date, end: Date): Promise<AuditTimeline>;
}
```

---

## Metrics System

### Metrik-Kategorien
```typescript
// Business Metrics
interface BusinessMetrics {
  workItemsCreated: CounterMetric;
  workItemsCompleted: CounterMetric;
  delegationsSuccessRate: GaugeMetric;
  averageCycleTime: HistogramMetric;
}

// Runtime Metrics
interface RuntimeMetrics {
  teamSessionsActive: GaugeMetric;
  agentSessionsActive: GaugeMetric;
  agentsIdle: GaugeMetric;
  eventProcessingLag: GaugeMetric;
}

// Cost Metrics
interface CostMetrics {
  costByTeam: GaugeMetric;
  costByAgent: GaugeMetric;
  budgetUtilizationPercent: GaugeMetric;
  projectedMonthlyCost: GaugeMetric;
}

// Quality Metrics
interface QualityMetrics {
  reviewApprovalRate: GaugeMetric;
  testPassRate: GaugeMetric;
  policyViolations: CounterMetric;
}
```

---

## Failure Recovery System

### Failure-Typen
```typescript
enum FailureType {
  TASK_FAILED = 'task_failed',
  INVALID_OUTPUT = 'invalid_output',
  POLICY_VIOLATION = 'policy_violation',
  TOOL_FAILURE = 'tool_failure',
  DEPENDENCY_BLOCKED = 'dependency_blocked',
  IDLE_TIMEOUT = 'idle_timeout',
  REVIEW_REJECTION = 'review_rejection',
  EXCESSIVE_COST = 'excessive_cost',
  AGENT_CRASH = 'agent_crash'
}

enum RecoveryAction {
  RETRY_SAME_AGENT = 'retry_same_agent',
  RETRY_DIFFERENT_AGENT = 'retry_different_agent',
  ESCALATE_TO_LEAD = 'escalate_to_lead',
  ESCALATE_TO_MANAGEMENT = 'escalate_to_management',
  SPLIT_TASK = 'split_task',
  REQUEST_CLARIFICATION = 'request_clarification',
  QUARANTINE_OUTPUT = 'quarantine_output',
  REQUIRE_HUMAN_DECISION = 'require_human_decision'
}
```

### RecoveryService
```typescript
interface RecoveryService {
  detectFailure(context: FailureContext): Promise<FailureRecord>;
  analyzeFailure(failureId: string): Promise<RecoveryStrategy>;
  executeRecovery(failureId: string, action: RecoveryAction): Promise<RecoveryResult>;
  configureAutoRecovery(config: AutoRecoveryConfig): void;
}
```

---

## Datenbankschema

```sql
-- Audit Events
CREATE TABLE audit_events (
    audit_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    actor_role_id UUID,
    actor_agent_id UUID,
    target_type VARCHAR(50),
    target_id UUID,
    description TEXT,
    payload JSONB,
    severity VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Failure Records
CREATE TABLE failure_records (
    failure_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type VARCHAR(50),
    scope_id UUID,
    failure_type VARCHAR(50),
    description TEXT,
    severity VARCHAR(50),
    related_work_item_id UUID,
    related_agent_id UUID,
    proposed_recovery_action VARCHAR(50),
    recovery_state VARCHAR(50) DEFAULT 'detected',
    recovery_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Metrics (Time-Series)
CREATE TABLE metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(255) NOT NULL,
    labels JSONB,
    value DECIMAL(20,6),
    timestamp TIMESTAMP DEFAULT NOW()
);
```

---

## UI-Komponenten

```
src/components/observability/
├── views/
│   ├── OrgChartView.tsx
│   ├── ActiveTeamsView.tsx
│   ├── ActiveAgentsView.tsx
│   ├── DelegationGraphView.tsx
│   ├── WorkItemBoardView.tsx
│   ├── ArtifactCenterView.tsx
│   ├── CostDashboardView.tsx
│   ├── PolicyViolationsView.tsx
│   ├── ApprovalsView.tsx
│   ├── IdleStatesView.tsx
│   ├── FailureClusterView.tsx
│   └── AuditTimelineView.tsx
├── shared/
│   ├── MetricCard.tsx
│   ├── StatusBadge.tsx
│   ├── SparklineChart.tsx
│   └── FilterBar.tsx
└── dashboard/
    ├── ExecutiveDashboard.tsx
    ├── TeamLeadDashboard.tsx
    └── OperatorDashboard.tsx
```

---

## Performance-Ziele

| Bereich | Ziel |
|---------|------|
| API Response | p95 < 200ms |
| Dashboard Load | < 2 Sekunden |
| Audit Write | < 50ms |
| Metrics Ingestion | 10k events/sec |
| Query Performance | < 500ms |

---

## Implementierungssequenz (12 Wochen)

### Phase G.1: Foundation (Woche 1-2)
- AuditEvent Schema
- AuditService Core
- MetricsService Core
- FailureRecord Schema

### Phase G.2: Event Integration (Woche 3-4)
- Repository Layer Integration
- WorkItem Lifecycle Events
- Runtime Events
- Governance Events
- Metrics Collectors

### Phase G.3: Core UI (Woche 5-6)
- Gemeinsame UI-Komponenten
- Organigramm
- WorkItem-Board
- Artefaktzentrum
- Approvals

### Phase G.4: Runtime UI (Woche 7-8)
- Aktive Teams
- Aktive Agenten
- Delegationsgraph
- Idle-States
- Fehlercluster

### Phase G.5: Governance UI & Cost (Woche 9-10)
- Kosten-Dashboard
- Policy-Verstöße
- Audit-Timeline
- Cost System

### Phase G.6: Recovery & Performance (Woche 11-12)
- Recovery System
- Performance Optimierung
- Audit Archivierung
- Alert System

---

## Akzeptanzkriterien

- [ ] Jede Aktion <50ms protokolliert
- [ ] 4 Metrik-Kategorien erfasst
- [ ] Alle 12 Ansichten implementiert
- [ ] 80% automatische Recovery
- [ ] API p95 < 200ms
- [ ] Budget-Überschreitungen erkannt
- [ ] Policy-Verstöße sichtbar
