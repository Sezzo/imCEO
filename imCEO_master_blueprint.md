# imCEO — AI Company Operating System for Claude Agent Teams
Version: 1.0  
Status: Target Product Specification  
Artifact Type: Master Product Blueprint  
Language: German

---

# 1. Produktüberblick

## 1.1 Produktname
**imCEO**

## 1.2 Positionierung
**imCEO** ist ein visuelles Unternehmensbetriebssystem für **Claude Agent Teams**.  
Der Nutzer agiert als CEO, Founder oder Eigentümer und steuert das Unternehmen über Vision, Prioritäten, Entscheidungen und Freigaben. Das System bildet daraus eine hierarchische Organisation aus Management, Teamleitern und Spezialisten, die Arbeit wie in einem realen Unternehmen plant, delegiert, ausführt, testet, reviewed, dokumentiert und freigibt.

## 1.3 Ziel
Das System soll es ermöglichen, ohne Code eine künstliche Firma zu entwerfen und zu betreiben, in der Claude Agent Teams arbeitsteilig handeln. Der Nutzer formuliert nicht jeden Task selbst, sondern gibt die Unternehmensrichtung vor. Das System übersetzt diese Richtung in strukturierte Arbeit.

## 1.4 Kernprinzip
- Nutzer = CEO / oberster Entscheider
- Claude Agent Teams = operative Ausführungseinheiten
- imCEO = Steuerungsschicht für:
  - Organisation
  - Rollen
  - Workflows
  - Governance
  - Freigaben
  - Artefakte
  - Beobachtbarkeit
  - Kostenkontrolle
  - MCPs
  - Skills
  - Plugins

## 1.5 Produktcharakter
imCEO ist **kein einfacher Agent-Chat** und **kein bloßer Team-Editor**.  
imCEO ist ein **Operating System für AI-Unternehmen**.

---

# 2. Produktziele

## 2.1 Primäre Ziele
1. Visuelle Modellierung einer künstlichen Firma
2. Top-down-Führung durch einen CEO
3. Hierarchische Delegation über Management und Teamleiter
4. Rollen-, Modell-, Prompt-, Skill-, MCP- und Plugin-Konfiguration je Team und Agent
5. Vollständige Abbildung realer Wissensarbeit:
   - Vision
   - Planung
   - Architektur
   - Umsetzung
   - Testing
   - Review
   - Dokumentation
   - Release
   - Retrospektive
6. Nachvollziehbarkeit jeder Aktion
7. Kontrollierte Tool-Nutzung durch Policies und Freigaben
8. Skalierbare Arbeitsorganisation mit klaren Zuständigkeiten

## 2.2 Sekundäre Ziele
1. Wiederverwendbare Unternehmens-Templates
2. Wiederverwendbare Rollen-, Team-, Workflow-, Skill-, MCP- und Plugin-Bundles
3. Multi-Projekt- und Multi-Programm-Betrieb
4. Klare Trennung zwischen Strategie, Planung, Delivery und Governance
5. Hohe Transparenz über Kosten, Zustand und Engpässe

---

# 3. Produktgrundsätze

## 3.1 Hierarchie ist verpflichtend
Das System basiert auf einer realen Befehlskette:
- CEO
- Executive Office
- Management
- Team Leads
- Specialists
- Governance / Review / QA / Compliance

## 3.2 Kommunikation ist geroutet
Nicht jeder Agent kommuniziert direkt mit jedem anderen Agenten. Standardkommunikation erfolgt:
- top-down für Ziele, Prioritäten, Entscheidungen
- bottom-up für Fortschritte, Risiken, Blocker, Ergebnisse

## 3.3 Alles ist zustandsbasiert
Arbeit wird über Zustände und Übergänge verwaltet, nicht über lose Chats.

## 3.4 Alles ist artefaktbasiert
Arbeitsergebnisse existieren als strukturierte Artefakte, nicht nur als Nachrichten.

## 3.5 Jeder Agent hat harte Zuständigkeiten
Jeder Agent besitzt:
- Rolle
- Verantwortungsbereich
- Entscheidungsgrenzen
- Toolgrenzen
- Modellkonfiguration
- Skills
- MCPs
- Plugins
- Eskalationsregeln
- Ausgabeverträge
- Qualitätsanforderungen

## 3.6 Governance sitzt nicht nur im Prompt
Prompts allein reichen nicht. Harte Regeln werden über Policy- und Approval-Mechanismen modelliert.

## 3.7 CEO bleibt auf Führungsebene
Der Nutzer soll standardmäßig mit Executive- und Management-Ebene interagieren, nicht mit jedem Spezialisten einzeln.

---

# 4. Zielnutzer

## 4.1 Hauptnutzer
- Founder
- CEO
- Solo-Unternehmer mit Agentenfirma
- Technical Founder
- Produktverantwortliche mit starkem Steuerungsanspruch
- Agentic-Workflow-Builder

## 4.2 Sekundäre Nutzer
- Team Leads
- Product Leads
- Architects
- QA Leads
- Operators
- Human Approvers in hybriden Setups

---

# 5. Systemische Hauptbereiche

imCEO besteht logisch aus folgenden Hauptdomänen:

1. **Organization Domain**
2. **Roles & Capabilities Domain**
3. **Work Domain**
4. **Artifact Domain**
5. **Runtime Domain**
6. **Governance Domain**
7. **Integration Domain**
8. **Observability & Cost Domain**
9. **Template Domain**
10. **CEO Vision Intake Domain**

