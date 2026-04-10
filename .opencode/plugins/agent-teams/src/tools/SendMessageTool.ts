/**
 * SendMessageTool - Send messages to agent teammates
 *
 * Supports:
 * - Plain text messages
 * - Broadcast to entire team
 * - Structured messages (shutdown_request, plan_approval, delegation)
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { ToolContext, SendMessageInput, SendMessageOutput, Message } from '../core/types';

export const SendMessageInputSchema = z.object({
  team_name: z.string().min(1),
  to: z.string().min(1),
  message: z.union([z.string(), z.object({})]),
  summary: z.string().optional(),
});

export class SendMessageTool {
  static async execute(
    input: z.infer<typeof SendMessageInputSchema>,
    context: ToolContext
  ): Promise<SendMessageOutput> {
    const { storage, session, logger } = context;

    // Get current team
    const team = await storage.getTeam(input.team_name);
    if (!team) {
      throw new Error(`Team "${input.team_name}" not found`);
    }

    const senderName = session.agentName;
    const senderId = session.agentId;

    // Handle broadcast
    if (input.to === '*') {
      return this.handleBroadcast(input, context, team);
    }

    // Handle structured message
    if (typeof input.message === 'object') {
      return this.handleStructuredMessage(input, context, team, senderName, senderId);
    }

    // Handle plain text
    return this.handlePlainText(input, context, team, senderName, senderId);
  }

  private static async handlePlainText(
    input: z.infer<typeof SendMessageInputSchema>,
    context: ToolContext,
    team: any,
    senderName: string,
    senderId: string
  ): Promise<SendMessageOutput> {
    const { storage, logger } = context;

    // Validate summary is present for text messages
    if (!input.summary || input.summary.trim().length === 0) {
      throw new Error('summary is required when message is a string');
    }

    // Verify recipient exists in team
    const recipientExists = Object.values(team.members).some(
      (m: any) => m.name === input.to || m.agentId === input.to
    );

    if (!recipientExists && input.to !== 'team-lead') {
      throw new Error(`Teammate "${input.to}" not found in team "${input.team_name}"`);
    }

    const message: Message = {
      messageId: randomUUID(),
      fromAgentId: senderId,
      toAgentId: input.to,
      messageType: 'text',
      content: input.message as string,
      summary: input.summary,
      isRead: false,
      isProcessed: false,
      createdAt: new Date().toISOString(),
    };

    await storage.saveMessage(input.team_name, input.to, message);

    logger.info('Message sent', {
      to: input.to,
      from: senderName,
      team: input.team_name,
      type: 'text',
    });

    return {
      success: true,
      message: `Message sent to ${input.to}'s inbox`,
      routing: {
        sender: senderName,
        target: `@${input.to}`,
        summary: input.summary,
      },
    };
  }

  private static async handleBroadcast(
    input: z.infer<typeof SendMessageInputSchema>,
    context: ToolContext,
    team: any
  ): Promise<SendMessageOutput> {
    const { storage, session, logger } = context;

    // Cannot broadcast structured messages
    if (typeof input.message !== 'string') {
      throw new Error('structured messages cannot be broadcast (use a specific recipient)');
    }

    const recipients = Object.values(team.members)
      .filter((m: any) => m.name !== session.agentName && m.isActive)
      .map((m: any) => m.name);

    if (recipients.length === 0) {
      return {
        success: true,
        message: 'No teammates to broadcast to',
      };
    }

    // Send to each recipient
    for (const recipient of recipients) {
      const message: Message = {
        messageId: randomUUID(),
        fromAgentId: session.agentId,
        toAgentId: recipient,
        messageType: 'broadcast',
        content: input.message,
        summary: input.summary || input.message.substring(0, 50),
        isRead: false,
        isProcessed: false,
        createdAt: new Date().toISOString(),
      };

      await storage.saveMessage(input.team_name, recipient, message);
    }

    logger.info('Broadcast sent', {
      recipients: recipients.length,
      team: input.team_name,
    });

    return {
      success: true,
      message: `Message broadcast to ${recipients.length} teammate(s): ${recipients.join(', ')}`,
      routing: {
        sender: session.agentName,
        target: '@team',
        summary: input.summary || input.message.substring(0, 50),
      },
    };
  }

  private static async handleStructuredMessage(
    input: z.infer<typeof SendMessageInputSchema>,
    context: ToolContext,
    team: any,
    senderName: string,
    senderId: string
  ): Promise<SendMessageOutput> {
    const { storage, logger } = context;
    const structured = input.message as any;

    switch (structured.type) {
      case 'shutdown_request':
        return this.handleShutdownRequest(input, context, team, senderName, senderId);

      case 'shutdown_response':
        return this.handleShutdownResponse(input, context, team, senderName, senderId);

      case 'plan_approval_request':
        return this.handlePlanApprovalRequest(input, context, team, senderName, senderId);

      case 'plan_approval_response':
        return this.handlePlanApprovalResponse(input, context, team, senderName, senderId);

      case 'delegation_request':
        return this.handleDelegationRequest(input, context, team, senderName, senderId);

      case 'delegation_response':
        return this.handleDelegationResponse(input, context, team, senderName, senderId);

      default:
        throw new Error(`Unknown structured message type: ${structured.type}`);
    }
  }

  private static async handleShutdownRequest(
    input: z.infer<typeof SendMessageInputSchema>,
    context: ToolContext,
    team: any,
    senderName: string,
    senderId: string
  ): Promise<SendMessageOutput> {
    const { storage, logger } = context;
    const content = input.message as { type: 'shutdown_request'; reason?: string };

    // Only team lead can request shutdown
    if (!senderId.includes('team-lead')) {
      throw new Error('Only the team lead can request teammate shutdowns');
    }

    const requestId = `shutdown-${input.to}-${Date.now()}`;

    const message: Message = {
      messageId: randomUUID(),
      fromAgentId: senderId,
      toAgentId: input.to,
      messageType: 'shutdown_request',
      content: JSON.stringify({ ...content, requestId }),
      summary: `Shutdown requested${content.reason ? `: ${content.reason}` : ''}`,
      requestId,
      isRead: false,
      isProcessed: false,
      createdAt: new Date().toISOString(),
    };

    await storage.saveMessage(input.team_name, input.to, message);

    logger.info('Shutdown requested', {
      target: input.to,
      from: senderName,
      request_id: requestId,
    });

    return {
      success: true,
      message: `Shutdown request sent to ${input.to}. Request ID: ${requestId}`,
      request_id: requestId,
      routing: {
        sender: senderName,
        target: `@${input.to}`,
        summary: 'Shutdown request',
      },
    };
  }

  private static async handleShutdownResponse(
    input: z.infer<typeof SendMessageInputSchema>,
    context: ToolContext,
    team: any,
    senderName: string,
    senderId: string
  ): Promise<SendMessageOutput> {
    const content = input.message as {
      type: 'shutdown_response';
      request_id: string;
      approve: boolean;
      reason?: string;
    };

    // Must respond to team-lead
    if (input.to !== 'team-lead') {
      throw new Error(`shutdown_response must be sent to "team-lead"`);
    }

    // Validate rejection has reason
    if (!content.approve && (!content.reason || content.reason.trim().length === 0)) {
      throw new Error('reason is required when rejecting a shutdown request');
    }

    const message: Message = {
      messageId: randomUUID(),
      fromAgentId: senderId,
      toAgentId: 'team-lead',
      messageType: 'shutdown_response',
      content: JSON.stringify(content),
      summary: content.approve ? 'Shutdown approved' : `Shutdown rejected: ${content.reason}`,
      requestId: content.request_id,
      responseType: content.approve ? 'approve' : 'reject',
      feedback: content.reason,
      isRead: false,
      isProcessed: false,
      createdAt: new Date().toISOString(),
    };

    await context.storage.saveMessage(input.team_name, 'team-lead', message);

    return {
      success: true,
      message: content.approve
        ? `Shutdown approved. Agent ${senderName} will exit.`
        : `Shutdown rejected. Reason: "${content.reason}". Continuing to work.`,
      request_id: content.request_id,
    };
  }

  private static async handlePlanApprovalRequest(
    input: z.infer<typeof SendMessageInputSchema>,
    context: ToolContext,
    team: any,
    senderName: string,
    senderId: string
  ): Promise<SendMessageOutput> {
    const content = input.message as {
      type: 'plan_approval_request';
      request_id: string;
      plan_content: string;
    };

    if (input.to !== 'team-lead') {
      throw new Error('plan approval requests must be sent to the team lead');
    }

    const message: Message = {
      messageId: randomUUID(),
      fromAgentId: senderId,
      toAgentId: 'team-lead',
      messageType: 'plan_approval_request',
      content: JSON.stringify(content),
      summary: `Plan approval requested by ${senderName}`,
      requestId: content.request_id,
      isRead: false,
      isProcessed: false,
      createdAt: new Date().toISOString(),
    };

    await context.storage.saveMessage(input.team_name, 'team-lead', message);

    return {
      success: true,
      message: `Plan approval request sent to team-lead. Request ID: ${content.request_id}`,
      request_id: content.request_id,
    };
  }

  private static async handlePlanApprovalResponse(
    input: z.infer<typeof SendMessageInputSchema>,
    context: ToolContext,
    team: any,
    senderName: string,
    senderId: string
  ): Promise<SendMessageOutput> {
    const content = input.message as {
      type: 'plan_approval_response';
      request_id: string;
      approve: boolean;
      feedback?: string;
    };

    if (!senderId.includes('team-lead')) {
      throw new Error('Only the team lead can approve plans');
    }

    const message: Message = {
      messageId: randomUUID(),
      fromAgentId: senderId,
      toAgentId: input.to,
      messageType: 'plan_approval_response',
      content: JSON.stringify(content),
      summary: content.approve ? 'Plan approved' : `Plan rejected: ${content.feedback}`,
      requestId: content.request_id,
      responseType: content.approve ? 'approve' : 'reject',
      feedback: content.feedback,
      isRead: false,
      isProcessed: false,
      createdAt: new Date().toISOString(),
    };

    await context.storage.saveMessage(input.team_name, input.to, message);

    return {
      success: true,
      message: content.approve
        ? `Plan approved for ${input.to}. They can proceed with implementation.`
        : `Plan rejected for ${input.to} with feedback: "${content.feedback}"`,
      request_id: content.request_id,
    };
  }

  private static async handleDelegationRequest(
    input: z.infer<typeof SendMessageInputSchema>,
    context: ToolContext,
    team: any,
    senderName: string,
    senderId: string
  ): Promise<SendMessageOutput> {
    const content = input.message as {
      type: 'delegation_request';
      from_team: string;
      task_id: string;
      subject: string;
      description: string;
      artifacts?: string[];
    };

    const delegationId = `delegation-${Date.now()}`;

    const message: Message = {
      messageId: randomUUID(),
      fromAgentId: senderId,
      toAgentId: input.to,
      messageType: 'delegation_request',
      content: JSON.stringify({ ...content, delegationId }),
      summary: `Delegation: ${content.subject}`,
      requestId: delegationId,
      isRead: false,
      isProcessed: false,
      createdAt: new Date().toISOString(),
    };

    await context.storage.saveMessage(input.team_name, input.to, message);

    // Save to delegations registry
    await context.storage.saveDelegation({
      delegationId,
      fromTeam: content.from_team,
      fromAgentId: senderId,
      toTeam: input.team_name,
      toAgentId: input.to,
      taskId: content.task_id,
      subject: content.subject,
      description: content.description,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: `Delegation request sent to ${input.to} in team ${input.team_name}`,
      request_id: delegationId,
    };
  }

  private static async handleDelegationResponse(
    input: z.infer<typeof SendMessageInputSchema>,
    context: ToolContext,
    team: any,
    senderName: string,
    senderId: string
  ): Promise<SendMessageOutput> {
    const content = input.message as {
      type: 'delegation_response';
      delegation_id: string;
      accept: boolean;
      feedback?: string;
    };

    const message: Message = {
      messageId: randomUUID(),
      fromAgentId: senderId,
      toAgentId: input.to,
      messageType: 'delegation_response',
      content: JSON.stringify(content),
      summary: content.accept ? 'Delegation accepted' : `Delegation rejected: ${content.feedback}`,
      requestId: content.delegation_id,
      responseType: content.accept ? 'approve' : 'reject',
      feedback: content.feedback,
      isRead: false,
      isProcessed: false,
      createdAt: new Date().toISOString(),
    };

    await context.storage.saveMessage(input.team_name, input.to, message);

    // Update delegation status
    await context.storage.updateDelegation(content.delegation_id, {
      status: content.accept ? 'accepted' : 'rejected',
      respondedAt: new Date().toISOString(),
      feedback: content.feedback,
    });

    return {
      success: true,
      message: content.accept
        ? `Delegation accepted. You can now work on the delegated task.`
        : `Delegation rejected. Reason: "${content.feedback}"`,
    };
  }
}
