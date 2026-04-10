# OpenCode Agent Teams

A powerful multi-agent orchestration system for Claude Code, enabling teams of AI agents to collaborate on complex tasks.

## Overview

Agent Teams allows you to:

- Create teams of specialized AI agents
- Coordinate parallel task execution
- Enable agent-to-agent communication
- Assign roles (Coordinator, Worker, Reviewer, Specialist)
- Monitor execution in real-time

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface                           │
│  - CLI Commands (/team create, /team execute)                 │
│  - UI Components (TeamStatusPanel, ExecutionMonitor)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  Team Manager                               │
│  - Team lifecycle management                                  │
│  - Agent initialization                                     │
│  - Task assignment and tracking                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
┌───▼───┐        ┌────▼─────┐      ┌─────▼──────┐
│ Agent │        │ Coordination    │      │ Message  │
│Router │        │    Engine       │      │  Router  │
└───┬───┘        └────┬────────┘      └─────┬──────┘
    │                 │                    │
    │    ┌────────────┴────────┐           │
    │    │                     │           │
┌───▼────▼─────┐       ┌──────▼──────┐    │
│  Agent 1     │       │  Agent 2    │    │
│ (Worker)     │       │ (Reviewer) │    │
└──────────────┘       └─────────────┘    │
         │                                 │
         └────────────────┬────────────────┘
                          │
              ┌───────────▼───────────┐
              │    Query Engines      │
              │ (Individual LLM calls) │
              └───────────────────────┘
```

## Quick Start

### 1. Create a Team (Using Template)

```bash
/team quick-setup dev "Frontend Team"
```

This creates a development team with:

- Senior Developer (Opus)
- Code Reviewer (Sonnet)
- Test Engineer (Sonnet)

### 2. Execute a Complex Task

```bash
/team execute "Implement a React component for user authentication with form validation, error handling, and unit tests"
```

The coordinator will:

1. Break down the task
2. Assign to appropriate agents
3. Review the code
4. Write tests
5. Synthesize results

### 3. Monitor Progress

```bash
/team status
```

Shows:

- Agent statuses
- Active tasks
- Completed/failed counts

## CLI Commands

### Team Management

| Command                        | Description              | Example                        |
| ------------------------------ | ------------------------ | ------------------------------ |
| `/team create <name>`          | Create team from scratch | `/team create "My Team"`       |
| `/team quick-setup <template>` | Create from template     | `/team quick-setup dev "Team"` |
| `/team list`                   | List all teams           | `/team list`                   |
| `/team status [id]`            | Show team status         | `/team status`                 |
| `/team disband [id]`           | Disband a team           | `/team disband`                |
| `/team set-active <id>`        | Set active team          | `/team set-active team-123`    |

### Task Execution

| Command                     | Description        | Example                               |
| --------------------------- | ------------------ | ------------------------------------- |
| `/team assign <title>`      | Assign a task      | `/team assign "Fix bug" --to agent-1` |
| `/team execute <goal>`      | Execute with team  | `/team execute "Build API"`           |
| `/team broadcast <message>` | Message all agents | `/team broadcast "Standup in 5min"`   |
| `/team message <agent>`     | Direct message     | `/team message agent-1 "Question..."` |

## Templates

Pre-configured team setups for common scenarios:

### Development Team (`dev`)

```typescript
{
  agents: [
    { name: 'Senior Developer', role: 'worker', model: 'opencode-opus-4' },
    { name: 'Code Reviewer', role: 'reviewer', model: 'opencode-sonnet-4' },
    { name: 'Test Engineer', role: 'worker', model: 'opencode-sonnet-4' },
  ];
}
```

### Review Team (`review`)

```typescript
{
  agents: [
    { name: 'Primary Reviewer', role: 'reviewer', model: 'opencode-opus-4' },
    { name: 'Security Reviewer', role: 'reviewer', model: 'opencode-sonnet-4' },
  ];
}
```

### Research Team (`research`)

```typescript
{
  agents: [
    { name: 'Research Lead', role: 'coordinator', model: 'opencode-opus-4' },
    { name: 'Data Analyst', role: 'worker', model: 'opencode-sonnet-4' },
    { name: 'Fact Checker', role: 'reviewer', model: 'opencode-sonnet-4' },
  ];
}
```

### Security Team (`security`)

```typescript
{
  agents: [
    { name: 'Security Architect', role: 'specialist', model: 'opencode-opus-4' },
    { name: 'Penetration Tester', role: 'specialist', model: 'opencode-sonnet-4' },
    { name: 'Compliance Reviewer', role: 'reviewer', model: 'opencode-sonnet-4' },
  ];
}
```

### Documentation Team (`docs`)

```typescript
{
  agents: [
    { name: 'Technical Writer', role: 'worker', model: 'opencode-sonnet-4' },
    { name: 'API Documenter', role: 'specialist', model: 'opencode-sonnet-4' },
    { name: 'Review Editor', role: 'reviewer', model: 'opencode-haiku-4' },
  ];
}
```

## Agent Roles

| Role            | Responsibility                | Example                       |
| --------------- | ----------------------------- | ----------------------------- |
| **Coordinator** | Plans, delegates, synthesizes | Team lead, project manager    |
| **Worker**      | Executes tasks                | Developer, analyst            |
| **Reviewer**    | Validates, checks quality     | Code reviewer, QA             |
| **Specialist**  | Domain expertise              | Security expert, API designer |

## Execution Strategies

### Sequential

One task at a time, strict ordering:

```
Task 1 → Task 2 → Task 3
```

Best for: Dependent tasks, linear workflows

### Parallel

Execute independent tasks simultaneously:

```
Task 1 ─┐
Task 2 ─┼→ Results
Task 3 ─┘
```

Best for: Independent tasks, maximum throughput

### Hierarchical (Default)

Coordinator manages parallel workers with oversight:

```
         ┌─→ Worker 1 ─┐