---

# 6. Organisationsmodell

## 6.1 Entitäten

### 6.1.1 Company
Repräsentiert die gesamte künstliche Firma.

**Felder**
- company_id
- name
- description
- industry
- primary_objective
- operating_mode
- global_prompt
- global_policies
- global_skills
- global_mcps
- global_plugins
- global_quality_gates
- global_approval_rules
- default_model_policy
- default_cost_policy
- default_context_policy
- created_at
- updated_at

### 6.1.2 Division
Grobe oberste Funktionsblöcke.

**Beispiele**
- Executive
- Product
- Engineering
- Platform
- QA
- Security
- Documentation
- Research
- Operations

**Felder**
- division_id
- company_id
- name
- description
- parent_division_id (optional)
- head_role_id
- policies
- default_workflows
- created_at
- updated_at

### 6.1.3 Department
Feiner gegliederte Einheiten innerhalb von Divisions.

**Felder**
- department_id
- division_id
- name
- description
- head_role_id
- scope
- policies
- created_at
- updated_at

### 6.1.4 Team
Operative Zusammenarbeitseinheit.

**Felder**
- team_id
- department_id
- name
- description
- mission
- team_type
- lead_role_id
- default_model_profile_id
- default_prompt_bundle_id
- default_skill_bundle_id
- default_mcp_bundle_id
- default_plugin_bundle_id
- default_workflow_id
- default_artifact_set_id
- allowed_interactions
- escalation_chain_id
- cost_budget_policy_id
- context_budget_policy_id
- created_at
- updated_at

### 6.1.5 ReportingLine
Beschreibt Linienbeziehungen.

**Felder**
- reporting_line_id
- source_role_id
- target_role_id
- line_type
- priority
- created_at

**line_type**
- disciplinary
- operational
- escalation
- approval
- advisory

### 6.1.6 EscalationChain
Beschreibt die Eskalationsreihenfolge.

**Felder**
- escalation_chain_id
- name
- description
- ordered_role_ids
- trigger_conditions
- created_at
- updated_at

---

# 7. Rollen- und Agentenmodell

## 7.1 RoleTemplate

**Felder**
- role_template_id
- name
- hierarchy_level
- description
- purpose
- primary_responsibilities
- non_responsibilities
- decision_scope
- escalation_scope
- required_artifacts
- required_reviews
- default_output_contract_id
- default_prompt_template_id
- default_model_profile_id
- default_skill_bundle_id
- default_mcp_bundle_id
- default_plugin_bundle_id
- command_policy_id
- filesystem_policy_id
- git_policy_id
- approval_policy_id
- retry_policy_id
- timeout_policy_id
- cost_class
- context_budget_class
- created_at
- updated_at

## 7.2 AgentProfile

Konkrete operative Instanz eines Agenten.

**Felder**
- agent_id
- team_id
- role_template_id
- display_name
- internal_name
- seniority
- status
- custom_prompt_override
- model_profile_override_id
- skill_bundle_override_id
- mcp_bundle_override_id
- plugin_bundle_override_id
- permissions_override
- active_policy_overrides
- max_parallel_tasks
- max_context_budget
- max_cost_per_task
- idle_behavior
- failure_behavior
- created_at
- updated_at

## 7.3 Hierarchieebenen
- CEO
- Executive
- Management
- Lead
- Specialist
- Governance
- Observer

## 7.4 Standardrollen

### Executive
- CEO Proxy
- Chief of Staff
- Strategy Director
- Portfolio Director

### Product
- Product Director
- Product Manager
- Product Analyst

### Architecture & Engineering
- Principal Architect
- Engineering Manager
- Backend Lead
- Frontend Lead
- Fullstack Lead
- Senior Engineer
- Engineer

### Quality & Governance
- QA Lead
- QA Engineer
- Security Reviewer
- Compliance Reviewer
- Release Manager
- Audit Officer

### Support
- Technical Writer
- Research Analyst
- Documentation Specialist
- DevOps Engineer
- Platform Engineer

---

# 8. Capabilities: Modelle, Skills, MCPs, Plugins

## 8.1 ModelProfile

**Felder**
- model_profile_id
- name
- provider
- model_name
- purpose
- max_parallel_calls
- max_context_size
- default_temperature
- cost_tier
- latency_tier
- allowed_roles
- forbidden_roles
- fallback_model_profile_id
- created_at
- updated_at

## 8.2 SkillDefinition

Skills sind wiederverwendbare Arbeitsmodule.

**Felder**
- skill_id
- name
- description
- category
- invocation_mode
- trigger_conditions
- owner_type
- owner_id
- version
- prompt_body
- required_inputs
- expected_outputs
- quality_checks
- allowed_roles
- required_roles
- linked_mcps
- linked_plugins
- risk_level
- created_at
- updated_at

**Kategorien**
- planning
- analysis
- architecture
- implementation
- testing
- review
- documentation
- release
- communication
- summarization

## 8.3 MCPDefinition

**Felder**
- mcp_id
- name
- description
- provider
- connection_type
- auth_mode
- base_endpoint
- sensitivity_level
- capabilities_read
- capabilities_write
- capabilities_execute
- allowed_company_scope
- allowed_divisions
- allowed_departments
- allowed_teams
- allowed_roles
- denied_roles
- approval_requirements
- audit_level
- healthcheck_definition
- cost_profile
- created_at
- updated_at

