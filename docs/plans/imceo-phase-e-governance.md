# Phase E: Governance & Integrations - Implementierungsplan

**Ziel:** Policy Engine, Approval Workflows, MCP Management, Plugin Management, Skill Management

**Dauer:** 8 Wochen

**Abhängigkeiten:** Phase A, Phase D

---

## Harte Systemregeln

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

---

## Policy-Typen

```typescript
type PolicyType =
  | 'tool_policy'           // Werkzeugnutzung
  | 'mcp_policy'           // MCP-Zugriff
  | 'plugin_policy'        // Plugin-Nutzung
  | 'skill_policy'         // Skill-Ausführung
  | 'filesystem_policy'    // Dateisystemzugriff
  | 'git_policy'           // Git-Operationen
  | 'review_policy'        // Review-Anforderungen
  | 'test_policy'          // Test-Anforderungen
  | 'release_policy'       // Release-Gates
  | 'budget_policy'        // Budget-Limits
  | 'secrecy_policy'       // Vertraulichkeit
  | 'escalation_policy';   // Eskalationsregeln

type PolicyAction =
  | 'allow'
  | 'allow_with_warning'
  | 'require_approval'
  | 'block'
  | 'quarantine'
  | 'escalate';
```

---

## Policy Engine

```typescript
interface PolicyDefinition {
  policyId: string;
  name: string;
  policyType: PolicyType;
  scopeType: 'company' | 'division' | 'department' | 'team' | 'role';
  scopeId: string;
  conditionExpression: string;  // z.B. "cost > 100 OR sensitivity == 'high'"
  action: PolicyAction;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}

class PolicyEngine {
  async evaluate(context: PolicyContext): Promise<PolicyResult>;
  async checkViolations(scopeId: string): Promise<PolicyViolation[]>;
  async enforce(policyId: string, context: PolicyContext): Promise<EnforcementResult>;
}
```

---

## Approval System

```typescript
interface ApprovalPolicy {
  approvalPolicyId: string;
  name: string;
  appliesTo: string;  // 'work_item', 'artifact', 'delegation', etc.
  triggerConditions: JSON;
  approverChain: string[];  // Role IDs in Reihenfolge
  expiryMode: 'auto_reject' | 'escalate' | 'indefinite';
}

interface ApprovalRequest {
  approvalRequestId: string;
  targetType: string;
  targetId: string;
  reason: string;
  requestedByRoleId: string;
  requiredApproverRoleIds: string[];
  state: 'pending' | 'approved' | 'rejected' | 'escalated';
  expiresAt?: Date;
}
```

---

## Integrationstypen

```typescript
enum IntegrationType {
  FILESYSTEM = 'filesystem',
  GIT = 'git',
  CI_CD = 'ci_cd',
  DOCS = 'docs',
  ISSUE_TRACKER = 'issue_tracker',
  DESIGN_SOURCE = 'design_source',
  MCP = 'mcp',
  TERMINAL = 'terminal',
  NOTIFICATIONS = 'notifications',
  SECRETS_MANAGER = 'secrets_manager'
}
```

---

## MCP Management

```typescript
interface MCPDefinition {
  mcpId: string;
  name: string;
  provider: string;
  connectionType: 'stdio' | 'sse' | 'http';
  authMode: 'none' | 'api_key' | 'oauth';
  capabilitiesRead: string[];
  capabilitiesWrite: string[];
  capabilitiesExecute: string[];
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical';
  allowedRoles: string[];
  deniedRoles: string[];
  approvalRequirements: string[];
}
```

---

## Plugin Management

```typescript
interface PluginDefinition {
  pluginId: string;
  name: string;
  source: string;
  vendor: string;
  trustLevel: 'official' | 'verified' | 'community' | 'unverified';
  exposedCommands: string[];
  exposedAgents: string[];
  exposedMCps: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiredPermissions: string[];
}
```

---

## Skill Management

```typescript
interface SkillDefinition {
  skillId: string;
  name: string;
  category: 'planning' | 'analysis' | 'architecture' | 'implementation'
          | 'testing' | 'review' | 'documentation' | 'release' | 'communication';
  invocationMode: 'manual' | 'automatic' | 'triggered';
  promptBody: string;
  requiredInputs: string[];
  expectedOutputs: string[];
  allowedRoles: string[];
  riskLevel: 'low' | 'medium' | 'high';
}
```

---

## API Endpunkte

### Policies
```
GET    /api/v1/policies
POST   /api/v1/policies
GET    /api/v1/policies/:id
PUT    /api/v1/policies/:id
DELETE /api/v1/policies/:id
POST   /api/v1/policies/:id/test
GET    /api/v1/policies/violations
```

### Approvals
```
GET    /api/v1/approvals
POST   /api/v1/approvals
GET    /api/v1/approvals/:id
POST   /api/v1/approvals/:id/grant
POST   /api/v1/approvals/:id/reject
```

### MCPs
```
GET    /api/v1/mcps
POST   /api/v1/mcps
GET    /api/v1/mcps/:id
POST   /api/v1/mcps/:id/test
POST   /api/v1/mcps/:id/healthcheck
```

### Plugins
```
GET    /api/v1/plugins
POST   /api/v1/plugins/install
GET    /api/v1/plugins/:id
POST   /api/v1/plugins/:id/enable
POST   /api/v1/plugins/:id/disable
```

### Skills
```
GET    /api/v1/skills
POST   /api/v1/skills
GET    /api/v1/skills/:id
POST   /api/v1/skills/:id/invoke
```

---

## Implementierungssequenz (8 Wochen)

### Sprint 1-2: Policy Engine
- Policy Definition
- Condition Evaluation
- Enforcement Actions

### Sprint 3-4: Approval System
- Approval Policies
- Request Workflow
- Chain of Approvers

### Sprint 5-6: MCP & Plugin Management
- MCP Definition
- Plugin Lifecycle
- Risk Assessment

### Sprint 7-8: Skill Management & Integration
- Skill Definition
- Skill Invocation
- Integration Framework

---

## Akzeptanzkriterien

- [ ] 12 Policy-Typen implementiert
- [ ] Policy Engine mit Conditions
- [ ] Approval Workflows
- [ ] MCP Management
- [ ] Plugin Risk Levels
- [ ] Skill Categories
- [ ] 10 harte Systemregeln durchgesetzt
