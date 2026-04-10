/**
 * Agent Router Service
 *
 * Handles message routing between agents in a team:
 * - Direct messaging (agent to agent)
 * - Broadcast messaging (coordinator to all)
 * - Automatic routing based on patterns
 * - Message queuing and delivery
 */

import { randomUUID } from 'crypto';
import { logForDebugging } from '../../utils/debug.js';
import type { Agent, AgentMessage, MessageRoute, MessageType, Team } from './types.js';

interface QueuedMessage extends AgentMessage {
  retryCount: number;
  maxRetries: number;
}

export class AgentRouter {
  private messageQueue: Map<string, QueuedMessage[]> = new Map();
  private routes: MessageRoute[] = [];
  private maxRetries = 3;

  /**
   * Register a message route for automatic routing
   */
  addRoute(route: MessageRoute): void {
    this.routes.push(route);
    // Sort by priority (higher first)
    this.routes.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a message route
   */
  removeRoute(fromAgentId: string, toAgentId: string, pattern: string): void {
    this.routes = this.routes.filter(
      (r) => !(r.fromAgentId === fromAgentId && r.toAgentId === toAgentId && r.pattern === pattern)
    );
  }

  /**
   * Send a direct message from one agent to another
   */
  async sendDirectMessage(
    from: Agent,
    toAgentId: string,
    content: string,
    team: Team,
    options: {
      type?: MessageType;
      metadata?: {
        taskId?: string;
        urgency?: 'low' | 'normal' | 'high';
        requiresResponse?: boolean;
      };
    } = {}
  ): Promise<AgentMessage> {
    const targetAgent = team.agents.get(toAgentId);
    if (!targetAgent) {
      throw new Error(`Target agent not found: ${toAgentId}`);
    }

    const message: AgentMessage = {
      id: randomUUID(),
      type: options.type || 'direct_message',
      from: from.config.id,
      to: toAgentId,
      timestamp: new Date(),
      content,
      metadata: options.metadata,
    };

    logForDebugging(`[AgentRouter] Direct message from ${from.config.id} to ${toAgentId}`);

    // Add to target agent's messages
    targetAgent.messages.push({
      id: message.id,
      type: 'text',
      text: `[Message from ${from.config.name}]: ${content}`,
    } as any); // Using any for BetaMessage compatibility

    return message;
  }

  /**
   * Broadcast a message to all team members
   */
  async broadcastMessage(
    from: Agent,
    content: string,
    team: Team,
    options: {
      excludeAgentIds?: string[];
      type?: MessageType;
      metadata?: {
        taskId?: string;
        urgency?: 'low' | 'normal' | 'high';
      };
    } = {}
  ): Promise<AgentMessage[]> {
    const messages: AgentMessage[] = [];
    const excludeIds = new Set(options.excludeAgentIds || []);

    for (const [agentId, agent] of team.agents) {
      if (excludeIds.has(agentId)) continue;

      const message: AgentMessage = {
        id: randomUUID(),
        type: options.type || 'broadcast',
        from: from.config.id,
        to: agentId,
        timestamp: new Date(),
        content,
        metadata: options.metadata,
      };

      // Add to agent's messages
      agent.messages.push({
        id: message.id,
        type: 'text',
        text: `[Broadcast from ${from.config.name}]: ${content}`,
      } as any);

      messages.push(message);
    }

    logForDebugging(`[AgentRouter] Broadcast from ${from.config.id} to ${messages.length} agents`);

    return messages;
  }

  /**
   * Send a task assignment message
   */
  async sendTaskAssignment(
    coordinator: Agent,
    worker: Agent,
    taskTitle: string,
    taskDescription: string,
    context?: string
  ): Promise<AgentMessage> {
    const content = `Task Assignment: ${taskTitle}

${taskDescription}

${context ? `Context: ${context}\n\n` : ''}
Please acknowledge receipt and provide an estimate for completion.`;

    const message: AgentMessage = {
      id: randomUUID(),
      type: 'task_assignment',
      from: coordinator.config.id,
      to: worker.config.id,
      timestamp: new Date(),
      content,
      metadata: {
        urgency: 'high',
        requiresResponse: true,
      },
    };

    // Add to worker's messages
    worker.messages.push({
      id: message.id,
      type: 'text',
      text: content,
    } as any);

    logForDebugging(`[AgentRouter] Task assignment sent to ${worker.config.id}`);

    return message;
  }

  /**
   * Send a task result message
   */
  async sendTaskResult(
    worker: Agent,
    coordinator: Agent,
    taskTitle: string,
    result: string,
    artifacts?: string[]
  ): Promise<AgentMessage> {
    let content = `Task Completed: ${taskTitle}

Result:
${result}`;

    if (artifacts && artifacts.length > 0) {
      content += `\n\nArtifacts:\n${artifacts.map((a) => `- ${a}`).join('\n')}`;
    }

    const message: AgentMessage = {
      id: randomUUID(),
      type: 'task_result',
      from: worker.config.id,
      to: coordinator.config.id,
      timestamp: new Date(),
      content,
      metadata: {
        requiresResponse: false,
      },
    };

    // Add to coordinator's messages
    coordinator.messages.push({
      id: message.id,
      type: 'text',
      text: content,
    } as any);

    logForDebugging(`[AgentRouter] Task result sent from ${worker.config.id}`);

    return message;
  }

  /**
   * Send a status update message
   */
  async sendStatusUpdate(
    from: Agent,
    toAgentId: string,
    status: string,
    details?: string
  ): Promise<AgentMessage> {
    const content = `Status Update: ${status}${details ? `\n${details}` : ''}`;

    return this.sendDirectMessage(from, toAgentId, content, from.config as any, {
      type: 'status_update',
    });
  }

  /**
   * Send a question to another agent
   */
  async sendQuestion(
    from: Agent,
    toAgentId: string,
    question: string,
    team: Team
  ): Promise<AgentMessage> {
    return this.sendDirectMessage(from, toAgentId, question, team, {
      type: 'question',
      metadata: {
        requiresResponse: true,
        urgency: 'normal',
      },
    });
  }

  /**
   * Send an answer to a question
   */
  async sendAnswer(
    from: Agent,
    toAgentId: string,
    answer: string,
    team: Team,
    originalQuestionId?: string
  ): Promise<AgentMessage> {
    return this.sendDirectMessage(from, toAgentId, answer, team, {
      type: 'answer',
      metadata: {
        taskId: originalQuestionId,
      },
    });
  }

  /**
   * Send coordination message (coordinator to workers)
   */
  async sendCoordinationMessage(
    coordinator: Agent,
    content: string,
    team: Team,
    options: {
      urgency?: 'low' | 'normal' | 'high';
      excludeIds?: string[];
    } = {}
  ): Promise<AgentMessage[]> {
    return this.broadcastMessage(coordinator, content, team, {
      type: 'coordination',
      excludeAgentIds: options.excludeIds,
      metadata: {
        urgency: options.urgency || 'normal',
      },
    });
  }

  /**
   * Auto-route a message based on registered routes
   */
  async autoRouteMessage(from: Agent, content: string, team: Team): Promise<AgentMessage | null> {
    // Find matching route
    for (const route of this.routes) {
      if (route.fromAgentId === from.config.id) {
        const pattern = new RegExp(route.pattern, 'i');
        if (pattern.test(content)) {
          return this.sendDirectMessage(from, route.toAgentId, content, team, {
            type: 'direct_message',
          });
        }
      }
    }
    return null;
  }

  /**
   * Queue a message for retry if delivery fails
   */
  queueMessage(teamId: string, message: AgentMessage): void {
    const queue = this.messageQueue.get(teamId) || [];
    queue.push({
      ...message,
      retryCount: 0,
      maxRetries: this.maxRetries,
    });
    this.messageQueue.set(teamId, queue);
  }

  /**
   * Process queued messages for a team
   */
  async processQueue(teamId: string, team: Team): Promise<void> {
    const queue = this.messageQueue.get(teamId);
    if (!queue || queue.length === 0) return;

    const failedMessages: QueuedMessage[] = [];

    for (const queuedMsg of queue) {
      try {
        if (queuedMsg.to) {
          const targetAgent = team.agents.get(queuedMsg.to);
          if (targetAgent) {
            targetAgent.messages.push({
              id: queuedMsg.id,
              type: 'text',
              text: queuedMsg.content,
            } as any);
          }
        }
      } catch (error) {
        queuedMsg.retryCount++;
        if (queuedMsg.retryCount < queuedMsg.maxRetries) {
          failedMessages.push(queuedMsg);
        } else {
          logForDebugging(
            `[AgentRouter] Message ${queuedMsg.id} failed after ${queuedMsg.maxRetries} retries`
          );
        }
      }
    }

    // Update queue with failed messages
    if (failedMessages.length > 0) {
      this.messageQueue.set(teamId, failedMessages);
    } else {
      this.messageQueue.delete(teamId);
    }
  }

  /**
   * Get message history for an agent
   */
  getAgentMessages(agent: Agent, limit?: number): unknown[] {
    const messages = agent.messages;
    if (limit) {
      return messages.slice(-limit);
    }
    return messages;
  }

  /**
   * Clear old messages for an agent
   */
  clearOldMessages(agent: Agent, keepCount: number = 100): void {
    if (agent.messages.length > keepCount) {
      agent.messages = agent.messages.slice(-keepCount);
    }
  }

  /**
   * Get all routes
   */
  getRoutes(): MessageRoute[] {
    return [...this.routes];
  }

  /**
   * Clear all routes
   */
  clearRoutes(): void {
    this.routes = [];
  }

  /**
   * Create default routes for a team
   */
  createDefaultRoutes(team: Team): void {
    const coordinatorId = team.coordinator?.config.id;
    if (!coordinatorId) return;

    // Route code-related messages to reviewer agents
    const reviewers = Array.from(team.agents.values()).filter((a) => a.config.role === 'reviewer');
    for (const reviewer of reviewers) {
      this.addRoute({
        fromAgentId: coordinatorId,
        toAgentId: reviewer.config.id,
        pattern: 'review|code|quality|check',
        priority: 1,
      });
    }

    // Route specialized tasks to specialist agents
    const specialists = Array.from(team.agents.values()).filter(
      (a) => a.config.role === 'specialist'
    );
    for (const specialist of specialists) {
      const specialty = specialist.config.description || '';
      this.addRoute({
        fromAgentId: coordinatorId,
        toAgentId: specialist.config.id,
        pattern: specialty.toLowerCase().split(' ').join('|'),
        priority: 2,
      });
    }
  }
}

// Export singleton instance
export const agentRouter = new AgentRouter();
