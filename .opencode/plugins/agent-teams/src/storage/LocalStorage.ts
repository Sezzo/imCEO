/**
 * LocalStorage - JSON-based file storage for Agent Teams
 *
 * Stores all data in ~/.opencode/agent-teams/ directory:
 * - teams.json: All teams registry
 * - tasks/{teamName}.json: Tasks per team
 * - mailbox/{teamName}/{agentName}.json: Messages per agent
 * - sessions/{sessionId}.json: Agent sessions
 * - delegations.json: Cross-team delegations
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
import type {
  Team,
  Task,
  Message,
  AgentSession,
  Delegation,
  LocalStorage as ILocalStorage,
} from './types';

export class LocalStorage implements ILocalStorage {
  private basePath: string;
  private teamsPath: string;
  private tasksPath: string;
  private mailboxPath: string;
  private sessionsPath: string;
  private delegationsPath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.teamsPath = join(basePath, 'teams.json');
    this.tasksPath = join(basePath, 'tasks');
    this.mailboxPath = join(basePath, 'mailbox');
    this.sessionsPath = join(basePath, 'sessions');
    this.delegationsPath = join(basePath, 'delegations.json');
  }

  async initialize(): Promise<void> {
    // Create directories
    await fs.mkdir(this.basePath, { recursive: true });
    await fs.mkdir(this.tasksPath, { recursive: true });
    await fs.mkdir(this.mailboxPath, { recursive: true });
    await fs.mkdir(this.sessionsPath, { recursive: true });

    // Initialize files if they don't exist
    if (!existsSync(this.teamsPath)) {
      await fs.writeFile(this.teamsPath, JSON.stringify({ teams: {} }, null, 2));
    }
    if (!existsSync(this.delegationsPath)) {
      await fs.writeFile(this.delegationsPath, JSON.stringify({ delegations: [] }, null, 2));
    }
  }

  // ============================================================================
  // Teams
  // ============================================================================

  async saveTeam(team: Team): Promise<void> {
    const data = await this.readJson<{ teams: Record<string, Team> }>(this.teamsPath);
    data.teams[team.teamName] = team;
    await this.writeJson(this.teamsPath, data);
  }

  async getTeam(teamName: string): Promise<Team | null> {
    const data = await this.readJson<{ teams: Record<string, Team> }>(this.teamsPath);
    return data.teams[teamName] || null;
  }

  async getAllTeams(): Promise<Team[]> {
    const data = await this.readJson<{ teams: Record<string, Team> }>(this.teamsPath);
    return Object.values(data.teams);
  }

  async getTeamByLead(leadAgentId: string): Promise<Team | null> {
    const teams = await this.getAllTeams();
    return teams.find((t) => t.leadAgentId === leadAgentId) || null;
  }

  async deleteTeam(teamName: string): Promise<void> {
    const data = await this.readJson<{ teams: Record<string, Team> }>(this.teamsPath);
    delete data.teams[teamName];
    await this.writeJson(this.teamsPath, data);

    // Cleanup related data
    try {
      await fs.unlink(join(this.tasksPath, `${teamName}.json`));
    } catch {
      /* ignore */
    }

    try {
      await fs.rm(join(this.mailboxPath, teamName), { recursive: true });
    } catch {
      /* ignore */
    }
  }

  // ============================================================================
  // Tasks
  // ============================================================================

  async saveTask(teamName: string, task: Task): Promise<void> {
    const tasks = await this.getTasks(teamName);
    const existingIndex = tasks.findIndex((t) => t.taskId === task.taskId);

    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }

    await this.writeJson(join(this.tasksPath, `${teamName}.json`), { tasks });
  }

  async getTasks(teamName: string): Promise<Task[]> {
    const path = join(this.tasksPath, `${teamName}.json`);
    if (!existsSync(path)) {
      return [];
    }
    const data = await this.readJson<{ tasks: Task[] }>(path);
    return data.tasks || [];
  }

  async getTask(teamName: string, taskId: string): Promise<Task | null> {
    const tasks = await this.getTasks(teamName);
    return tasks.find((t) => t.taskId === taskId) || null;
  }

  async updateTask(teamName: string, taskId: string, updates: Partial<Task>): Promise<void> {
    const task = await this.getTask(teamName, taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    Object.assign(task, updates);
    await this.saveTask(teamName, task);
  }

  async deleteTask(teamName: string, taskId: string): Promise<void> {
    const tasks = await this.getTasks(teamName);
    const filtered = tasks.filter((t) => t.taskId !== taskId);
    await this.writeJson(join(this.tasksPath, `${teamName}.json`), { tasks: filtered });
  }

  // ============================================================================
  // Mailbox
  // ============================================================================

  async saveMessage(teamName: string, toAgent: string, message: Message): Promise<void> {
    const mailboxDir = join(this.mailboxPath, teamName);
    await fs.mkdir(mailboxDir, { recursive: true });

    const path = join(mailboxDir, `${toAgent}.json`);
    let data: { messages: Message[] } = { messages: [] };

    if (existsSync(path)) {
      data = await this.readJson<{ messages: Message[] }>(path);
    }

    data.messages.push(message);
    await this.writeJson(path, data);
  }

  async getMessages(
    teamName: string,
    toAgent: string,
    unreadOnly: boolean = false
  ): Promise<Message[]> {
    const path = join(this.mailboxPath, teamName, `${toAgent}.json`);
    if (!existsSync(path)) {
      return [];
    }

    const data = await this.readJson<{ messages: Message[] }>(path);
    let messages = data.messages || [];

    if (unreadOnly) {
      messages = messages.filter((m) => !m.isRead);
    }

    return messages.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async markMessageRead(teamName: string, toAgent: string, messageId: string): Promise<void> {
    const path = join(this.mailboxPath, teamName, `${toAgent}.json`);
    const data = await this.readJson<{ messages: Message[] }>(path);

    const message = data.messages.find((m) => m.messageId === messageId);
    if (message) {
      message.isRead = true;
      await this.writeJson(path, data);
    }
  }

  async markMessageProcessed(teamName: string, toAgent: string, messageId: string): Promise<void> {
    const path = join(this.mailboxPath, teamName, `${toAgent}.json`);
    const data = await this.readJson<{ messages: Message[] }>(path);

    const message = data.messages.find((m) => m.messageId === messageId);
    if (message) {
      message.isProcessed = true;
      await this.writeJson(path, data);
    }
  }

  // ============================================================================
  // Sessions
  // ============================================================================

  async saveSession(session: AgentSession): Promise<void> {
    const path = join(this.sessionsPath, `${session.sessionId}.json`);
    await this.writeJson(path, session);
  }

  async getSession(sessionId: string): Promise<AgentSession | null> {
    const path = join(this.sessionsPath, `${sessionId}.json`);
    if (!existsSync(path)) {
      return null;
    }
    return this.readJson<AgentSession>(path);
  }

  async getActiveAgents(teamName: string): Promise<AgentSession[]> {
    const sessions: AgentSession[] = [];

    try {
      const files = await fs.readdir(this.sessionsPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const session = await this.getSession(file.replace('.json', ''));
          if (
            session &&
            session.teamName === teamName &&
            (session.status === 'running' || session.status === 'idle')
          ) {
            sessions.push(session);
          }
        }
      }
    } catch {
      /* ignore */
    }

    return sessions;
  }

  async updateSession(sessionId: string, updates: Partial<AgentSession>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    Object.assign(session, updates);
    await this.saveSession(session);
  }

  // ============================================================================
  // Delegations
  // ============================================================================

  async saveDelegation(delegation: Delegation): Promise<void> {
    const data = await this.readJson<{ delegations: Delegation[] }>(this.delegationsPath);
    data.delegations.push(delegation);
    await this.writeJson(this.delegationsPath, data);
  }

  async getDelegations(teamName: string): Promise<Delegation[]> {
    const data = await this.readJson<{ delegations: Delegation[] }>(this.delegationsPath);
    return data.delegations.filter((d) => d.fromTeam === teamName || d.toTeam === teamName);
  }

  async updateDelegation(delegationId: string, updates: Partial<Delegation>): Promise<void> {
    const data = await this.readJson<{ delegations: Delegation[] }>(this.delegationsPath);
    const delegation = data.delegations.find((d) => d.delegationId === delegationId);
    if (!delegation) {
      throw new Error(`Delegation ${delegationId} not found`);
    }
    Object.assign(delegation, updates);
    await this.writeJson(this.delegationsPath, data);
  }

  // ============================================================================
  // Notifications
  // ============================================================================

  async notifyTeamMembers(teamName: string): Promise<void> {
    // This would integrate with OpenCode's notification system
    // For now, it's a no-op that can be extended
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private async readJson<T>(path: string): Promise<T> {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content);
  }

  private async writeJson(path: string, data: any): Promise<void> {
    await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
  }
}
