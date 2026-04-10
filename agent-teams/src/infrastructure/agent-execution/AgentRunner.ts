/**
 * AgentRunner - Executes agents with continuous prompt loop
 *
 * Ported from Claude Code's runAgent and inProcessRunner
 * Handles the main agent execution lifecycle with tool calling
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AgentRunnerConfig {
  agentId: string;
  agentName: string;
  teamName: string;
  prompt: string;
  description?: string;
  model?: string;
  planModeRequired?: boolean;
  parentSessionId?: string;
  systemPrompt?: string;
  allowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
  is_error?: boolean;
}

export interface ToolUseBlock extends ContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock extends ContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: unknown;
  is_error?: boolean;
}

export interface AgentContext {
  prisma: any;
  sessionId: string;
  agentId: string;
  agentName: string;
  teamName: string;
  isLeader: boolean;
  abortController: AbortController;
  webSocket: {
    publishToTeam: (teamName: string, type: string, payload: any) => Promise<void>;
    publishToAgent: (agentId: string, type: string, payload: any) => Promise<void>;
  };
  anthropicClient: AnthropicClient;
  toolRegistry: ToolRegistry;
  logger: Logger;
}

export interface AnthropicClient {
  messages: {
    create: (params: AnthropicRequest) => Promise<AnthropicResponse>;
  };
}

export interface AnthropicRequest {
  model: string;
  system?: string;
  messages: Message[];
  tools?: ToolDefinition[];
  tool_choice?: { type: 'auto' | 'any' | 'tool'; name?: string };
  max_tokens: number;
  temperature?: number;
}

export interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: ContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolRegistry {
  getTool: (name: string) => Tool | undefined;
  getAllTools: () => Tool[];
  getToolsForAgent: (allowedTools?: string[]) => ToolDefinition[];
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: unknown;
  execute: (input: unknown, context: ToolContext) => Promise<ToolResult>;
  isReadOnly?: (input: unknown) => boolean;
}

export interface ToolContext {
  prisma: any;
  session: {
    agentId: string;
    agentName: string;
    teamContext?: {
      teamId: string;
      teamName: string;
      isLeader: boolean;
    };
  };
  webSocket: AgentContext['webSocket'];
  abortSignal: AbortSignal;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  isError?: boolean;
}

export interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, error?: Error | unknown) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
}

export interface AgentExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
  tokenCount: number;
  toolUseCount: number;
  durationMs: number;
}

// ============================================================================
// Agent Runner Implementation
// ============================================================================

export class AgentRunner {
  private context: AgentContext;
  private config: AgentRunnerConfig;
  private messages: Message[] = [];
  private tokenCount = 0;
  private toolUseCount = 0;
  private startTime: number = 0;

  constructor(context: AgentContext, config: AgentRunnerConfig) {
    this.context = context;
    this.config = config;
  }

  /**
   * Main execution loop
   */
  async run(): Promise<AgentExecutionResult> {
    this.startTime = Date.now();
    const { logger, prisma, webSocket } = this.context;

    logger.info('Starting agent execution', {
      agentId: this.config.agentId,
      agentName: this.config.agentName,
      teamName: this.config.teamName,
    });

    try {
      // 1. Initialize session
      await this.initializeSession();

      // 2. Build system prompt
      const systemPrompt = await this.buildSystemPrompt();

      // 3. Initialize message history with initial prompt
      this.messages = [{ role: 'user', content: this.config.prompt }];

      // 4. Main execution loop
      while (!this.context.abortController.signal.aborted) {
        // Check for shutdown request
        if (await this.checkShutdownRequested()) {
          logger.info('Shutdown requested, stopping execution', { agentId: this.config.agentId });
          await this.completeSession('completed');
          return this.buildResult(true, 'Execution stopped by shutdown request');
        }

        // Check for incoming messages
        await this.processIncomingMessages();

        // Check plan mode
        if (this.config.planModeRequired && (await this.checkPlanApprovalNeeded())) {
          // Wait for plan approval
          const approved = await this.waitForPlanApproval();
          if (!approved) {
            // Continue waiting
            await this.sleep(1000);
            continue;
          }
        }

        // Call Anthropic API
        const response = await this.callAnthropicAPI(systemPrompt);

        // Update token count
        this.tokenCount += response.usage.input_tokens + response.usage.output_tokens;

        // Process response
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.content,
        };
        this.messages.push(assistantMessage);

        // Update session last active
        await this.updateSessionActivity();

        // Handle tool calls
        const toolUses = response.content.filter(
          (block): block is ToolUseBlock => block.type === 'tool_use'
        );

        if (toolUses.length > 0) {
          this.toolUseCount += toolUses.length;

          // Execute tools
          for (const toolUse of toolUses) {
            if (this.context.abortController.signal.aborted) {
              break;
            }

            const result = await this.executeTool(toolUse);

            // Add tool result to messages
            this.messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolUse.id,
                  content: result.success
                    ? JSON.stringify(result.data)
                    : result.isError
                      ? `Error: ${result.error}`
                      : result.error || 'Unknown error',
                  is_error: result.isError || !result.success,
                } as ToolResultBlock,
              ],
            });

            // Publish tool execution event
            await webSocket.publishToTeam(this.config.teamName, 'agent:progress', {
              agentId: this.config.agentId,
              teamName: this.config.teamName,
              toolName: toolUse.name,
              description: this.config.description || 'Working',
              status: result.success ? 'completed' : 'error',
              tokenCount: this.tokenCount,
              timestamp: new Date().toISOString(),
            });

            // Log execution
            await this.logExecutionEvent('tool_completed', {
              toolName: toolUse.name,
              toolInput: toolUse.input,
              success: result.success,
              error: result.error,
            });
          }
        } else {
          // No tool calls - natural response complete
          // Check if should continue or end
          if (response.stop_reason === 'end_turn') {
            await this.completeSession('completed');
            const finalText = this.extractTextFromMessage(assistantMessage);
            return this.buildResult(true, finalText);
          }
        }

        // Check max tokens limit
        if (this.tokenCount > 100000) {
          // 100k token limit
          logger.warn('Token limit approaching, completing session', {
            agentId: this.config.agentId,
            tokenCount: this.tokenCount,
          });
          await this.completeSession('completed');
          return this.buildResult(true, 'Session completed due to token limit');
        }
      }

      // Aborted
      await this.completeSession('killed');
      return this.buildResult(false, 'Execution aborted');
    } catch (error) {
      logger.error('Agent execution failed', error);
      await this.completeSession(
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return this.buildResult(false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Initialize session in database
   */
  private async initializeSession(): Promise<void> {
    const team = await this.context.prisma.agentTeam.findUnique({
      where: { teamName: this.config.teamName },
    });

    if (!team) {
      throw new Error(`Team ${this.config.teamName} not found`);
    }

    await this.context.prisma.agentTeamSession.create({
      data: {
        teamId: team.teamId,
        agentId: this.config.agentId,
        parentSessionId: this.config.parentSessionId,
        prompt: this.config.prompt,
        description: this.config.description,
        executionState: this.config.planModeRequired ? 'waiting_for_plan_approval' : 'running',
        awaitingPlanApproval: this.config.planModeRequired,
      },
    });

    // Log event
    await this.logExecutionEvent('session_started', {
      prompt: this.config.prompt,
      description: this.config.description,
    });

    // Publish WebSocket event
    await this.context.webSocket.publishToTeam(this.config.teamName, 'agent:spawned', {
      agentId: this.config.agentId,
      agentName: this.config.agentName,
      teamName: this.config.teamName,
      color: '', // Would come from member record
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Build system prompt for agent
   */
  private async buildSystemPrompt(): Promise<string> {
    const basePrompt = this.config.systemPrompt || (await this.getDefaultSystemPrompt());

    // Add teammate context addendum
    const teammateAddendum = `
## Agent Team Context

You are part of a team: ${this.config.teamName}
Your name in this team: ${this.config.agentName}
Your ID: ${this.config.agentId}
${this.config.parentSessionId ? `Parent session (team lead): ${this.config.parentSessionId}` : 'You are the team lead'}

## Inter-Agent Communication

You can communicate with other team members using the SendMessage tool:
- Send plain text messages with a summary
- Request shutdown (if you're the lead)
- Respond to shutdown requests
${this.config.planModeRequired ? '- Submit plans for approval before implementing' : ''}

Messages are delivered asynchronously through the mailbox system.

## Task Management

You have access to the shared task list:
- TaskList: See available tasks
- TaskGet: Get task details
- TaskUpdate: Claim tasks (status → in_progress) or complete them

Claim tasks you're working on so teammates don't duplicate effort.

## Important Rules

1. ALWAYS claim a task before working on it
2. Report progress via messages to the team lead
3. If plan mode is required, submit your plan and wait for approval
4. Respond promptly to shutdown requests
5. Don't spawn nested teams - teammates cannot create teammates
`;

    return `${basePrompt}\n${teammateAddendum}`;
  }

  /**
   * Get default system prompt
   */
  private async getDefaultSystemPrompt(): Promise<string> {
    return `You are Claude, an AI assistant made by Anthropic. You are part of an agent team, working collaboratively with other AI agents.

## Core Capabilities

You have access to tools for:
- File operations (read, write, edit)
- Shell commands
- Web search and fetch
- Code analysis and modification
- Inter-agent messaging
- Task management

## Work Style

- Be proactive and autonomous
- Use tools to accomplish tasks
- Communicate clearly with teammates
- Follow the team's coordination patterns
- Respect task assignments and dependencies

## Safety & Permissions

Your permission mode determines what actions require approval:
- Plan mode: You must submit plans before making changes
- Accept edits: You can make file changes directly
- Bypass: Minimal restrictions (use carefully)

Always prioritize safety and correctness over speed.`;
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropicAPI(systemPrompt: string): Promise<AnthropicResponse> {
    const tools = this.context.toolRegistry.getToolsForAgent(this.config.allowedTools);

    return this.context.anthropicClient.messages.create({
      model: this.config.model || 'claude-sonnet-4-20250514',
      system: systemPrompt,
      messages: this.messages,
      tools: tools.length > 0 ? tools : undefined,
      max_tokens: 4096,
      temperature: 0.7,
    });
  }

  /**
   * Execute a tool
   */
  private async executeTool(toolUse: ToolUseBlock): Promise<ToolResult> {
    const { toolRegistry, logger } = this.context;

    const tool = toolRegistry.getTool(toolUse.name);
    if (!tool) {
      return { success: false, error: `Tool "${toolUse.name}" not found`, isError: true };
    }

    logger.debug(`Executing tool ${toolUse.name}`, { agentId: this.config.agentId });

    try {
      const toolContext: ToolContext = {
        prisma: this.context.prisma,
        session: {
          agentId: this.config.agentId,
          agentName: this.config.agentName,
          teamContext: {
            teamId: (await this.getTeam())?.teamId,
            teamName: this.config.teamName,
            isLeader: this.config.parentSessionId === undefined,
          },
        },
        webSocket: this.context.webSocket,
        abortSignal: this.context.abortController.signal,
      };

      const result = await tool.execute(toolUse.input, toolContext);
      return result;
    } catch (error) {
      logger.error(`Tool ${toolUse.name} failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
        isError: true,
      };
    }
  }

  /**
   * Process incoming messages from mailbox
   */
  private async processIncomingMessages(): Promise<void> {
    const team = await this.getTeam();
    if (!team) return;

    // Fetch unread messages for this agent
    const messages = await this.context.prisma.teamMailbox.findMany({
      where: {
        teamId: team.teamId,
        toAgentId: this.config.agentName,
        isRead: false,
        isProcessed: false,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const message of messages) {
      // Mark as processed
      await this.context.prisma.teamMailbox.update({
        where: { messageId: message.messageId },
        data: { isProcessed: true },
      });

      // Add to message history
      let messageContent = `[Message from ${message.fromAgentId}]`;

      if (message.messageType === 'text' || message.messageType === 'broadcast') {
        messageContent += `: ${message.content}`;
      } else {
        // Structured message
        try {
          const structured = JSON.parse(message.content);
          messageContent += ` [${structured.type}]`;
          if (structured.reason) messageContent += `: ${structured.reason}`;
          if (structured.feedback) messageContent += `: ${structured.feedback}`;
        } catch {
          messageContent += `: ${message.content}`;
        }
      }

      this.messages.push({
        role: 'user',
        content: messageContent,
      });
    }
  }

  /**
   * Check if shutdown was requested
   */
  private async checkShutdownRequested(): Promise<boolean> {
    const session = await this.context.prisma.agentTeamSession.findFirst({
      where: {
        agentId: this.config.agentId,
        team: { teamName: this.config.teamName },
      },
    });

    return (
      session?.shutdownApproved === true ||
      (session?.shutdownRequested && (await this.checkShutdownInMailbox()))
    );
  }

  /**
   * Check for shutdown approval in mailbox
   */
  private async checkShutdownInMailbox(): Promise<boolean> {
    const team = await this.getTeam();
    if (!team) return false;

    const shutdownResponse = await this.context.prisma.teamMailbox.findFirst({
      where: {
        teamId: team.teamId,
        toAgentId: this.config.agentName,
        messageType: 'shutdown_response',
        isProcessed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (shutdownResponse) {
      try {
        const content = JSON.parse(shutdownResponse.content);
        return content.approve === true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Check if plan approval is needed
   */
  private async checkPlanApprovalNeeded(): Promise<boolean> {
    const session = await this.context.prisma.agentTeamSession.findFirst({
      where: {
        agentId: this.config.agentId,
        team: { teamName: this.config.teamName },
      },
    });

    return session?.awaitingPlanApproval === true && session?.planApproved !== true;
  }

  /**
   * Wait for plan approval
   */
  private async waitForPlanApproval(): Promise<boolean> {
    const session = await this.context.prisma.agentTeamSession.findFirst({
      where: {
        agentId: this.config.agentId,
        team: { teamName: this.config.teamName },
      },
    });

    if (!session) return false;

    // Check if plan was approved or rejected
    if (session.planApproved === true) {
      return true;
    }

    if (session.planApproved === false) {
      // Plan was rejected, include feedback in messages
      if (session.planFeedback) {
        this.messages.push({
          role: 'user',
          content: `[Plan Rejected] Feedback: ${session.planFeedback}\n\nPlease revise your approach and submit a new plan.`,
        });
      }

      // Reset plan submitted flag
      await this.context.prisma.agentTeamSession.updateMany({
        where: {
          agentId: this.config.agentId,
          team: { teamName: this.config.teamName },
        },
        data: {
          planSubmitted: false,
          awaitingPlanApproval: true,
          planApproved: null,
        },
      });

      return false;
    }

    // Still waiting
    return false;
  }

  /**
   * Update session activity
   */
  private async updateSessionActivity(): Promise<void> {
    await this.context.prisma.agentTeamSession.updateMany({
      where: {
        agentId: this.config.agentId,
        team: { teamName: this.config.teamName },
      },
      data: {
        lastActiveAt: new Date(),
        accumulatedTokens: this.tokenCount,
      },
    });
  }

  /**
   * Complete session
   */
  private async completeSession(
    state: 'completed' | 'failed' | 'killed',
    failureReason?: string
  ): Promise<void> {
    await this.context.prisma.agentTeamSession.updateMany({
      where: {
        agentId: this.config.agentId,
        team: { teamName: this.config.teamName },
      },
      data: {
        executionState: state,
        endedAt: new Date(),
        failureReason,
        accumulatedTokens: this.tokenCount,
      },
    });

    // Publish completion event
    const eventType =
      state === 'completed'
        ? 'agent:completed'
        : state === 'failed'
          ? 'agent:failed'
          : 'agent:shutdown';

    await this.context.webSocket.publishToTeam(this.config.teamName, eventType, {
      agentId: this.config.agentId,
      teamName: this.config.teamName,
      result: state === 'completed' ? 'Success' : failureReason || state,
      durationMs: Date.now() - this.startTime,
      tokenCount: this.tokenCount,
      timestamp: new Date().toISOString(),
    });

    // Log event
    await this.logExecutionEvent(
      state === 'completed'
        ? 'session_completed'
        : state === 'failed'
          ? 'session_failed'
          : 'session_killed',
      { failureReason, tokenCount: this.tokenCount }
    );
  }

  /**
   * Log execution event
   */
  private async logExecutionEvent(
    eventType: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    const team = await this.getTeam();
    if (!team) return;

    await this.context.prisma.agentExecutionLog.create({
      data: {
        sessionId: this.context.sessionId,
        agentId: this.config.agentId,
        teamId: team.teamId,
        eventType,
        eventData,
        model: this.config.model,
        tokenCount: this.tokenCount,
      },
    });
  }

  /**
   * Get team from database
   */
  private async getTeam(): Promise<any> {
    return this.context.prisma.agentTeam.findUnique({
      where: { teamName: this.config.teamName },
    });
  }

  /**
   * Extract text from message
   */
  private extractTextFromMessage(message: Message): string {
    if (typeof message.content === 'string') {
      return message.content;
    }

    return message.content
      .filter((block): block is ContentBlock & { type: 'text' } => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }

  /**
   * Build execution result
   */
  private buildResult(success: boolean, result: string): AgentExecutionResult {
    return {
      success,
      result,
      tokenCount: this.tokenCount,
      toolUseCount: this.toolUseCount,
      durationMs: Date.now() - this.startTime,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export async function runAgent(
  config: AgentRunnerConfig,
  context: Omit<AgentContext, 'sessionId'>
): Promise<AgentExecutionResult> {
  const sessionId = randomUUID();
  const runner = new AgentRunner({ ...context, sessionId }, config);
  return runner.run();
}