Coordinator ─┼─→ Worker 2 ─┼→ Review
         └─→ Worker 3 ─┘
```

Best for: Complex tasks requiring coordination

## Agent Communication

### Automatic Routing

Messages can be automatically routed based on content:

```typescript
// Route code-related messages to reviewers
agentRouter.addRoute({
  fromAgentId: 'coordinator',
  toAgentId: 'reviewer-1',
  pattern: 'review|code|quality',
  priority: 1,
});
```

### Direct Messaging

```typescript
await agentRouter.sendDirectMessage(
  coordinator,
  'worker-1',
  'Please focus on error handling',
  team
);
```

### Broadcast

```typescript
await agentRouter.broadcastMessage(coordinator, 'Standup in 5 minutes', team);
```

## Configuration

### Team Defaults

```typescript
teamConfig.updateDefaults({
  coordinatorModel: 'opencode-opus-4',
  workerModel: 'opencode-sonnet-4',
  maxParallelAgents: 5,
  defaultTimeout: 600000,
  enableSharedContext: true,
  enableMessageRouting: true,
});
```

### Team Policies

```typescript
teamConfig.updatePolicies({
  maxRetries: 3,
  allowAgentToAgentCommunication: true,
  broadcastCompletedTasks: true,
  autoRetryFailedTasks: false,
  requireReviewerForCode: true,
});
```

## UI Components

### TeamStatusPanel

```tsx
<TeamStatusPanel teamId="team-123" showMessages={true} />
```

Displays:

- Team name and status
- Agent list with current status
- Active/completed/failed task counts
- Recent activity log

### ExecutionMonitor

```tsx
<ExecutionMonitor team={team} plan={plan} onComplete={(results) => console.log('Done!')} />
```

Displays:

- Progress bars for each task
- Real-time status updates
- Agent assignments
- Live activity feed

### TeamCreationWizard

```tsx
<TeamCreationWizard
  context={toolContext}
  onComplete={(result) => console.log(result)}
  onCancel={() => console.log('Cancelled')}
/>
```

Interactive wizard for team setup with templates.

## Advanced Usage

### Custom Team Creation

```typescript
import { teamManager } from './services/team';

const result = await teamManager.createTeam(
  {
    name: 'Custom Team',
    description: 'Specialized team for specific task',
    coordinatorModel: 'opencode-opus-4',
    agents: [
      {
        name: 'Specialist 1',
        role: 'specialist',
        model: 'opencode-opus-4',
        systemPrompt: 'You are an expert in...',
        tools: ['FileReadTool', 'FileEditTool'],
        description: 'Domain specialist',
      },
      {
        name: 'Worker 1',
        role: 'worker',
        model: 'opencode-sonnet-4',
        systemPrompt: 'You are a developer...',
        tools: ['BashTool', 'FileReadTool', 'FileWriteTool'],
      },
    ],
  },
  tools
);
```

### Event Handling

```typescript
import { useTeamEvents } from './components/Team';

