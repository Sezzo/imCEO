# Agent Teams for OpenCode

A complete 1:1 port of Claude Code's Agent Teams feature for the OpenCode platform.

## Overview

This module enables coordinated multi-agent collaboration, where multiple AI agents work together as a team with:

- **Shared Task Lists** - Distribute and claim work items
- **Inter-Agent Messaging** - Send messages and structured requests (shutdown, plan approval)
- **Real-time Coordination** - WebSocket-powered live updates
- **Plan Mode** - Require approval before implementation
- **Agent Spawning** - Spawn specialized teammates dynamically

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Agent Teams Module                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   Team Tools     │    │   Task Tools     │    │  Message Tools   │  │
│  │  TeamCreateTool  │    │  TaskCreateTool  │    │  SendMessageTool │  │
│  │  TeamDeleteTool  │    │  TaskListTool    │    │                  │  │
│  │                  │    │  TaskGetTool     │    │                  │  │
│  │                  │    │  TaskUpdateTool  │    │                  │  │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘  │
│           │                     │                      │              │
│  ┌────────┴─────────────────────┴─────────────────────┴─────────┐    │
│  │                    Agent Execution Engine                    │    │
│  │  ┌────────────────────────────────────────────────────────┐  │    │
│  │  │  AgentRunner        │  InProcessTeammateManager         │  │    │
│  │  │  - Execution loop   │  - Spawn/kill teammates           │  │    │
│  │  │  - Tool calling     │  - Lifecycle management           │  │    │
│  │  │  - State machine    │  - AbortController management     │  │    │
│  │  └────────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌──────────────────┐    ┌──────────────────┐                          │
│  │   WebSocket        │    │   Database       │                          │
│  │   Real-time        │    │   (Prisma)       │                          │
│  │   Events           │    │                  │                          │
│  └──────────────────┘    └──────────────────┘                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Features

### 1. Team Management

**TeamCreateTool** - Create a new agent team

```typescript
const result = await teamCreateTool.execute(
  {
    team_name: 'pr-review-team',
    description: 'Review PR #142 from multiple perspectives',
    agent_type: 'review-lead',
  },
  context
);
// Returns: { team_name, team_id, lead_agent_id }
```

**TeamDeleteTool** - Cleanup team when work is complete

```typescript
const result = await teamDeleteTool.execute({}, context);
// Validates no active teammates before cleanup
```

### 2. Task Management

**Shared Task List** with dependency support:

```typescript
// Create task with dependencies
await taskCreateTool.execute(
  {
    subject: 'Implement API endpoints',
    description: 'Create REST endpoints for user management',
    blockedBy: ['task-database-schema-id'], // Wait for schema first
  },
  context
);

// Tasks auto-unblock when dependencies complete
// Claim tasks: TaskUpdate({ status: "in_progress" })
// Complete tasks: TaskUpdate({ status: "completed" })
```

### 3. Inter-Agent Messaging

**SendMessageTool** supports multiple message types:

```typescript
// Plain text message
await sendMessageTool.execute(
  {
    to: 'security-reviewer',
    summary: 'Found SQL injection vulnerability',
    message: 'I discovered a potential SQL injection in auth.ts line 45...',
  },
  context
);

// Structured shutdown request (lead only)
await sendMessageTool.execute(
  {
    to: 'security-reviewer',
    message: {
      type: 'shutdown_request',
      reason: 'Team wrapping up for today',
    },
  },
  context
);

// Plan approval (teammate → lead)
await sendMessageTool.execute(
  {
    to: 'team-lead',
    message: {
      type: 'plan_approval_request',
      request_id: 'plan-123',
      plan_content: 'My implementation approach: 1) Add validation...',
    },
  },
  context
);

// Broadcast to all teammates
await sendMessageTool.execute(
  {
    to: '*',
    summary: 'All blockers resolved',
    message: 'The database schema is ready, you can proceed with API implementation',
  },
  context
);
```

### 4. Agent Spawning

**AgentTool** spawns teammates in the current team:

```typescript
// Spawn a teammate
await agentTool.execute(
  {
    description: 'Security review',
    prompt: 'Review the authentication module for security vulnerabilities...',
    name: 'security-reviewer', // Enables teammate mode
    team_name: 'pr-review-team', // Join this team
    mode: 'plan', // Must submit plan before implementing
  },
  context
);
```

### 5. Real-time Updates

