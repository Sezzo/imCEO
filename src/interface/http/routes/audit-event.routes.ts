import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuditEventService } from '../../../application/services/audit-event.service';
import { AuditEventType, AuditSeverity } from '@prisma/client';

const createAuditEventSchema = z.object({
  eventType: z.nativeEnum(AuditEventType),
  actorRoleId: z.string().uuid().optional(),
  actorAgentId: z.string().uuid().optional(),
  targetType: z.string().min(1),
  targetId: z.string().uuid(),
  description: z.string().optional(),
  payload: z.record(z.any()).optional(),
  severity: z.nativeEnum(AuditSeverity),
});

const auditEventFiltersSchema = z.object({
  eventType: z.nativeEnum(AuditEventType).optional(),
  actorRoleId: z.string().uuid().optional(),
  actorAgentId: z.string().uuid().optional(),
  targetType: z.string().optional(),
  targetId: z.string().uuid().optional(),
  severity: z.nativeEnum(AuditSeverity).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const searchSchema = z.object({
  query: z.string().min(1),
  eventType: z.nativeEnum(AuditEventType).optional(),
  severity: z.nativeEnum(AuditSeverity).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

export async function auditEventRoutes(server: FastifyInstance) {
  const auditEventService = new AuditEventService();

  // GET /api/v1/audit-events
  server.get('/audit-events', async (request) => {
    const query = auditEventFiltersSchema.parse(request.query);
    const { limit, offset } = request.query as { limit?: string; offset?: string };

    const filters = {
      ...(query.eventType && { eventType: query.eventType }),
      ...(query.actorRoleId && { actorRoleId: query.actorRoleId }),
      ...(query.actorAgentId && { actorAgentId: query.actorAgentId }),
      ...(query.targetType && { targetType: query.targetType }),
      ...(query.targetId && { targetId: query.targetId }),
      ...(query.severity && { severity: query.severity }),
      ...(query.fromDate && { fromDate: new Date(query.fromDate) }),
      ...(query.toDate && { toDate: new Date(query.toDate) }),
    };

    const [events, total] = await Promise.all([
      auditEventService.findAll(
        Object.keys(filters).length > 0 ? filters : undefined,
        limit ? parseInt(limit, 10) : 100,
        offset ? parseInt(offset, 10) : 0
      ),
      auditEventService.count(Object.keys(filters).length > 0 ? filters : undefined),
    ]);

    return { data: events, meta: { total, limit: limit ? parseInt(limit, 10) : 100, offset: offset ? parseInt(offset, 10) : 0 } };
  });

  // POST /api/v1/audit-events
  server.post('/audit-events', async (request, reply) => {
    const data = createAuditEventSchema.parse(request.body);
    const event = await auditEventService.create(data);
    reply.status(201);
    return { data: event };
  });

  // GET /api/v1/audit-events/:id
  server.get('/audit-events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await auditEventService.findById(id);

    if (!event) {
      reply.status(404);
      throw new Error('Audit event not found');
    }

    return { data: event };
  });

  // GET /api/v1/audit-events/by-target/:targetType/:targetId
  server.get('/audit-events/by-target/:targetType/:targetId', async (request) => {
    const { targetType, targetId } = request.params as { targetType: string; targetId: string };
    const { limit } = request.query as { limit?: string };

    const events = await auditEventService.getByTarget(
      targetType,
      targetId,
      limit ? parseInt(limit, 10) : 100
    );
    return { data: events };
  });

  // GET /api/v1/audit-events/by-actor
  server.get('/audit-events/by-actor', async (request) => {
    const { actorRoleId, actorAgentId, limit } = request.query as {
      actorRoleId?: string;
      actorAgentId?: string;
      limit?: string;
    };

    if (!actorRoleId && !actorAgentId) {
      throw new Error('Either actorRoleId or actorAgentId must be specified');
    }

    const events = await auditEventService.getByActor(
      actorRoleId,
      actorAgentId,
      limit ? parseInt(limit, 10) : 100
    );
    return { data: events };
  });

  // GET /api/v1/audit-events/by-date-range
  server.get('/audit-events/by-date-range', async (request) => {
    const query = dateRangeSchema.parse(request.query);
    const { limit } = request.query as { limit?: string };

    const dateRange = {
      ...(query.from && { from: new Date(query.from) }),
      ...(query.to && { to: new Date(query.to) }),
    };

    const events = await auditEventService.getByDateRange(
      dateRange,
      limit ? parseInt(limit, 10) : 100
    );
    return { data: events };
  });

  // GET /api/v1/audit-events/summary
  server.get('/audit-events/summary', async (request) => {
    const query = dateRangeSchema.parse(request.query);

    const dateRange = {
      ...(query.from && { from: new Date(query.from) }),
      ...(query.to && { to: new Date(query.to) }),
    };

    const summary = await auditEventService.getSummary(
      Object.keys(dateRange).length > 0 ? dateRange : undefined
    );
    return { data: summary };
  });

  // GET /api/v1/audit-events/trends
  server.get('/audit-events/trends', async (request) => {
    const query = dateRangeSchema.parse(request.query);
    const { granularity } = request.query as { granularity?: 'hour' | 'day' | 'week' | 'month' };

    const dateRange = {
      ...(query.from && { from: new Date(query.from) }),
      ...(query.to && { to: new Date(query.to) }),
    };

    if (!dateRange.from || !dateRange.to) {
      throw new Error('Both from and to dates are required for trends');
    }

    const trends = await auditEventService.getTrends(
      dateRange,
      granularity || 'day'
    );
    return { data: trends };
  });

  // GET /api/v1/audit-events/critical
  server.get('/audit-events/critical', async (request) => {
    const { since, limit } = request.query as { since?: string; limit?: string };

    const events = await auditEventService.getCriticalEvents(
      since ? new Date(since) : undefined,
      limit ? parseInt(limit, 10) : 50
    );
    return { data: events };
  });

  // POST /api/v1/audit-events/search
  server.post('/audit-events/search', async (request) => {
    const body = searchSchema.parse(request.body);
    const { limit } = request.query as { limit?: string };

    const filters = {
      ...(body.eventType && { eventType: body.eventType }),
      ...(body.severity && { severity: body.severity }),
      ...(body.fromDate && { fromDate: new Date(body.fromDate) }),
      ...(body.toDate && { toDate: new Date(body.toDate) }),
    };

    const events = await auditEventService.search(
      body.query,
      Object.keys(filters).length > 0 ? filters : undefined,
      limit ? parseInt(limit, 10) : 50
    );
    return { data: events };
  });

  // DELETE /api/v1/audit-events/old - Cleanup endpoint (admin only in production)
  server.delete('/audit-events/old', async (request, reply) => {
    const { olderThan } = request.query as { olderThan?: string };

    if (!olderThan) {
      throw new Error('olderThan date is required');
    }

    const deletedCount = await auditEventService.deleteOldEvents(new Date(olderThan));
    return { data: { deletedCount } };
  });
}