useTeamEvents(teamId, (event) => {
  switch (event.type) {
    case 'task_completed':
      console.log(`Task ${event.taskId} completed!`);
      break;
    case 'agent_status_changed':
      console.log(`Agent ${event.agentId} is now ${event.data?.status}`);
      break;
  }
});
```

### Programmatic Task Execution

```typescript
import { coordinationEngine } from './services/team';

// Generate a plan
const plan = await coordinationEngine.generatePlan(team, 'Build a REST API', 'hierarchical');

// Execute with progress tracking
const result = await coordinationEngine.executePlan(plan, team, (event) => {
  console.log(`Progress: ${event.type}`);
});

console.log(result.summary);
```

## Best Practices

### 1. Team Size

- **2-3 agents**: Small tasks, quick execution
- **4-5 agents**: Complex tasks with specialization
- **6+ agents**: Large projects with multiple workstreams

### 2. Role Distribution

- Always have 1 Coordinator
- 2-3 Workers for parallel execution
- 1 Reviewer for quality control
- Specialists as needed

### 3. Task Granularity

- Break complex tasks into 2-5 subtasks
- Keep subtasks independent when possible
- Set clear dependencies for ordering

### 4. Model Selection

- **Coordinator**: Use strongest model (Opus)
- **Workers**: Balance speed/cost (Sonnet)
- **Reviewers**: Use thorough models (Sonnet)
- **Specialists**: Use strongest (Opus)

### 5. Tool Assignment

- Give agents only the tools they need
- Workers: File + Bash tools
- Reviewers: Read + Grep tools
- Specialists: Context-appropriate tools

## Troubleshooting

### Agents Not Responding

```bash
/team status
```

Check if agents are stuck in 'running' state. May need to restart team.

### Tasks Failing

- Check agent tool assignments
- Verify model availability
- Review error messages in task results

### Communication Issues

- Enable message routing: `enableMessageRouting: true`
- Check route patterns are correct
- Verify agent IDs match

### Performance

- Use parallel strategy for independent tasks
- Limit team size to 5-6 agents
- Set appropriate timeouts

## Integration with Claude Code

The Agent Teams system integrates seamlessly:

```bash
# Start Claude Code with custom backend
CLAUDE_CODE_USE_CUSTOM=true ./claude-code

# Inside Claude Code:
/team quick-setup dev "My Dev Team"
/team execute "Build feature X"
```

The team will use your custom backend (OpenCode) for all LLM calls.

## API Reference

### TeamManager

- `createTeam(request, tools)` - Create new team
- `disbandTeam(teamId)` - Disband team
- `assignTask(task, agentId)` - Assign task
- `getTeamStatus(teamId)` - Get status
- `onEvent(handler)` - Subscribe to events

### CoordinationEngine

- `generatePlan(team, goal, strategy)` - Create execution plan
- `executePlan(plan, team, onProgress)` - Execute plan
- `resolveConflict(team, results, task)` - Resolve conflicts

### AgentRouter

- `sendDirectMessage(from, to, content, team)` - Direct message
- `broadcastMessage(from, content, team)` - Broadcast
- `sendTaskAssignment(coordinator, worker, title, desc)` - Assign task
- `addRoute(route)` - Add routing rule

## Examples

### Example 1: Code Review Workflow

```bash
/team quick-setup review "PR Review Team"
/team execute "Review this pull request for security vulnerabilities and code quality issues"
```

### Example 2: Feature Development

```bash
/team quick-setup dev "Feature Team"
/team execute "Implement user authentication with JWT tokens, password hashing, and session management"
```

### Example 3: Security Audit

```bash
/team quick-setup security "Security Audit Team"
/team execute "Perform comprehensive security audit of the authentication system"
```

## Future Enhancements

- [ ] Dynamic team resizing
- [ ] Agent learning/memory across sessions
- [ ] Cross-team collaboration
- [ ] Advanced conflict resolution strategies
- [ ] Performance analytics and optimization
- [ ] Custom agent behaviors

## Contributing

To add new features:

1. Extend types in `services/team/types.ts`
2. Add functionality to `TeamManager` or `CoordinationEngine`
3. Create UI components in `components/Team/`
4. Add CLI commands in `commands/team/`
5. Update this documentation
