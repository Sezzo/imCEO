# Phase D: Runtime & Claude Adapter - Implementierungsplan

**Ziel:** Team Sessions, Agent Sessions, Delegation Engine, Claude Adapter, Cost Tracking

**Dauer:** 8 Wochen

**Abhängigkeiten:** Phase A, Phase B, Phase C

---

## Session Lifecycles

### Team Session
```
Queued → Launching → Active → Waiting → Idle → Completed
                              ↓
                           Failed → Terminated
```

### Agent Session
```
Assigned → Running → Waiting → Idle → Completed
    ↓         ↓         ↓        ↓
  Failed    Blocked
    ↓
 Killed
```

---

## Kernkomponenten

### 1. Session Management
```typescript
interface TeamSession {
  teamSessionId: string;
  teamId: string;
  initiatingWorkItemId: string;
  currentState: TeamSessionState;
  currentCost: number;
  currentContextUsage: number;
  launchedAt: Date;
  endedAt?: Date;
}

interface AgentSession {
  agentSessionId: string;
  teamSessionId: string;
  agentId: string;
  assignedWorkItemId: string;
  state: AgentSessionState;
  costAccumulated: number;
  contextAccumulated: number;
  startedAt: Date;
  lastActiveAt: Date;
  endedAt?: Date;
}
```

### 2. Delegation Engine
```typescript
interface Delegation {
  delegationId: string;
  sourceWorkItemId: string;
  sourceAgentId: string;
  targetTeamId: string;
  targetRoleId: string;
  targetAgentId: string;
  delegationType: DelegationType;
  objective: string;
  scope: string;
  state: DelegationState;
  costLimit: number;
}

type DelegationType =
  | 'research' | 'planning' | 'analysis' | 'architecture'
  | 'implementation' | 'testing' | 'review' | 'documentation'
  | 'compliance' | 'release_preparation' | 'incident_response';
```

### 3. Claude Team Adapter
- Prompt Layering (Company → Division → Team → Role → Task)
- Model Assignment
- Skill, MCP, Plugin Activation
- Runtime Status Synchronization

### 4. Cost Tracking
```typescript
interface CostRecord {
  costRecordId: string;
  scopeType: string;
  scopeId: string;
  agentId: string;
  modelProfileId: string;
  workItemId: string;
  costType: CostType;
  value: number;
  details: {
    tokenCount?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
}

type CostType =
  | 'token_input' | 'token_output' | 'session_cost' | 'task_cost'
  | 'team_cost' | 'plugin_cost' | 'mcp_cost' | 'tool_execution_cost';
```

---

## Services

```
src/runtime/
├── services/
│   ├── TeamSessionService.ts
│   ├── AgentSessionService.ts
│   ├── DelegationEngine.ts
│   ├── ClaudeAdapter.ts
│   ├── CostTrackingService.ts
│   └── RuntimeEventService.ts
├── events/
│   ├── RuntimeEventEmitter.ts
│   └── handlers/
└── types/
    └── runtime.types.ts
```

---

## API Endpunkte

### Sessions
```
GET    /api/v1/team-sessions
POST   /api/v1/team-sessions
GET    /api/v1/team-sessions/:id
POST   /api/v1/team-sessions/:id/terminate

GET    /api/v1/agent-sessions
POST   /api/v1/agent-sessions
GET    /api/v1/agent-sessions/:id
POST   /api/v1/agent-sessions/:id/kill
```

### Delegations
```
GET    /api/v1/delegations
POST   /api/v1/delegations
GET    /api/v1/delegations/:id
POST   /api/v1/delegations/:id/accept
POST   /api/v1/delegations/:id/complete
```

### Costs
```
GET    /api/v1/costs
GET    /api/v1/costs/summary
GET    /api/v1/costs/by-team
GET    /api/v1/costs/by-agent
GET    /api/v1/budgets/status
```

---

## Datenbankschema

```sql
-- Team Sessions
CREATE TABLE team_sessions (
    team_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(team_id),
    initiating_work_item_id UUID REFERENCES work_items(work_item_id),
    current_state VARCHAR(50) DEFAULT 'Queued',
    current_cost DECIMAL(10,2) DEFAULT 0,
    current_context_usage INTEGER DEFAULT 0,
    launched_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP
);

-- Agent Sessions
CREATE TABLE agent_sessions (
    agent_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_session_id UUID REFERENCES team_sessions(team_session_id),
    agent_id UUID REFERENCES agent_profiles(agent_id),
    assigned_work_item_id UUID REFERENCES work_items(work_item_id),
    state VARCHAR(50) DEFAULT 'Assigned',
    cost_accumulated DECIMAL(10,2) DEFAULT 0,
    context_accumulated INTEGER DEFAULT 0,
    started_at TIMESTAMP DEFAULT NOW(),
    last_active_at TIMESTAMP,
    ended_at TIMESTAMP
);

-- Cost Records
CREATE TABLE cost_records (
    cost_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type VARCHAR(50),
    scope_id UUID,
    agent_id UUID REFERENCES agent_profiles(agent_id),
    model_profile_id UUID,
    work_item_id UUID REFERENCES work_items(work_item_id),
    cost_type VARCHAR(50),
    value DECIMAL(10,2),
    details JSONB,
    recorded_at TIMESTAMP DEFAULT NOW()
);
```

---

## Implementierungssequenz (8 Wochen)

### Sprint 1-2: Session Management
- Team Sessions
- Agent Sessions
- State Transitions

### Sprint 3-4: Delegation Engine
- Delegation Routing
- Constraints & Limits
- Acceptance Flow

### Sprint 5-6: Claude Adapter
- Prompt Layering
- Model Assignment
- Capability Activation

### Sprint 7-8: Cost Tracking & Events
- Cost Recording
- Budget Enforcement
- Runtime Events

---

## Akzeptanzkriterien

- [ ] Team Sessions Lifecycle
- [ ] Agent Sessions Lifecycle
- [ ] Delegation Engine Routing
- [ ] Claude Adapter Prompt Layering
- [ ] Cost Tracking pro Scope
- [ ] Budget Alerts
- [ ] Runtime Event Broadcasting
