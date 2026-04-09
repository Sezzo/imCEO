# Phase A: Core Foundation - Implementierungsplan

**Ziel:** Domain Model mit ~40 Entitäten, PostgreSQL Schema, REST API, Auth, Template System

**Dauer:** 10 Wochen

---

## Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Runtime | Node.js 20+ LTS |
| Sprache | TypeScript 5.4+ |
| Framework | Fastify 4.x |
| ORM | Prisma 5.x |
| Validierung | Zod 3.x |
| Testing | Vitest |
| Datenbank | PostgreSQL 16+ |

---

## Ordnerstruktur

```
imceo-backend/
├── prisma/
│   ├── schema/
│   │   ├── core.prisma          # Company, Division, Department, Team
│   │   ├── roles.prisma         # RoleTemplate, AgentProfile
│   │   ├── capabilities.prisma  # Skills, MCPs, Plugins
│   │   ├── work.prisma          # WorkItem, Decision, Delegation
│   │   ├── artifacts.prisma     # Artifact, Review, Test
│   │   ├── runtime.prisma       # Sessions, Events, Failures
│   │   ├── governance.prisma    # Policy, Approval
│   │   ├── observability.prisma   # CostRecord, AuditEvent
│   │   └── templates.prisma       # Template System
│   ├── migrations/
│   └── seed.ts
│
├── src/
│   ├── config/
│   ├── domain/entities/
│   ├── application/services/
│   ├── infrastructure/persistence/
│   └── interface/http/routes/
```

---

## Datenbankschema

### Core Organization

```sql
-- Company
CREATE TABLE companies (
    company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    industry VARCHAR(100),
    primary_objective TEXT,
    operating_mode VARCHAR(50),
    global_prompt TEXT,
    global_policies JSONB DEFAULT '{}',
    global_skills JSONB DEFAULT '[]',
    global_mcps JSONB DEFAULT '[]',
    global_plugins JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Division
CREATE TABLE divisions (
    division_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(company_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_division_id UUID REFERENCES divisions(division_id),
    head_role_id UUID,
    policies JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Department
CREATE TABLE departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    division_id UUID REFERENCES divisions(division_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    head_role_id UUID,
    scope TEXT,
    policies JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Team
CREATE TABLE teams (
    team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES departments(department_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    mission TEXT,
    team_type VARCHAR(50),
    lead_role_id UUID,
    default_model_profile_id UUID,
    default_skill_bundle_id UUID,
    default_mcp_bundle_id UUID,
    default_plugin_bundle_id UUID,
    allowed_interactions JSONB DEFAULT '[]',
    escalation_chain_id UUID,
    cost_budget_policy_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Roles & Agents

```sql
-- Hierarchieebenen
CREATE TYPE hierarchy_level AS ENUM ('CEO', 'Executive', 'Management', 'Lead', 'Specialist', 'Governance', 'Observer');