## 8.4 PluginDefinition

**Felder**
- plugin_id
- name
- description
- source
- vendor
- marketplace
- trust_level
- exposed_commands
- exposed_agents
- exposed_hooks
- exposed_mcps
- required_permissions
- allowed_scopes
- install_scope
- enable_scope
- update_policy
- version_policy
- risk_level
- created_at
- updated_at

## 8.5 Bundle-Objekte

Zur Wiederverwendung braucht das System Bundles.

### 8.5.1 SkillBundle
- skill_bundle_id
- name
- description
- skill_ids

### 8.5.2 MCPBundle
- mcp_bundle_id
- name
- description
- mcp_ids

### 8.5.3 PluginBundle
- plugin_bundle_id
- name
- description
- plugin_ids

### 8.5.4 PromptBundle
- prompt_bundle_id
- name
- description
- global_layers
- local_layers

---

# 9. Prompt- und Verhaltensmodell

## 9.1 Prompt-Schichten
Das System nutzt mehrschichtige Instruktionsebenen:

1. Company Prompt
2. Division Prompt
3. Department Prompt
4. Team Prompt
5. Role Prompt
6. Task Prompt
7. Artifact Context Injection
8. Policy Injection
9. Output Contract Injection

## 9.2 PromptTemplate

**Felder**
- prompt_template_id
- name
- scope
- description
- body
- variables
- conflict_resolution_mode
- version
- created_at
- updated_at

## 9.3 OutputContract

**Felder**
- output_contract_id
- name
- description
- schema_type
- schema_body
- mandatory_sections
- validation_rules
- severity_if_invalid
- created_at
- updated_at

## 9.4 BehaviorProfile
Zusätzliche Verhaltenseinstellungen.

**Felder**
- behavior_profile_id
- name
- communication_style
- risk_tolerance
- delegation_style
- escalation_sensitivity
- verbosity_mode
- reporting_frequency
- self_check_policy
- created_at
- updated_at

---

# 10. Arbeitsmodell

## 10.1 Strategische Arbeitselemente
- Vision
- Goal
- Initiative
- Program
- Workstream

## 10.2 Delivery-Arbeitselemente
- Epic
- Story
- Task
- Subtask
- Bug
- Spike
- ReviewTask
- TestTask
- ReleaseTask

## 10.3 Governance-Arbeitselemente
- Risk
- Decision
- ApprovalRequest
- ExceptionCase
- AuditFinding
- ComplianceFinding

## 10.4 WorkItem

**Felder**
- work_item_id
- type
- title
- description
- parent_work_item_id
- company_id
- division_id
- department_id
- owning_team_id
- owning_role_id
- assigned_agent_id
- sponsor_role_id
- priority
- severity
- strategic_alignment
- scope_definition
- constraints
- dependencies
- blockers
- success_criteria
- definition_of_done
- required_artifacts
- required_reviews
- required_tests
- state
- approval_state
- risk_score
- cost_limit
- context_limit
- estimated_effort
- actual_effort
- created_at
- started_at
- due_at
- completed_at
- archived_at

## 10.5 Prioritäten
- critical
- high
- medium
- low
- backlog

## 10.6 State Machine für WorkItems
- Draft
- Proposed
- Approved
- Planned
- Ready
- In Progress
- Waiting on Dependency
- In Review
- Changes Requested
- In Test
- Awaiting Approval
- Blocked
- Approved for Completion
- Done
- Archived
- Reopened
- Rejected
- Cancelled

---

# 11. Artefaktmodell

## 11.1 Artifact

**Felder**
- artifact_id
- type
- title
- description
- status
- version
- owner_team_id
- owner_role_id
- owner_agent_id
- parent_artifact_id
- source_work_item_id
- related_work_item_ids
- related_decision_ids
- related_review_ids
- related_test_ids
- storage_uri
- content_hash
- visibility_scope
- approval_state
- generated_by
- modified_by
- created_at
- updated_at
- approved_at
- archived_at

## 11.2 Standard-Artefakttypen

### Strategisch
- Vision Brief
- Strategic Memo
- Goal Definition
- Program Charter
- Workstream Map

### Technisch
- Architecture Proposal
- ADR
- System Design
- Technical Spec
- API Contract
- Data Contract
- Integration Spec
- Migration Plan

### Delivery
- Task Brief
- Implementation Plan
- Patch Summary
- Diff Summary
- Test Plan
- Test Report
- Review Report
- Documentation Draft
- Release Notes

### Governance
- Security Review
- Compliance Report
- Approval Record
- Exception Log
- Audit Report
- Incident Report
- Retrospective
- Lessons Learned

## 11.3 Artifact States
- Draft
- In Preparation
- Under Review
- Approved
- Superseded
- Archived

---

# 12. Kommunikationsmodell

## 12.1 CommunicationRecord

**Felder**
- communication_id
- source_role_id
- source_agent_id
- target_role_id
- target_agent_id
- target_team_id
- communication_type
- subject
- body
- linked_work_item_id
- linked_artifact_ids
- severity
- requires_response
- response_due_at
- created_at
- resolved_at

## 12.2 Kommunikationstypen
- directive
- delegation
- clarification
- inquiry
- report
- status_update
- escalation
- decision
- approval_request
- review_feedback
- blocker_notice
- handoff

