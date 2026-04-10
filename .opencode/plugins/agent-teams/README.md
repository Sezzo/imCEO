# OpenCode Agent Teams Plugin

Claude Code-style multi-agent collaboration for [OpenCode](https://opencode.ai).

## Features

- **Team Management** - Create teams with you as the lead
- **Shared Task List** - Distribute work with dependencies
- **Inter-Agent Messaging** - Async communication via mailbox
- **Cross-Team Delegation** - Hand off work between teams
- **Plan Mode** - Require approval before implementation

## Installation

### Method 1: Local Plugin (Recommended for Testing)

1. Clone this repo or copy the plugin folder:

```bash
git clone https://github.com/sezzo/imceo.git
cp -r imceo/.opencode/plugins/agent-teams ~/.config/opencode/plugins/
```

2. Restart OpenCode - the plugin loads automatically from `~/.config/opencode/plugins/`

### Method 2: From Source (Development)

1. Copy to your project's plugin directory:

```bash
cp -r .opencode/plugins/agent-teams /path/to/your/project/.opencode/plugins/
```

2. Install dependencies:

```bash
cd /path/to/your/project/.opencode/plugins/agent-teams
bun install
```

3. OpenCode will auto-detect and load the plugin

## Quick Start

```bash
# Start OpenCode in your project
opencode

# Create a team
/team create security-review "Audit codebase for vulnerabilities"

# Spawn specialized agents
/agent spawn security-review injection-tester "Look for SQL injection"
/agent spawn security-review xss-tester "Check for XSS vulnerabilities"

# Create and assign tasks
/task create security-review "Audit auth.ts" "Check authentication flow"
/task claim security-review task-xxx

# Send messages
/message to injection-tester@security-review "Focus on the login form"

# View all teams
/teams
```

## Commands

### Team Management

- `/team create <name> [description]` - Create a new team (you become lead)
- `/team delete <name>` - Delete a team (must be lead, no active members)
- `/team list` - List all your teams
- `/teams` - Open interactive dashboard

### Agent Management

- `/agent spawn <team> <name> <prompt>` - Spawn a new teammate
- `/agent list <team>` - List agents in a team
- `/agent kill <team> <name>` - Force kill an agent (emergency only)

### Task Management

- `/task create <team> <subject> <description>` - Create a task
- `/task list <team> [status]` - List tasks
- `/task claim <team> <task_id>` - Claim a task
- `/task complete <team> <task_id>` - Complete a task

## AI Tools

The plugin also provides tools that the AI can use:

- `TeamCreate` - Create teams
- `TeamDelete` - Delete teams
- `TaskCreate` - Create tasks with dependencies
- `TaskList` - List tasks
- `TaskGet` - Get task details
- `TaskUpdate` - Update task status
- `SendMessage` - Send messages to teammates
- `SpawnAgent` - Spawn new agents

Example prompt:

```
Create a team called "performance-audit" and spawn 3 agents to analyze
different aspects of the codebase. Create tasks for each agent and
set up dependencies so they work in the right order.
```

## Architecture

### Key Principles

1. **One Agent = One Team** - Each agent can only be in one team at a time
2. **User is Authority** - You control all teams, agents work for you
3. **Flat Hierarchy** - No subagents, all teammates are equal
4. **Delegation** - Teams hand off work via messages, not shared tasks
5. **Mailbox System** - Async messaging between agents

### Data Storage

All data is stored locally in JSON files:

```
.opencode/agent-teams/
├── teams.json           # All teams
├── tasks/
│   └── {team}.json      # Tasks per team
├── mailbox/
│   └── {team}/
│       └── {agent}.json # Messages per agent
└── sessions/
    └── {id}.json        # Agent sessions
```

## Delegation Example

Team A (Frontend) finishes work and delegates to Team B (Design):

```bash
# In frontend-dev team
/message to lead@design-review --type delegation \
  --subject "Review Dashboard UI" \
  --description "Please review the new dashboard for design consistency" \
  --artifacts "src/Dashboard.tsx, src/styles/dashboard.css"

# Design team lead receives delegation request
# Can accept (create own task) or reject (with feedback)
```

## Configuration

Set in your environment:

```bash
export DEBUG_AGENT_TEAMS=1  # Enable debug logging
```

## Testing

```bash
# Run type checking
cd .opencode/plugins/agent-teams
bun run build

# The plugin loads automatically in OpenCode
# Look for "Agent Teams Plugin loaded" in the logs
```

## Troubleshooting

### Plugin not loading

- Check that files are in `~/.config/opencode/plugins/agent-teams/`
- Verify `index.ts` exists and exports default
- Check OpenCode logs for errors

### Commands not working

- Ensure you're in a project directory (not home)
- Check that `.opencode/agent-teams/` directory was created
- Verify write permissions

### Messages not delivering

- Check that recipient agent exists in team
- Verify agent is active (not shutdown)
- Look in mailbox JSON files for messages

## Contributing

This plugin is part of the [imCEO](https://github.com/sezzo/imceo) project.

## License

MIT - See [LICENSE](../../LICENSE) for details.