WebSocket events keep all clients synchronized:

- `task:created`, `task:claimed`, `task:completed`
- `message:received`, `message:broadcast`
- `agent:spawned`, `agent:completed`, `agent:failed`, `agent:shutdown`
- `plan:submitted`, `plan:approved`, `plan:rejected`

## Database Schema

The module extends your Prisma schema with these models:

### Core Tables

- `AgentTeam` - Team configuration and state
- `AgentTeamMember` - Team members (lead + teammates)
- `AgentTask` - Shared task list with dependencies
- `TeamMailbox` - Inter-agent messages
- `AgentTeamSession` - Runtime execution state
- `AgentExecutionLog` - Observability and debugging

### Enums

- `TeamRuntimeState`: active, cleaning_up, cleaned_up, error
- `TaskStatus`: pending, in_progress, completed, blocked, cancelled
- `MessageType`: text, shutdown_request, shutdown_response, plan_approval_request, plan_approval_response, broadcast
- `ExecutionState`: queued, running, waiting_for_plan_approval, completed, failed, killed

## Installation

### 1. Install Dependencies

```bash
npm install ws @anthropic-ai/sdk
npm install -D @types/ws
```

### 2. Add Database Schema

Copy `prisma/schema.prisma` additions to your schema and run:

```bash
npx prisma migrate dev --name add_agent_teams
npx prisma generate
```

### 3. Initialize Module

```typescript
import { initializeAgentTeams, agentTeamRoutes } from './agent-teams';

// In your server initialization
const agentTeams = initializeAgentTeams({
  prisma,
  anthropicClient, // Your Anthropic SDK client
  toolRegistry, // Your tool registry
  logger: pino(), // Optional custom logger
  webSocketPort: 3001,
});

// Register API routes
await fastify.register(agentTeamRoutes, { prefix: '/api/v1' });
```

### 4. Frontend Integration

```typescript
import { AgentTeamsProvider, TeamDashboard } from './agent-teams/frontend';

function App() {
  return (
    <AgentTeamsProvider
      apiBaseUrl="http://localhost:3000/api/v1"
      webSocketUrl="ws://localhost:3001"
    >
      <TeamDashboard />
    </AgentTeamsProvider>
  );
}
```

## API Endpoints

### Team Management

- `POST /api/v1/teams` - Create team
- `GET /api/v1/teams/:teamId` - Get team details
- `DELETE /api/v1/teams/:teamId` - Delete team

### Tasks

- `POST /api/v1/teams/:teamId/tasks` - Create task
- `GET /api/v1/teams/:teamId/tasks` - List tasks
- `GET /api/v1/teams/:teamId/tasks/:taskId` - Get task
- `PATCH /api/v1/teams/:teamId/tasks/:taskId` - Update task

### Messaging

- `POST /api/v1/teams/:teamId/messages` - Send message
- `GET /api/v1/teams/:teamId/messages` - Get messages
- `PATCH /api/v1/teams/:teamId/messages/:messageId/read` - Mark as read

### Agents

- `POST /api/v1/teams/:teamId/agents` - Spawn agent
- `POST /api/v1/teams/:teamId/agents/:agentId/shutdown` - Request shutdown
- `POST /api/v1/teams/:teamId/agents/:agentId/kill` - Force kill

## WebSocket Events

### Client → Server

- `subscribe` - Subscribe to team/agent channels
- `unsubscribe` - Unsubscribe from channels
- `metadata:update` - Update client metadata

### Server → Client

All events include `type`, `payload`, `timestamp`, and `id` fields.

## Configuration

### Environment Variables

```bash
# Optional: Custom WebSocket port
AGENT_TEAMS_WS_PORT=3001

# Optional: Disable WebSocket compression
AGENT_TEAMS_WS_COMPRESSION=false
```

### Agent Runner Options

```typescript
const agentTeams = initializeAgentTeams({
  prisma,
  anthropicClient,
  toolRegistry,
  logger,
  webSocketPort: 3001,
});
```

## Usage Examples

### Example 1: Parallel Code Review