## 12.3 Kommunikationsregeln
1. CEO kommuniziert standardmäßig mit Executive Office oder Management
2. Management kommuniziert mit Leads
3. Leads kommunizieren mit ihren Spezialisten
4. Spezialisten eskalieren an Leads
5. Spezialisten dürfen nur dann direkt teamübergreifend kommunizieren, wenn Policy oder Workflow es erlaubt
6. Governance-Funktionen dürfen relevante Teams direkt adressieren
7. Rohresultate werden nach oben konsolidiert, nicht ungefiltert durchgereicht

---

# 13. Delegationsmodell

## 13.1 DelegationRecord

**Felder**
- delegation_id
- source_work_item_id
- source_agent_id
- source_role_id
- target_team_id
- target_role_id
- target_agent_id
- delegation_type
- objective
- scope
- constraints
- input_artifact_ids
- expected_output_artifact_types
- required_reviews
- required_tests
- approval_mode
- escalation_mode
- due_mode
- cost_limit
- context_limit
- model_override_id
- required_skill_ids
- required_mcp_ids
- required_plugin_ids
- state
- created_at
- accepted_at
- completed_at
- failed_at

## 13.2 Delegationstypen
- research
- planning
- analysis
- architecture
- implementation
- testing
- review
- documentation
- compliance
- release_preparation
- incident_response
- remediation

## 13.3 Delegationsregeln
1. Jeder delegierte Auftrag braucht Ziel, Scope und Completion-Kriterien
2. Delegationen dürfen nie ohne Eigentümer existieren
3. Teamleiter konsolidieren Ergebnisse ihrer Spezialisten
4. Management darf Team-übergreifende Delegationen auslösen
5. CEO delegiert standardmäßig nicht an Spezialisten, sondern an Executive- oder Management-Rollen

---

# 14. Entscheidungsmodell

## 14.1 DecisionRecord

**Felder**
- decision_id
- title
- description
- decision_type
- decision_scope
- proposed_by_role_id
- proposed_by_agent_id
- approved_by_role_id
- approved_by_agent_id
- linked_work_item_ids
- linked_artifact_ids
- rationale
- alternatives_considered
- tradeoffs
- impact_areas
- status
- decided_at
- superseded_by_decision_id

## 14.2 Entscheidungstypen
- operational
- tactical
- architectural
- security
- compliance
- budgetary
- strategic

## 14.3 Entscheidungsrechte
- Specialists: operative Entscheidungen im eigenen Scope
- Leads: lokale Planung, Delegation, Reviewrouting
- Management: funktionsübergreifende Priorisierung, Scope-Abstimmung
- CEO: Strategie, Richtung, größere Trade-offs, finale Prioritäten

---

# 15. Reviewmodell

## 15.1 ReviewRecord

**Felder**
- review_id
- review_type
- target_work_item_id
- target_artifact_id
- reviewer_role_id
- reviewer_agent_id
- result
- findings
- mandatory_fixes
- optional_notes
- severity
- created_at
- resolved_at

## 15.2 Reviewtypen
- peer_review
- lead_review
- architecture_review
- qa_review
- security_review
- compliance_review
- executive_review

## 15.3 Reviewresultate
- approved
- approved_with_notes
- changes_requested
- rejected
- escalated

## 15.4 Grundregeln
1. Kein Abschluss ohne definierte Pflichtreviews
2. Architekturänderungen brauchen Architecture Review
3. Sicherheitsrelevante Änderungen brauchen Security Review
4. Release-Kandidaten brauchen QA- und Release-Gate
5. Teamleiter dürfen nicht alle ihre eigenen Outputs allein finalisieren

---

# 16. Testmodell

## 16.1 TestRequirement

**Felder**
- test_requirement_id
- name
- description
- test_type
- applies_to_work_item_types
- applies_to_artifact_types
- applies_to_risk_levels
- blocking
- required_pass_threshold
- auto_run
- created_at
- updated_at

## 16.2 TestRun

**Felder**
- test_run_id
- work_item_id
- artifact_id
- initiated_by_role_id
- initiated_by_agent_id
- test_type
- status
- result_summary
- pass_rate
- blocking_failures
- report_artifact_id
- started_at
- completed_at

## 16.3 Testtypen
- lint
- static_analysis
- unit
- integration
- e2e
- regression
- smoke
- security
- policy_verification
- acceptance

---

# 17. Governance- und Policy-Modell

## 17.1 PolicyDefinition

**Felder**
- policy_id
- name
- description
- policy_type
- scope_type
- scope_id
- condition_expression
- action
- severity
- approval_requirement
- escalation_requirement
- enabled
- created_at
- updated_at

## 17.2 Policytypen
- tool_policy
- mcp_policy
- plugin_policy
- skill_policy
- filesystem_policy
- git_policy
- branch_policy
- review_policy
- test_policy
- release_policy
- budget_policy
- secrecy_policy
- escalation_policy

## 17.3 Actions
- allow
- allow_with_warning
- require_approval
- block
- quarantine
- escalate

## 17.4 ApprovalPolicy

**Felder**
- approval_policy_id
- name
- description
- applies_to
- trigger_conditions
- approver_chain
- expiry_mode
- fallback_on_timeout
- created_at
- updated_at

## 17.5 ApprovalRequest

**Felder**
- approval_request_id
- target_type
- target_id
- reason
- requested_by_role_id
- requested_by_agent_id
- required_approver_role_ids
- state
- expires_at
- approved_at
- rejected_at
- escalated_at

## 17.6 Harte Systemregeln
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

# 18. Runtime-Modell

