import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApprovalRequestService } from '../../../application/services/approval-request.service';
import { ApprovalRequestState } from '@prisma/client';

const createApprovalRequestSchema = z.object({
  targetType: z.string().min(1),
  targetId: z.string().uuid(),
  reason: z.string().optional(),
  requestedByRoleId: z.string().uuid(),
  requestedByAgentId: z.string().uuid().optional(),
  requiredApproverRoleIds: z.array(z.string().uuid()).optional(),
  expiresAt: z.string().datetime().optional(),
});

const approveSchema = z.object({
  approvedByRoleId: z.string().uuid().optional(),
  approvedByAgentId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const rejectSchema = z.object({
  rejectedByRoleId: z.string().uuid().optional(),
  rejectedByAgentId: z.string().uuid().optional(),
  reason: z.string(),
});

const escalateSchema = z.object({
  reason: z.string().optional(),
});

const cancelSchema = z.object({
  reason: z.string().optional(),
});

const delegateSchema = z.object({
  fromRoleId: z.string().uuid(),
  toRoleId: z.string().uuid(),
});

const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function approvalRequestRoutes(server: FastifyInstance) {
  const approvalRequestService = new ApprovalRequestService();

  // GET /api/v1/approval-requests
  server.get('/approval-requests', async (request) => {
    const {
      targetType,
      targetId,
      requestedByRoleId,
      requestedByAgentId,
      state,
    } = request.query as {
      targetType?: string;
      targetId?: string;
      requestedByRoleId?: string;
      requestedByAgentId?: string;
      state?: ApprovalRequestState;
    };

    const filters = {
      ...(targetType && { targetType }),
      ...(targetId && { targetId }),
      ...(requestedByRoleId && { requestedByRoleId }),
      ...(requestedByAgentId && { requestedByAgentId }),
      ...(state && { state }),
    };

    const requests = await approvalRequestService.findAll(
      Object.keys(filters).length > 0 ? filters : undefined
    );
    return { data: requests };
  });

  // POST /api/v1/approval-requests
  server.post('/approval-requests', async (request, reply) => {
    const data = createApprovalRequestSchema.parse(request.body);
    const approvalRequest = await approvalRequestService.create(data);
    reply.status(201);
    return { data: approvalRequest };
  });

  // GET /api/v1/approval-requests/:id
  server.get('/approval-requests/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const approvalRequest = await approvalRequestService.findById(id);

    if (!approvalRequest) {
      reply.status(404);
      throw new Error('Approval request not found');
    }

    return { data: approvalRequest };
  });

  // POST /api/v1/approval-requests/:id/approve
  server.post('/approval-requests/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = approveSchema.parse(request.body);
    const approvalRequest = await approvalRequestService.approve(id, data);
    return { data: approvalRequest };
  });

  // POST /api/v1/approval-requests/:id/reject
  server.post('/approval-requests/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = rejectSchema.parse(request.body);
    const approvalRequest = await approvalRequestService.reject(id, data);
    return { data: approvalRequest };
  });

  // POST /api/v1/approval-requests/:id/escalate
  server.post('/approval-requests/:id/escalate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = escalateSchema.parse(request.body);
    const approvalRequest = await approvalRequestService.escalate(id, reason);
    return { data: approvalRequest };
  });

  // POST /api/v1/approval-requests/:id/cancel
  server.post('/approval-requests/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = cancelSchema.parse(request.body);
    await approvalRequestService.cancel(id, reason);
    reply.status(204);
  });

  // POST /api/v1/approval-requests/check-expiration
  server.post('/approval-requests/check-expiration', async (request, reply) => {
    const expiredCount = await approvalRequestService.checkExpiration();
    return { data: { expiredCount } };
  });

  // GET /api/v1/approval-requests/pending-for-approver
  server.get('/approval-requests/pending-for-approver', async (request) => {
    const { roleId, agentId } = request.query as {
      roleId?: string;
      agentId?: string;
    };

    if (!roleId && !agentId) {
      throw new Error('Either roleId or agentId must be specified');
    }

    const requests = await approvalRequestService.getPendingForApprover(roleId, agentId);
    return { data: requests };
  });

  // GET /api/v1/roles/:roleId/approval-requests
  server.get('/roles/:roleId/approval-requests', async (request) => {
    const { roleId } = request.params as { roleId: string };
    const requests = await approvalRequestService.getRequestsByRequester(roleId);
    return { data: requests };
  });

  // GET /api/v1/agents/:agentId/approval-requests
  server.get('/agents/:agentId/approval-requests', async (request) => {
    const { agentId } = request.params as { agentId: string };
    const requests = await approvalRequestService.getRequestsByRequester(undefined, agentId);
    return { data: requests };
  });

  // GET /api/v1/targets/:targetType/:targetId/approval-status
  server.get('/targets/:targetType/:targetId/approval-status', async (request) => {
    const { targetType, targetId } = request.params as { targetType: string; targetId: string };
    const status = await approvalRequestService.getStatus(targetType, targetId);
    return { data: status };
  });

  // POST /api/v1/approval-requests/:id/delegate
  server.post('/approval-requests/:id/delegate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { fromRoleId, toRoleId } = delegateSchema.parse(request.body);
    const approvalRequest = await approvalRequestService.delegateApproval(id, fromRoleId, toRoleId);
    return { data: approvalRequest };
  });

  // GET /api/v1/approval-requests/:id/chain
  server.get('/approval-requests/:id/chain', async (request) => {
    const { id } = request.params as { id: string };
    const chain = await approvalRequestService.getApprovalChain(id);
    return { data: chain };
  });

  // POST /api/v1/approval-requests/summary
  server.post('/approval-requests/summary', async (request) => {
    const body = dateRangeSchema.parse(request.body);

    const dateRange = {
      ...(body.from && { from: new Date(body.from) }),
      ...(body.to && { to: new Date(body.to) }),
    };

    const summary = await approvalRequestService.getSummary(
      Object.keys(dateRange).length > 0 ? dateRange : undefined
    );
    return { data: summary };
  });
}