```typescript
// 1. Create team
const team = await teamCreateTool.execute(
  {
    team_name: 'pr-review-142',
    description: 'Review PR #142 from security, performance, and test perspectives',
  },
  context
);

// 2. Spawn specialized reviewers
await agentTool.execute(
  {
    description: 'Security review',
    prompt:
      'Review PR #142 for security vulnerabilities. Focus on: input validation, auth, SQL injection...',
    name: 'security-reviewer',
    team_name: team.data.team_name,
  },
  context
);

await agentTool.execute(
  {
    description: 'Performance review',
    prompt:
      'Review PR #142 for performance impact. Check for: N+1 queries, unnecessary re-renders, memory leaks...',
    name: 'performance-reviewer',
    team_name: team.data.team_name,
  },
  context
);

await agentTool.execute(
  {
    description: 'Test coverage review',
    prompt:
      'Review PR #142 for test coverage. Ensure: unit tests exist, edge cases covered, integration tests...',
    name: 'test-reviewer',
    team_name: team.data.team_name,
  },
  context
);

// 3. Team members work in parallel, messaging back findings
// 4. When all complete, clean up
await teamDeleteTool.execute({}, context);
```

### Example 2: Investigation with Competing Hypotheses

```typescript
// Spawn 3 agents to investigate different root causes
await agentTool.execute(
  {
    description: 'Database theory',
    prompt: 'Investigate if the app crash is caused by database connection pool exhaustion...',
    name: 'db-investigator',
    team_name: 'debug-team',
  },
  context
);

await agentTool.execute(
  {
    description: 'Memory leak theory',
    prompt: 'Investigate if the app crash is caused by a memory leak in the event handlers...',
    name: 'memory-investigator',
    team_name: 'debug-team',
  },
  context
);

await agentTool.execute(
  {
    description: 'External API theory',
    prompt:
      'Investigate if the app crash is caused by unhandled errors from the external payment API...',
    name: 'api-investigator',
    team_name: 'debug-team',
  },
  context
);

// Agents debate findings via SendMessage, converge on answer
```

### Example 3: Cross-Layer Implementation

```typescript
// Spawn agents for frontend, backend, and tests
await agentTool.execute(
  {
    description: 'Frontend implementation',
    prompt: 'Implement the user dashboard UI components...',
    name: 'frontend-dev',
    team_name: 'feature-team',
  },
  context
);

await agentTool.execute(
  {
    description: 'Backend implementation',
    prompt: 'Implement the API endpoints for the user dashboard...',
    name: 'backend-dev',
    team_name: 'feature-team',
  },
  context
);

await agentTool.execute(
  {
    description: 'Test implementation',
    prompt: 'Write tests for the user dashboard feature...',
    name: 'test-dev',
    team_name: 'feature-team',
  },
  context
);
```

## Best Practices

### Team Size

- Start with 3-5 teammates for most workflows
- More teammates = more coordination overhead
- 5-6 tasks per teammate keeps everyone productive

### Task Management

- Break work into self-contained units
- Set up dependencies for ordered work
- Always claim tasks before working on them

### Communication

- Use structured messages for coordination
- Broadcast sparingly (cost scales with team size)
- Include meaningful summaries for UI preview

### Plan Mode

- Use for complex or risky tasks
- Lead reviews plans before implementation
- Feedback loop enables course correction

### Error Handling

- Implement graceful degradation
- Teammates may fail; lead should respawn if needed
- Monitor WebSocket connection health

## Testing

### Unit Tests

```typescript
import { TeamCreateTool } from './agent-teams';

describe('TeamCreateTool', () => {
  it('should create a team with lead member', async () => {
    const result = await teamCreateTool.execute(
      {
        team_name: 'test-team',
      },
      mockContext
    );

    expect(result.data.lead_agent_id).toBeDefined();
  });
});
```

### Integration Tests

```typescript
// Test full workflow
describe('Agent Teams Workflow', () => {
  it('should spawn, message, and complete task', async () => {
    // Create team
    // Spawn agent
    // Send message
    // Create task
    // Agent claims task
    // Agent completes task
    // Cleanup
  });
});
```

## Troubleshooting

### Teammates not appearing

- Check WebSocket connection is established
- Verify team context is set in session
- Check browser console for errors

### Messages not delivering

- Verify recipient name matches exactly
- Check mailbox table for message records
- Ensure WebSocket is subscribed to team channel

### Tasks not unblocking

- Verify dependency task IDs are correct
- Check task status is "completed"
- Review task.blocks array is populated

## License

MIT - See LICENSE file for details

## Credits

Ported from [Claude Code](https://code.claude.com) Agent Teams feature.
Original architecture by Anthropic.