## 18.1 TeamSession

**Felder**
- team_session_id
- team_id
- initiating_work_item_id
- session_purpose
- current_state
- current_cost
- current_context_usage
- launched_at
- ended_at

## 18.2 AgentSession

**Felder**
- agent_session_id
- team_session_id
- agent_id
- assigned_work_item_id
- state
- cost_accumulated
- context_accumulated
- started_at
- last_active_at
- ended_at
- failure_reason

## 18.3 RuntimeEvent

**Felder**
- runtime_event_id
- team_session_id
- agent_session_id
- event_type
- payload
- severity
- created_at

## 18.4 Runtime States
### Team Session
- Queued
- Launching
- Active
- Waiting
- Idle
- Failed
- Completed
- Terminated

### Agent Session
- Assigned
- Running
- Waiting
- Idle
- Blocked
- Failed
- Completed
- Killed

## 18.5 Runtime-Regeln
1. Jede Session ist an WorkItems oder operative Ziele gebunden
2. Jede Session protokolliert Kosten
3. Jede Session protokolliert Events
4. Idle-Agenten werden sichtbar markiert
5. Fehler erzeugen Failure Records
6. Recovery kann konfiguriert oder manuell entschieden werden

---

# 19. Kosten- und Ressourcenmodell

## 19.1 CostRecord

**Felder**
- cost_record_id
- scope_type
- scope_id
- team_id
- agent_id
- model_profile_id
- work_item_id
- cost_type
- value
- unit
- recorded_at

## 19.2 Costtypen
- token_input
- token_output
- session_cost
- task_cost
- team_cost
- plugin_cost
- mcp_cost
- tool_execution_cost

## 19.3 BudgetPolicy
- max_cost_per_task
- max_cost_per_team_session
- max_cost_per_day
- max_parallel_agents
- max_parallel_team_sessions
- require_approval_above

## 19.4 Kostenregeln
1. Jede Rolle kann ein Kostenprofil besitzen
2. Jede Delegation kann ein Kostenlimit besitzen
3. Management und CEO müssen Kostenpfade sehen können
4. Kritische Kostenüberschreitungen lösen Escalations aus

---

# 20. Memory- und Kontextmodell

## 20.1 Kontextschichten
- Company Context
- Division Context
- Department Context
- Team Context
- Role Context
- Work Item Context
- Artifact Context
- Runtime Temporary Context

## 20.2 Memory-Typen
- static_instructions
- persistent_org_knowledge
- project_memory
- work_item_memory
- audit_memory
- summarized_session_memory

## 20.3 Kontextregeln
1. CEO-Kontext wird nicht blind an alle Spezialisten verteilt
2. Spezialisten erhalten nur relevanten Arbeitskontext
3. Teamleiter konsolidieren
4. Management abstrahiert
5. Artefakte sind primäre Wissensquelle
6. Abgeschlossene Sessions werden verdichtet gespeichert

---

# 21. Integrationsmodell

## 21.1 IntegrationDefinition

**Felder**
- integration_id
- name
- integration_type
- description
- provider
- connection_mode
- auth_mode
- enabled
- policies
- created_at
- updated_at

## 21.2 Integrationstypen
- filesystem
- git
- ci_cd
- docs
- issue_tracker
- design_source
- mcp
- terminal
- notifications
- secrets_manager

## 21.3 Integrationsregeln
1. Jede Integration ist policy-gesteuert
2. Sensible Integrationen haben eigene Approval-Regeln
3. Integrationen sind auditiert
4. Integrationen können an Company-, Team- oder Rollen-Scope gebunden werden

---

# 22. Fehler- und Recovery-Modell

## 22.1 FailureRecord

**Felder**
- failure_id
- scope_type
- scope_id
- failure_type
- description
- severity
- related_work_item_id
- related_agent_id
- related_team_id
- proposed_recovery_action
- recovery_state
- created_at
- resolved_at

## 22.2 Fehlertypen
- task_failed
- invalid_output
- policy_violation
- tool_failure
- dependency_blocked
- idle_timeout
- review_rejection
- inconsistent_decision
- excessive_cost
- missing_artifact
- lost_ownership
- runtime_failure

## 22.3 Recovery Actions
- retry_same_agent
- retry_different_agent
- escalate_to_lead
- escalate_to_management
- split_task
- request_clarification
- quarantine_output
- rollback_state
- require_human_decision

---

# 23. Beobachtbarkeit und Audit

## 23.1 AuditEvent

**Felder**
- audit_event_id
- event_type
- actor_role_id
- actor_agent_id
- target_type
- target_id
- description
- payload
- severity
- created_at

## 23.2 Beobachtungsansichten
Das Produkt muss folgende Ansichten bieten:
- Organigramm
- aktive Teams
- aktive Agenten
- Delegationsgraph
- WorkItem-Board
- Artefaktzentrum
- Kosten-Dashboard
- Policy-Verstöße
- Approvals
- Idle-States
- Fehlercluster
- Audit-Timeline

---

# 24. Template-System

## 24.1 Template-Typen
- CompanyTemplate
- DivisionTemplate
- DepartmentTemplate
- TeamTemplate
- RoleTemplate
- WorkflowTemplate
- SkillTemplate
- MCPTemplate
- PluginTemplate
- PromptTemplate
- ApprovalTemplate
- PolicyTemplate
- VisionTemplate

