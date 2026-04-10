/**
 * SendMessageTool - Send messages to agent teammates
 *
 * Ported from Claude Code's SendMessageTool
 * Supports plain text, structured messages (shutdown, plan approval), and broadcast
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type MessageType =
  | 'text'
  | 'shutdown_request'
  | 'shutdown_response'
  | 'plan_approval_request'
  | 'plan_approval_response'
  | 'broadcast';

export type ResponseType = 'approve' | 'reject';

export interface StructuredShutdownRequest {
  type: 'shutdown_request';
  reason?: string;
}

export interface StructuredShutdownResponse {
  type: 'shutdown_response';
  request_id: string;
  approve: boolean;
  reason?: string;
}

export interface StructuredPlanApprovalRequest {
  type: 'plan_approval_request';
  request_id: string;
  plan_content: string;
}

export interface StructuredPlanApprovalResponse {
  type: 'plan_approval_response';
  request_id: string;
  approve: boolean;
  feedback?: string;
}

export type StructuredMessage =
  | StructuredShutdownRequest
  | StructuredShutdownResponse
  | StructuredPlanApprovalRequest
  | StructuredPlanApprovalResponse;

export interface SendMessageInput {
  to: string; // Recipient name, "*" for broadcast, or "team-lead"
  summary?: string; // 5-10 word preview (required for text messages)
  message: string | StructuredMessage;
}

export interface MessageOutput {
  success: boolean;
  message: string;
  routing?: {
    sender: string;
    senderColor?: string;
    target: string;
    targetColor?: string;
    summary?: string;
    content?: string;
  };
}

export interface BroadcastOutput extends MessageOutput {
  recipients: string[];
}

export interface RequestOutput extends MessageOutput {
  request_id: string;
  target: string;
}

export interface ResponseOutput extends MessageOutput {
  request_id?: string;
}

export type SendMessageOutput = MessageOutput | BroadcastOutput | RequestOutput | ResponseOutput;

export interface ToolContext {
  prisma: any;
  session: {
    agentId: string;
    agentName: string;
    teamContext?: {
      teamId: string;
      teamName: string;
      isLeader: boolean;
      color?: string;
    };
  };
  webSocket: {
    publishToTeam: (teamName: string, type: string, payload: any) => Promise<void>;
    publishToAgent: (agentId: string, type: string, payload: any) => Promise<void>;
  };
}

// ============================================================================
// Constants
// ============================================================================

export const SEND_MESSAGE_TOOL_NAME = 'SendMessage';
export const TEAM_LEAD_NAME = 'team-lead';

// ============================================================================
// Zod Schemas
// ============================================================================

const StructuredMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('shutdown_request'),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal('shutdown_response'),
    request_id: z.string(),
    approve: z.boolean(),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal('plan_approval_request'),
    request_id: z.string(),
    plan_content: z.string(),
  }),
  z.object({
    type: z.literal('plan_approval_response'),
    request_id: z.string(),
    approve: z.boolean(),
    feedback: z.string().optional(),
  }),
]);

export const SendMessageInputSchema = z.object({
  to: z.string().describe('Recipient: teammate name, "*" for broadcast, or "team-lead"'),
  summary: z
    .string()
    .optional()
    .describe(
      'A 5-10 word summary shown as a preview in the UI (required when message is a string)'
    ),
  message: z.union([z.string().describe('Plain text message content'), StructuredMessageSchema]),
});

// ============================================================================
// Utility Functions
// ============================================================================

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Tool Implementation
// ============================================================================

export class SendMessageTool {
  readonly name = SEND_MESSAGE_TOOL_NAME;
  readonly description = 'Send messages to agent teammates';
  readonly shouldDefer = true;

  /**
   * Execute the SendMessage tool
   */
  async execute(
    input: SendMessageInput,
    context: ToolContext
  ): Promise<{ data: SendMessageOutput }> {
    const teamName = context.session.teamContext?.teamName;
    if (!teamName) {
      throw new Error('Not in a team context. Create a team with TeamCreate first.');
    }

    const team = await context.prisma.agentTeam.findUnique({
      where: { teamName },
      include: { members: true },
    });

    if (!team) {
      throw new Error(`Team "${teamName}" does not exist`);
    }

    const senderName =
      context.session.agentName ||
      (context.session.teamContext?.isLeader ? TEAM_LEAD_NAME : 'teammate');
    const senderColor = context.session.teamContext?.color;

    // Handle broadcast
    if (input.to === '*') {
      return this.handleBroadcast(
        input.message,
        input.summary,
        context,
        team,
        senderName,
        senderColor
      );
    }

    // Handle structured messages
    if (typeof input.message === 'object') {
      return this.handleStructuredMessage(
        input.to,
        input.message,
        context,
        team,
        senderName,
        senderColor
      );
    }

    // Handle plain text message
    return this.handlePlainMessage(
      input.to,
      input.message,
      input.summary,
      context,
      team,
      senderName,
      senderColor
    );
  }

  /**
   * Handle plain text message to specific recipient
   */
  private async handlePlainMessage(
    recipientName: string,
    content: string,
    summary: string | undefined,
    context: ToolContext,
    team: any,
    senderName: string,
    senderColor?: string
  ): Promise<{ data: MessageOutput }> {
    const { prisma, webSocket, session } = context;

    // Validate summary for text messages
    if (!summary || summary.trim().length === 0) {
      throw new Error('summary is required when message is a string');
    }

    // Verify recipient exists
    const recipient = team.members.find((m: any) => m.name === recipientName);
    if (!recipient && recipientName !== TEAM_LEAD_NAME) {
      throw new Error(`Teammate "${recipientName}" not found in team`);
    }

    // Write to mailbox
    const message = await prisma.teamMailbox.create({
      data: {
        teamId: team.teamId,
        toAgentId: recipientName,
        fromAgentId: senderName,
        messageType: 'text',
        content,
        summary,
        isRead: false,
        isProcessed: false,
      },
    });

    // Publish event
    await webSocket.publishToTeam(team.teamName, 'message:received', {
      messageId: message.messageId,
      teamName: team.teamName,
      fromAgentId: senderName,
      fromAgentName: senderName,
      toAgentId: recipientName,
      summary,
      content: truncate(content, 200),
      messageType: 'text',
      timestamp: new Date().toISOString(),
    });

    // Also publish to specific agent channel if WebSocket supports it
    if (recipient?.agentId) {
      await webSocket.publishToAgent(recipient.agentId, 'message:received', {
        messageId: message.messageId,
        teamName: team.teamName,
        fromAgentId: senderName,
        fromAgentName: senderName,
        toAgentId: recipientName,
        summary,
        content: truncate(content, 200),
        messageType: 'text',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      data: {
        success: true,
        message: `Message sent to ${recipientName}'s inbox`,
        routing: {
          sender: senderName,
          senderColor,
          target: `@${recipientName}`,
          targetColor: recipient?.color,
          summary,
          content: truncate(content, 200),
        },
      },
    };
  }

  /**
   * Handle broadcast message to all teammates
   */
  private async handleBroadcast(
    content: string | StructuredMessage,
    summary: string | undefined,
    context: ToolContext,
    team: any,
    senderName: string,
    senderColor?: string
  ): Promise<{ data: BroadcastOutput }> {
    const { prisma, webSocket } = context;

    // Cannot broadcast structured messages
    if (typeof content !== 'string') {
      throw new Error('structured messages cannot be broadcast (use a specific recipient)');
    }

    // Get all members except sender
    const recipients = team.members
      .filter((m: any) => m.name !== senderName && m.isActive)
      .map((m: any) => m.name);

    if (recipients.length === 0) {
      return {
        data: {
          success: true,
          message: 'No teammates to broadcast to (you are the only active team member)',
          recipients: [],
        },
      };
    }

    // Send to each recipient
    const sendPromises = recipients.map(async (recipientName: string) => {
      return prisma.teamMailbox.create({
        data: {
          teamId: team.teamId,
          toAgentId: recipientName,
          fromAgentId: senderName,
          messageType: 'broadcast',
          content,
          summary: summary || truncate(content, 50),
          isRead: false,
          isProcessed: false,
        },
      });
    });

    await Promise.all(sendPromises);

    // Publish broadcast event
    await webSocket.publishToTeam(team.teamName, 'message:broadcast', {
      teamName: team.teamName,
      fromAgentId: senderName,
      fromAgentName: senderName,
      summary: summary || truncate(content, 50),
      content: truncate(content, 200),
      timestamp: new Date().toISOString(),
    });

    return {
      data: {
        success: true,
        message: `Message broadcast to ${recipients.length} teammate(s): ${recipients.join(', ')}`,
        recipients,
        routing: {
          sender: senderName,
          senderColor,
          target: '@team',
          summary: summary || truncate(content, 50),
          content: truncate(content, 200),
        },
      },
    };
  }

  /**
   * Handle structured messages (shutdown, plan approval)
   */
  private async handleStructuredMessage(
    recipient: string,
    message: StructuredMessage,
    context: ToolContext,
    team: any,
    senderName: string,
    senderColor?: string
  ): Promise<{ data: RequestOutput | ResponseOutput }> {
    const { prisma, webSocket, session } = context;

    switch (message.type) {
      case 'shutdown_request':
        return this.handleShutdownRequest(
          recipient,
          message.reason,
          context,
          team,
          senderName,
          senderColor
        );

      case 'shutdown_response':
        return this.handleShutdownResponse(recipient, message, context, team, senderName);

      case 'plan_approval_request':
        return this.handlePlanApprovalRequest(
          recipient,
          message,
          context,
          team,
          senderName,
          senderColor
        );

      case 'plan_approval_response':
        return this.handlePlanApprovalResponse(recipient, message, context, team, senderName);

      default:
        throw new Error(`Unknown structured message type: ${(message as any).type}`);
    }
  }

  /**
   * Handle shutdown request
   */
  private async handleShutdownRequest(
    targetName: string,
    reason: string | undefined,
    context: ToolContext,
    team: any,
    senderName: string,
    senderColor?: string
  ): Promise<{ data: RequestOutput }> {
    const { prisma, webSocket } = context;

    // Only team lead can request shutdown
    if (senderName !== TEAM_LEAD_NAME && !context.session.teamContext?.isLeader) {
      throw new Error('Only the team lead can request teammate shutdowns');
    }

    const requestId = `shutdown-${targetName}-${Date.now()}`;

    // Write to mailbox
    const mailboxMessage = await prisma.teamMailbox.create({
      data: {
        teamId: team.teamId,
        toAgentId: targetName,
        fromAgentId: senderName,
        messageType: 'shutdown_request',
        content: JSON.stringify({
          type: 'shutdown_request',
          requestId,
          reason,
          timestamp: new Date().toISOString(),
        }),
        summary: `Shutdown requested${reason ? `: ${reason}` : ''}`,
        requestId,
        isRead: false,
        isProcessed: false,
      },
    });

    // Update session to mark shutdown requested
    await prisma.agentTeamSession.updateMany({
      where: {
        teamId: team.teamId,
        agentId: { contains: targetName },
      },
      data: {
        shutdownRequested: true,
      },
    });

    // Publish event
    await webSocket.publishToTeam(team.teamName, 'agent:shutdown', {
      agentId: targetName,
      teamName: team.teamName,
      reason,
      approved: false,
      timestamp: new Date().toISOString(),
    });

    return {
      data: {
        success: true,
        message: `Shutdown request sent to ${targetName}. Request ID: ${requestId}`,
        request_id: requestId,
        target: targetName,
        routing: {
          sender: senderName,
          senderColor,
          target: `@${targetName}`,
          summary: 'Shutdown request',
        },
      },
    };
  }

  /**
   * Handle shutdown response
   */
  private async handleShutdownResponse(
    recipient: string,
    message: StructuredShutdownResponse,
    context: ToolContext,
    team: any,
    senderName: string
  ): Promise<{ data: ResponseOutput }> {
    const { prisma, webSocket } = context;

    // Must respond to team-lead
    if (recipient !== TEAM_LEAD_NAME) {
      throw new Error(`shutdown_response must be sent to "${TEAM_LEAD_NAME}"`);
    }

    // Validate rejection has reason
    if (!message.approve && (!message.reason || message.reason.trim().length === 0)) {
      throw new Error('reason is required when rejecting a shutdown request');
    }

    // Write to mailbox
    await prisma.teamMailbox.create({
      data: {
        teamId: team.teamId,
        toAgentId: recipient,
        fromAgentId: senderName,
        messageType: 'shutdown_response',
        content: JSON.stringify({
          type: 'shutdown_response',
          requestId: message.request_id,
          approved: message.approve,
          reason: message.reason,
          timestamp: new Date().toISOString(),
        }),
        summary: message.approve ? 'Shutdown approved' : `Shutdown rejected: ${message.reason}`,
        requestId: message.request_id,
        responseType: message.approve ? 'approve' : 'reject',
        feedback: message.reason,
        isRead: false,
        isProcessed: false,
      },
    });

    // Update session if approved
    if (message.approve) {
      await prisma.agentTeamSession.updateMany({
        where: {
          teamId: team.teamId,
          agentId: { contains: senderName },
        },
        data: {
          shutdownApproved: true,
          executionState: 'shutting_down',
        },
      });
    }

    // Publish event
    await webSocket.publishToTeam(team.teamName, 'agent:shutdown', {
      agentId: senderName,
      teamName: team.teamName,
      reason: message.reason,
      approved: message.approve,
      timestamp: new Date().toISOString(),
    });

    return {
      data: {
        success: true,
        message: message.approve
          ? `Shutdown approved. Agent ${senderName} will exit.`
          : `Shutdown rejected. Reason: "${message.reason}". Continuing to work.`,
        request_id: message.request_id,
        routing: {
          sender: senderName,
          target: `@${recipient}`,
        },
      },
    };
  }

  /**
   * Handle plan approval request (from teammate to lead)
   */
  private async handlePlanApprovalRequest(
    recipient: string,
    message: StructuredPlanApprovalRequest,
    context: ToolContext,
    team: any,
    senderName: string,
    senderColor?: string
  ): Promise<{ data: RequestOutput }> {
    const { prisma, webSocket } = context;

    // Must request from team-lead
    if (recipient !== TEAM_LEAD_NAME) {
      throw new Error('plan approval requests must be sent to the team lead');
    }

    // Update session to mark awaiting approval
    await prisma.agentTeamSession.updateMany({
      where: {
        teamId: team.teamId,
        agentId: { contains: senderName },
      },
      data: {
        awaitingPlanApproval: true,
        planSubmitted: true,
        planContent: message.plan_content,
        executionState: 'waiting_for_plan_approval',
      },
    });

    // Write to mailbox
    const mailboxMessage = await prisma.teamMailbox.create({
      data: {
        teamId: team.teamId,
        toAgentId: recipient,
        fromAgentId: senderName,
        messageType: 'plan_approval_request',
        content: JSON.stringify({
          type: 'plan_approval_request',
          requestId: message.request_id,
          planContent: message.plan_content,
          timestamp: new Date().toISOString(),
        }),
        summary: `Plan approval requested by ${senderName}`,
        requestId: message.request_id,
        isRead: false,
        isProcessed: false,
      },
    });

    // Publish event
    await webSocket.publishToTeam(team.teamName, 'plan:submitted', {
      agentId: senderName,
      teamName: team.teamName,
      planContent: truncate(message.plan_content, 500),
      requestId: message.request_id,
      timestamp: new Date().toISOString(),
    });

    return {
      data: {
        success: true,
        message: `Plan approval request sent to ${recipient}. Request ID: ${message.request_id}`,
        request_id: message.request_id,
        target: recipient,
        routing: {
          sender: senderName,
          senderColor,
          target: `@${recipient}`,
          summary: 'Plan approval request',
        },
      },
    };
  }

  /**
   * Handle plan approval response (from lead to teammate)
   */
  private async handlePlanApprovalResponse(
    recipient: string,
    message: StructuredPlanApprovalResponse,
    context: ToolContext,
    team: any,
    senderName: string
  ): Promise<{ data: ResponseOutput }> {
    const { prisma, webSocket } = context;

    // Only team lead can approve plans
    if (senderName !== TEAM_LEAD_NAME && !context.session.teamContext?.isLeader) {
      throw new Error(
        'Only the team lead can approve plans. Teammates cannot approve their own or other plans.'
      );
    }

    // Update session
    await prisma.agentTeamSession.updateMany({
      where: {
        teamId: team.teamId,
        agentId: { contains: recipient },
      },
      data: {
        awaitingPlanApproval: false,
        planApproved: message.approve,
        planFeedback: message.feedback,
        executionState: message.approve ? 'running' : 'running', // Continue running, teammate will check approval
      },
    });

    // Write to mailbox
    await prisma.teamMailbox.create({
      data: {
        teamId: team.teamId,
        toAgentId: recipient,
        fromAgentId: senderName,
        messageType: 'plan_approval_response',
        content: JSON.stringify({
          type: 'plan_approval_response',
          requestId: message.request_id,
          approved: message.approve,
          feedback: message.feedback,
          timestamp: new Date().toISOString(),
        }),
        summary: message.approve ? 'Plan approved' : `Plan rejected: ${message.feedback}`,
        requestId: message.request_id,
        responseType: message.approve ? 'approve' : 'reject',
        feedback: message.feedback,
        isRead: false,
        isProcessed: false,
      },
    });

    // Publish event
    const eventType = message.approve ? 'plan:approved' : 'plan:rejected';
    await webSocket.publishToTeam(team.teamName, eventType, {
      agentId: recipient,
      teamName: team.teamName,
      requestId: message.request_id,
      feedback: message.feedback,
      timestamp: new Date().toISOString(),
    });

    return {
      data: {
        success: true,
        message: message.approve
          ? `Plan approved for ${recipient}. They can proceed with implementation.`
          : `Plan rejected for ${recipient} with feedback: "${message.feedback}"`,
        request_id: message.request_id,
        routing: {
          sender: senderName,
          target: `@${recipient}`,
        },
      },
    };
  }

  /**
   * Get tool prompt/description for LLM
   */
  async getPrompt(): Promise<string> {
    return `
Send messages to agent teammates.

## When to Use
Use this tool for:
- Plain text communication between agents
- Requesting teammate shutdown
- Responding to shutdown requests
- Submitting plans for approval (teammates)
- Approving or rejecting plans (lead)
- Broadcasting to all teammates

## Message Types

### Plain Text
Simple messages for coordination:
SendMessage({ 
  to: "researcher", 
  summary: "Found security issue in auth.ts",
  message: "I discovered a potential SQL injection vulnerability..."
})

### Shutdown Request (Lead only)
Request a teammate to gracefully exit:
SendMessage({
  to: "researcher",
  message: { type: "shutdown_request", reason: "Team wrapping up" }
})

### Shutdown Response (Teammate)
Approve or reject shutdown:
SendMessage({
  to: "team-lead",
  message: { 
    type: "shutdown_response", 
    request_id: "shutdown-researcher-123456",
    approve: true 
  }
})

### Plan Approval Request (Teammate)
Submit plan before implementing (if plan mode required):
SendMessage({
  to: "team-lead",
  message: {
    type: "plan_approval_request",
    request_id: "plan-researcher-789",
    plan_content: "My implementation plan: 1) Add validation..."
  }
})

### Plan Approval Response (Lead only)
Approve or reject teammate's plan:
SendMessage({
  to: "researcher",
  message: {
    type: "plan_approval_response",
    request_id: "plan-researcher-789",
    approve: false,
    feedback: "Please also add rate limiting"
  }
})

### Broadcast (Plain text only)
Send to all teammates:
SendMessage({
  to: "*",
  summary: "All clear to proceed",
  message: "The blocking issue has been resolved..."
})

## Important Notes
- Use summary (5-10 words) for plain text messages
- Structured messages cannot be broadcast (use specific recipient)
- Only team lead can request shutdowns and approve plans
- Teammates must respond to shutdown requests from team-lead
`;
  }

  /**
   * Render tool use message for UI
   */
  renderToolUseMessage(input: SendMessageInput): string {
    if (typeof input.message === 'string') {
      return `Sending message to ${input.to}: ${input.summary || truncate(input.message, 30)}`;
    }
    return `Sending ${input.message.type} to ${input.to}`;
  }

  /**
   * Render tool result message for UI
   */
  renderToolResultMessage(output: SendMessageOutput): string {
    return output.message;
  }
}

// Export singleton instance
export const sendMessageTool = new SendMessageTool();