-- Role Template
CREATE TABLE role_templates (
    role_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(company_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    hierarchy_level hierarchy_level NOT NULL,
    description TEXT,
    purpose TEXT,
    primary_responsibilities JSONB DEFAULT '[]',
    decision_scope JSONB DEFAULT '{}',
    default_model_profile_id UUID,
    default_skill_bundle_id UUID,
    cost_class VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Agent Profile
CREATE TABLE agent_profiles (
    agent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(team_id) ON DELETE CASCADE,
    role_template_id UUID REFERENCES role_templates(role_template_id),
    display_name VARCHAR(255) NOT NULL,
    internal_name VARCHAR(255) NOT NULL,
    seniority VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    custom_prompt_override TEXT,
    max_parallel_tasks INTEGER DEFAULT 1,
    max_context_budget INTEGER,
    max_cost_per_task DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Work Domain

```sql
-- WorkItem States
CREATE TYPE work_item_state AS ENUM (
    'Draft', 'Proposed', 'Approved', 'Planned', 'Ready',
    'In Progress', 'Waiting on Dependency', 'In Review',
    'Changes Requested', 'In Test', 'Awaiting Approval',
    'Approved for Completion', 'Done', 'Archived',
    'Reopened', 'Rejected', 'Cancelled'
);

-- WorkItem Types
CREATE TYPE work_item_type AS ENUM (
    'Vision', 'Goal', 'Initiative', 'Program', 'Workstream',
    'Epic', 'Story', 'Task', 'Subtask', 'Bug', 'Spike',
    'ReviewTask', 'TestTask', 'ReleaseTask'
);

-- WorkItem
CREATE TABLE work_items (
    work_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type work_item_type NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    parent_work_item_id UUID REFERENCES work_items(work_item_id),
    company_id UUID REFERENCES companies(company_id),
    division_id UUID REFERENCES divisions(division_id),
    department_id UUID REFERENCES departments(department_id),
    owning_team_id UUID REFERENCES teams(team_id),
    owning_role_id UUID,
    assigned_agent_id UUID REFERENCES agent_profiles(agent_id),
    priority VARCHAR(50),
    state work_item_state DEFAULT 'Draft',
    approval_state VARCHAR(50),
    risk_score INTEGER,
    cost_limit DECIMAL(10,2),
    estimated_effort INTEGER,
    actual_effort INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    due_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Delegation
CREATE TABLE delegations (
    delegation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_work_item_id UUID REFERENCES work_items(work_item_id),
    source_agent_id UUID REFERENCES agent_profiles(agent_id),
    target_team_id UUID REFERENCES teams(team_id),
    target_role_id UUID,
    target_agent_id UUID REFERENCES agent_profiles(agent_id),
    delegation_type VARCHAR(50),
    objective TEXT,
    scope TEXT,
    state VARCHAR(50) DEFAULT 'pending',
    cost_limit DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

### Artifacts & Reviews

```sql
-- Artifact Types
CREATE TYPE artifact_type AS ENUM (
    'Vision Brief', 'Architecture Proposal', 'ADR', 'System Design',
    'Technical Spec', 'API Contract', 'Test Plan', 'Test Report',
    'Review Report', 'Documentation Draft', 'Release Notes'
);

-- Artifact
CREATE TABLE artifacts (
    artifact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type artifact_type NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'Draft',
    version VARCHAR(50) DEFAULT '1.0.0',
    owner_team_id UUID REFERENCES teams(team_id),
    owner_agent_id UUID REFERENCES agent_profiles(agent_id),
    source_work_item_id UUID REFERENCES work_items(work_item_id),
    content TEXT,
    approval_state VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Review
CREATE TABLE reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_type VARCHAR(50),
    target_work_item_id UUID REFERENCES work_items(work_item_id),
    target_artifact_id UUID REFERENCES artifacts(artifact_id),
    reviewer_role_id UUID,
    reviewer_agent_id UUID REFERENCES agent_profiles(agent_id),
    result VARCHAR(50),
    findings TEXT,
    mandatory_fixes JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);
```

### Governance

```sql
-- Policy Types
CREATE TYPE policy_type AS ENUM (
    'tool_policy', 'mcp_policy', 'plugin_policy', 'skill_policy',
    'filesystem_policy', 'git_policy', 'review_policy', 'test_policy',
    'release_policy', 'budget_policy', 'escalation_policy'
);

-- Policy
CREATE TABLE policies (
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    policy_type policy_type NOT NULL,
    scope_type VARCHAR(50),
    scope_id UUID,
    condition_expression TEXT,
    action VARCHAR(50),
    severity VARCHAR(50),
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Approval Policy
CREATE TABLE approval_policies (
    approval_policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    applies_to VARCHAR(50),
    trigger_conditions JSONB DEFAULT '{}',
    approver_chain JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Approval Request
CREATE TABLE approval_requests (
    approval_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(50),
    target_id UUID,
    reason TEXT,
    requested_by_role_id UUID,
    requested_by_agent_id UUID REFERENCES agent_profiles(agent_id),
    state VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP
);
```

---

## API Endpunkte

### Organization
```
GET    /api/v1/companies
POST   /api/v1/companies
GET    /api/v1/companies/:id
PUT    /api/v1/companies/:id
DELETE /api/v1/companies/:id
GET    /api/v1/companies/:id/hierarchy
GET    /api/v1/companies/:id/org-chart

GET    /api/v1/divisions
POST   /api/v1/divisions
GET    /api/v1/divisions/:id
PUT    /api/v1/divisions/:id
DELETE /api/v1/divisions/:id

GET    /api/v1/departments
POST   /api/v1/departments
GET    /api/v1/departments/:id
PUT    /api/v1/departments/:id
DELETE /api/v1/departments/:id

GET    /api/v1/teams
POST   /api/v1/teams
GET    /api/v1/teams/:id
PUT    /api/v1/teams/:id
DELETE /api/v1/teams/:id
```

### Roles & Agents
```
GET    /api/v1/role-templates
POST   /api/v1/role-templates
GET    /api/v1/role-templates/:id
PUT    /api/v1/role-templates/:id
DELETE /api/v1/role-templates/:id
POST   /api/v1/role-templates/:id/duplicate

GET    /api/v1/agent-profiles
POST   /api/v1/agent-profiles
GET    /api/v1/agent-profiles/:id
PUT    /api/v1/agent-profiles/:id
DELETE /api/v1/agent-profiles/:id
POST   /api/v1/agent-profiles/:id/activate
POST   /api/v1/agent-profiles/:id/deactivate
```

### Work Items
```
GET    /api/v1/work-items
POST   /api/v1/work-items
GET    /api/v1/work-items/:id
PUT    /api/v1/work-items/:id
DELETE /api/v1/work-items/:id
POST   /api/v1/work-items/:id/transition
GET    /api/v1/work-items/:id/history
```

### Artifacts
```
GET    /api/v1/artifacts
POST   /api/v1/artifacts
GET    /api/v1/artifacts/:id
PUT    /api/v1/artifacts/:id
DELETE /api/v1/artifacts/:id
POST   /api/v1/artifacts/:id/versions
GET    /api/v1/artifacts/:id/versions
```

---

## Implementierungssequenz (10 Wochen)

### Sprint 1-2: Setup & Datenbank
- Projekt-Setup (Node.js, TypeScript, Fastify)
- Prisma-Konfiguration
- Datenbankschema erstellen
- Migrationen

### Sprint 3-4: Organization Domain
- Company, Division, Department, Team Entities
- Repositories
- API Routes
- Tests

### Sprint 5-6: Roles & Work Domain
- Role Templates, Agent Profiles
- WorkItems, Delegations
- State Machine
- API Routes

### Sprint 7-8: Artifacts & Governance
- Artifacts, Reviews
- Policies, Approval Policies
- API Routes

### Sprint 9-10: Integration & Auth
- Template System
- Authentication
- API-Dokumentation (Swagger)
- E2E Tests

---

## Akzeptanzkriterien

- [ ] Alle ~40 Entitäten in Datenbank
- [ ] 120+ API Endpunkte implementiert
- [ ] CRUD für alle Domänen
- [ ] Authentifizierung funktioniert
- [ ] API-Dokumentation verfügbar
- [ ] E2E Tests passieren