## 24.2 Template-Regeln
1. Templates sind versioniert
2. Templates können vererbt werden
3. Templates können überschrieben werden
4. Änderungen an Templates dürfen laufende Sessions nicht unkontrolliert verändern

---

# 25. Workflow-System

## 25.1 WorkflowDefinition

**Felder**
- workflow_id
- name
- description
- applies_to_work_item_types
- states
- transitions
- triggers
- guards
- required_artifacts
- required_reviews
- required_tests
- approval_hooks
- escalation_hooks
- created_at
- updated_at

## 25.2 Standard-Workflow für Delivery
1. Draft
2. Proposed
3. Approved
4. Planned
5. Ready
6. In Progress
7. In Review
8. Changes Requested oder In Test
9. Awaiting Approval
10. Approved for Completion
11. Done
12. Archived

## 25.3 Trigger-Typen
- manual
- automatic
- artifact_created
- review_completed
- test_completed
- approval_granted
- policy_triggered
- timeout
- cost_threshold_breached
- dependency_resolved

---

# 26. UI-Informationsarchitektur

## 26.1 Hauptmodule
1. Dashboard
2. Company Designer
3. Teams & Roles
4. Vision Intake
5. Strategy & Planning
6. Operations Board
7. Artifacts
8. Runtime Monitor
9. Reviews & Approvals
10. Policies & Governance
11. Integrations
12. Templates
13. Audit & Costs
14. Settings

## 26.2 Screen-Spezifikation

### 26.2.1 Dashboard
**Zweck**
Schneller Überblick über Zustand des Unternehmens

**Inhalte**
- aktive Programme
- laufende TeamSessions
- offene Approvals
- kritische Risiken
- Kosten heute
- blockierte WorkItems
- letzte Executive-Berichte

### 26.2.2 Company Designer
**Zweck**
Visuelles Organigramm bearbeiten

**Aktionen**
- Division anlegen
- Department anlegen
- Team anlegen
- Berichtslinie ziehen
- Eskalationslinie definieren
- Teamleiter festlegen

### 26.2.3 Teams & Roles
**Zweck**
Teams, Rollen, Agenten konfigurieren

**Aktionen**
- RoleTemplate anlegen
- AgentProfile erstellen
- Modelle definieren
- Skills zuweisen
- MCPs zuweisen
- Plugins zuweisen
- Policies binden

### 26.2.4 Vision Intake
**Zweck**
CEO-Vision einreichen, strukturieren und freigeben

**Aktionen**
- Vision Template ausfüllen
- unterstützende Dokumente anhängen
- Prioritäten festlegen
- Constraints setzen
- strategische Fragen anfordern
- Vision freigeben

### 26.2.5 Strategy & Planning
**Zweck**
Vision in Programme, Initiativen und Workstreams übersetzen

**Aktionen**
- Initiativen anlegen
- Programme definieren
- Ziele zuordnen
- Verantwortlichkeiten festlegen

### 26.2.6 Operations Board
**Zweck**
Arbeit visualisieren und steuern

**Ansichten**
- Kanban
- Liste
- Abhängigkeitsgraph
- nach Team
- nach Programm
- nach Priorität

### 26.2.7 Artifacts
**Zweck**
Alle Ergebnisse und Dokumente verwalten

**Aktionen**
- Artefakte öffnen
- Versionen vergleichen
- Reviews ansehen
- Verknüpfungen prüfen
- Freigaben verfolgen

### 26.2.8 Runtime Monitor
**Zweck**
Live-Betrieb überwachen

**Inhalte**
- TeamSessions
- AgentSessions
- aktuelle Kosten
- aktive Delegationen
- Idle-Agenten
- Fehler
- letzte RuntimeEvents

### 26.2.9 Reviews & Approvals
**Zweck**
Qualitätssicherung und Entscheidungen

**Aktionen**
- Review-Aufgaben öffnen
- Findings kommentieren
- Approvals erteilen/ablehnen
- Eskalationen auslösen

### 26.2.10 Policies & Governance
**Zweck**
Regeln und Verstöße verwalten

**Aktionen**
- Policies erstellen
- Policies testen
- Verstöße einsehen
- Ausnahmen genehmigen

### 26.2.11 Integrations
**Zweck**
Externe Systeme, MCPs und Plugins verwalten

**Aktionen**
- Integration anbinden
- MCP konfigurieren
- Plugin installieren
- Scope zuweisen
- Risiko prüfen

### 26.2.12 Templates
**Zweck**
Wiederverwendbare Unternehmensbausteine verwalten

---

# 27. API-Design

## 27.1 API-Stil
- REST für Standard-CRUD
- WebSocket oder SSE für Runtime-Updates
- interne Event-API für Orchestrierung
- optionale Graph-Abfragen für UI-Komposition

## 27.2 Ressourcen

### Organization
- /companies
- /divisions
- /departments
- /teams
- /reporting-lines
- /escalation-chains

### Roles & Agents
- /role-templates
- /agents
- /model-profiles
- /prompt-templates
- /behavior-profiles

### Capabilities
- /skills
- /skill-bundles
- /mcps
- /mcp-bundles
- /plugins
- /plugin-bundles

### Work
- /work-items
- /decisions
- /delegations
- /risks
- /approvals

### Artifacts
- /artifacts
- /reviews
- /test-runs

### Runtime
- /team-sessions
- /agent-sessions
- /runtime-events
- /failures

### Governance
- /policies
- /approval-policies
- /audit-events

### Templates
- /templates/*
- /vision-templates

---

# 28. Datenbankschema (hohe Ebene)

## 28.1 Tabellencluster
- companies
- divisions
- departments
- teams
- escalation_chains
- reporting_lines
- role_templates
- agent_profiles
- model_profiles
- prompt_templates
- behavior_profiles
- skill_definitions
- skill_bundles
- mcp_definitions
- mcp_bundles
- plugin_definitions
- plugin_bundles
- workflows
- work_items
- decisions
- delegations
- artifacts
- reviews
- test_requirements
- test_runs
- policies
- approval_policies
- approval_requests
- team_sessions
- agent_sessions
- runtime_events
- failure_records
- cost_records
- audit_events
- integration_definitions
- templates

---

# 29. Technische Zielarchitektur

## 29.1 Client
- React
- TypeScript
- komponentenbasierte UI
- Graph/Board-Ansichten
- Live-Status über WebSocket/SSE

## 29.2 Core Backend
Verantwortlich für:
- Domain-Logik
- API
- Workflow-Engine
- Policy-Engine
- Approval-Engine
- Audit-Erzeugung
- Artifact-Metadaten

## 29.3 Runtime Orchestrator
Verantwortlich für:
- Team Session Lifecycle
- Agent Session Lifecycle
- Delegationsrouting
- Work Scheduling
- Konsolidierung
- Retry/Recovery
- Kosten- und Zustandsüberwachung

## 29.4 Claude Team Adapter
Verantwortlich für:
- Claude Agent Teams Konfiguration
- Rollen-zu-Team-Zuordnung
- Modellzuweisung
- Prompt-Layering
- Skill-, MCP- und Plugin-Aktivierung
- Runtime-Statussynchronisation

## 29.5 Workers
Verantwortlich für:
- Hintergrundjobs
- Tests
- Berichte
- Zusammenfassungen
- Artefakterzeugung
- Synchronisationsjobs

## 29.6 Storage
- relationale DB für Kernmodelle
- Blob Store für Artefakte
- event store / logs
- Suchindex für Artefakte und Wissen

## 29.7 Observability
- Logs
- Metriken
- Traces
- Audit
- Cost Dashboard

---

# 30. CEO Vision Intake Template

Der CEO braucht ein festes Format, damit das System sauber arbeiten kann.  
Dieses Template ist in Markdown auszufüllen und bildet den offiziellen Vision-Input.

## 30.1 Ziel des Templates
Das Template zwingt die Vision in eine Form, die:
- strategisch klar ist
- ausführbar ist
- Risiken sichtbar macht
- Delegation erlaubt
- spätere Missverständnisse reduziert

## 30.2 CEO Vision Template

```markdown
# CEO Vision Brief

## 1. Executive Summary
Beschreibe in 3–10 Sätzen, was gebaut, verändert oder erreicht werden soll.

## 2. Geschäftsziel
Was ist das primäre Ziel?
- Umsatz
- Produktentwicklung
- internes Tool
- Marktvalidierung
- Automatisierung
- Forschung
- Kostenreduktion
- anderes

## 3. Problemdefinition
Welches konkrete Problem soll gelöst werden?
- Wer hat das Problem?
- Warum ist es relevant?
- Was passiert, wenn es nicht gelöst wird?

## 4. Zielgruppe / Stakeholder
Wer ist betroffen?
- Kunden
- interne Teams
- Partner
- Management
- Entwickler
- Endnutzer
- sonstige Stakeholder

## 5. Gewünschtes Ergebnis
Wie sieht Erfolg konkret aus?
Formuliere messbare oder überprüfbare Ergebnisse.

## 6. Vision im Idealzustand
Wenn alles perfekt läuft, wie sieht das Endergebnis aus?
Beschreibe den Zielzustand möglichst konkret.

## 7. Scope
Was gehört klar dazu?
Liste alle zentralen Bestandteile auf.

## 8. Nicht-Scope
Was gehört ausdrücklich nicht dazu?
Liste Dinge auf, die nicht bearbeitet werden sollen.

## 9. Prioritäten
Ordne die Prioritäten:
1. höchste Priorität
2. mittlere Priorität
3. optionale Priorität

## 10. Qualitätsanspruch
Welches Qualitätsniveau wird erwartet?
- schnell und pragmatisch
- solide produktreif
- enterprise-tauglich
- maximal robust
- forschungsnah / explorativ

## 11. Zeitrahmen
Gibt es Fristen, Meilensteine oder harte Deadlines?

## 12. Budget / Ressourcenrahmen
Gibt es Kosten-, Modell- oder Ressourcenlimits?

## 13. Technische Vorgaben
Welche Technologien, Plattformen, Modelle, APIs, Tools oder Architekturen sind gesetzt oder bevorzugt?

## 14. Technische Verbote
Welche Technologien, Ansätze oder Abhängigkeiten sollen vermieden oder ausgeschlossen werden?

## 15. Organisatorische Vorgaben
Gibt es Vorgaben für Dokumentation, Freigaben, Audits, Testing oder Governance?

## 16. Risiken und Bedenken
Welche Risiken siehst du bereits?
Welche Fehler wären besonders kritisch?

## 17. Bekannte Annahmen
Welche Annahmen triffst du aktuell?
Welche davon sind unsicher?

## 18. Offene Fragen
Welche Punkte sind noch unklar und müssen zuerst geklärt werden?

## 19. Entscheidungsfreiheit des Managements
Was dürfen Management und Teams selbst entscheiden?
Was muss zwingend zum CEO eskaliert werden?

## 20. Definition von Erfolg
Wann gilt das Vorhaben für dich als erfolgreich abgeschlossen?

## 21. Definition von Misserfolg
Wann würdest du sagen, dass das Vorhaben gescheitert ist?

## 22. Zusätzliche Referenzen
Links, Dateien, Skizzen, Repositories, Screenshots, Marktbeispiele, bestehende Dokumente.
```

## 30.3 Empfehlungen für den CEO beim Ausfüllen
1. Nicht nur „ich will X“, sondern auch „warum“ und „wie gut“
2. Scope und Nicht-Scope klar trennen
3. Risiken ehrlich benennen
4. Messbare Erfolgskriterien formulieren
5. Technische und organisatorische Verbote explizit nennen
6. Entscheidungen markieren, die nicht autonom getroffen werden dürfen

---

# 31. Standard-Betriebsablauf

## 31.1 Phase 1: Vision Intake
Input:
- CEO Vision Brief
- Anhänge
- Referenzen

Output:
- Vision Summary
- offene Fragen
- Annahmen
- Risikobild
- betroffene Unternehmensbereiche

## 31.2 Phase 2: Executive Structuring
Executive Office erzeugt:
- strategische Einordnung
- Programmansatz
- Verantwortungsbereiche
- Management-Zuweisung
- erste Risiken

## 31.3 Phase 3: Functional Planning
Management erzeugt:
- Initiativen
- Programme
- Workstreams
- Zuständigkeiten
- Grobprioritäten

## 31.4 Phase 4: Team Planning
Leads erzeugen:
- Epics
- Stories
- Tasks
- Artefaktanforderungen
- Test- und Reviewpfade
- Schätzungen

## 31.5 Phase 5: Execution
Spezialisten bearbeiten:
- Analyse
- Architektur
- Umsetzung
- Testing
- Doku

## 31.6 Phase 6: Validation
Governance und Reviews prüfen:
- Qualität
- Architektur
- Sicherheit
- Compliance
- Definition of Done

## 31.7 Phase 7: Completion / Release / Closure
Abschluss:
- Freigaben
- Abschlussreport
- Artefaktabschluss
- Lessons Learned

---

# 32. Nicht-funktionale Anforderungen

## 32.1 Nachvollziehbarkeit
Jede wesentliche Aktion ist protokolliert.

## 32.2 Konfigurierbarkeit
Fast alle organisatorischen Elemente sind ohne Code konfigurierbar.

## 32.3 Sicherheit
Sensible Integrationen, MCPs und Plugins sind policy- und approval-gesteuert.

## 32.4 Skalierbarkeit
Mehrere Teams und Programme müssen parallel betreibbar sein.

## 32.5 Erweiterbarkeit
Skills, MCPs, Plugins, Rollen und Workflows sind modular erweiterbar.

## 32.6 Transparenz
Kosten, Zustände, Idle-Phasen und Blocker müssen sichtbar sein.

## 32.7 Wiederverwendbarkeit
Templates und Bundles müssen mehrfach nutzbar sein.

---

# 33. Akzeptanzkriterien des Produkts

Das Produkt gilt als vollständig definiert, wenn es folgende Fähigkeiten unterstützt:

1. Unternehmen visuell modellieren
2. Teams hierarchisch anordnen
3. Agenten mit Rollen, Modellen und Prompts definieren
4. Skills, MCPs und Plugins je Scope zuweisen
5. Vision in strukturierte Arbeit überführen
6. Arbeit in Zuständen führen
7. Artefakte erzeugen und verwalten
8. Delegationen nachvollziehbar abbilden
9. Reviews, Tests und Approvals erzwingen
10. Kosten und Risiken transparent machen
11. Policies und Governance durchsetzen
12. CEO auf Führungsebene arbeitsfähig machen

---

# 34. Implementierungsreihenfolge für die Entwicklung

## Phase A — Core Foundation
- Domain Model
- DB Schema
- API Grundgerüst
- Auth/Settings
- Template System

## Phase B — Organization & Roles
- Company Designer
- Teams & Roles
- Reporting Lines
- Escalation Chains

## Phase C — Work & Artifacts
- WorkItems
- Artifacts
- Reviews
- Tests
- Approvals

## Phase D — Runtime & Claude Adapter
- Team Sessions
- Agent Sessions
- Delegation Engine
- Claude Team Adapter
- Cost Tracking

## Phase E — Governance & Integrations
- Policies
- MCP Management
- Plugin Management
- Skill Management
- Integrations

## Phase F — Executive Layer
- Vision Intake
- Strategy Views
- Executive Summaries
- Decision Console

## Phase G — Observability & Hardening
- Audit
- Metrics
- Dashboards
- Failure Recovery
- Performance Hardening

---

# 35. Schlussdefinition

**imCEO** ist ein visuelles, hierarchisches Unternehmensbetriebssystem für Claude Agent Teams.  
Es modelliert nicht nur Agenten, sondern die gesamte Unternehmenslogik über Organisation, Rollen, Zuständigkeiten, Policies, Artefakte, Arbeit, Freigaben, Tests, Reviews, Skills, MCPs, Plugins und Executive-Steuerung.

Der CEO liefert Vision und Entscheidungen.  
Das System organisiert daraus ein künstliches Unternehmen, das realistisch, kontrolliert und nachvollziehbar arbeitet.
