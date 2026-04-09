import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ReportingLineService } from '../../../application/services/reporting-line.service';
import { ReportingLineType } from '@prisma/client';

const createReportingLineSchema = z.object({
  companyId: z.string().uuid(),
  reporterRoleId: z.string().uuid().optional(),
  reporterAgentId: z.string().uuid().optional(),
  reportsToRoleId: z.string().uuid().optional(),
  reportsToAgentId: z.string().uuid().optional(),
  reportingLineType: z.nativeEnum(ReportingLineType),
  isPrimary: z.boolean().optional(),
  scope: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const updateReportingLineSchema = createReportingLineSchema.partial().omit({ companyId: true });

export async function reportingLineRoutes(server: FastifyInstance) {
  const reportingLineService = new ReportingLineService();

  // GET /api/v1/reporting-lines
  server.get('/reporting-lines', async (request) => {
    const {
      companyId,
      reporterRoleId,
      reporterAgentId,
      reportsToRoleId,
      reportsToAgentId,
      reportingLineType,
    } = request.query as {
      companyId?: string;
      reporterRoleId?: string;
      reporterAgentId?: string;
      reportsToRoleId?: string;
      reportsToAgentId?: string;
      reportingLineType?: ReportingLineType;
    };

    const filters = {
      ...(companyId && { companyId }),
      ...(reporterRoleId && { reporterRoleId }),
      ...(reporterAgentId && { reporterAgentId }),
      ...(reportsToRoleId && { reportsToRoleId }),
      ...(reportsToAgentId && { reportsToAgentId }),
      ...(reportingLineType && { reportingLineType }),
    };

    const lines = await reportingLineService.findAll(
      Object.keys(filters).length > 0 ? filters : undefined
    );
    return { data: lines };
  });

  // POST /api/v1/reporting-lines
  server.post('/reporting-lines', async (request, reply) => {
    const data = createReportingLineSchema.parse(request.body);
    const line = await reportingLineService.create(data);
    reply.status(201);
    return { data: line };
  });

  // GET /api/v1/reporting-lines/:id
  server.get('/reporting-lines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const line = await reportingLineService.findById(id);

    if (!line) {
      reply.status(404);
      throw new Error('Reporting line not found');
    }

    return { data: line };
  });

  // PUT /api/v1/reporting-lines/:id
  server.put('/reporting-lines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateReportingLineSchema.parse(request.body);
    const line = await reportingLineService.update(id, data);
    return { data: line };
  });

  // DELETE /api/v1/reporting-lines/:id
  server.delete('/reporting-lines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await reportingLineService.delete(id);
    reply.status(204);
  });

  // GET /api/v1/reporting-lines/chain
  server.get('/reporting-lines/chain', async (request) => {
    const { companyId, roleId, agentId, maxDepth } = request.query as {
      companyId: string;
      roleId?: string;
      agentId?: string;
      maxDepth?: string;
    };

    if (!roleId && !agentId) {
      throw new Error('Either roleId or agentId must be specified');
    }

    const chain = await reportingLineService.getReportingChain(
      companyId,
      roleId,
      agentId,
      maxDepth ? parseInt(maxDepth, 10) : 5
    );

    return { data: chain };
  });

  // GET /api/v1/reporting-lines/direct-reports
  server.get('/reporting-lines/direct-reports', async (request) => {
    const { companyId, roleId, agentId } = request.query as {
      companyId: string;
      roleId?: string;
      agentId?: string;
    };

    if (!roleId && !agentId) {
      throw new Error('Either roleId or agentId must be specified');
    }

    const reports = await reportingLineService.getDirectReports(companyId, roleId, agentId);
    return { data: reports };
  });

  // GET /api/v1/reporting-lines/all-reports
  server.get('/reporting-lines/all-reports', async (request) => {
    const { companyId, roleId, agentId, maxDepth } = request.query as {
      companyId: string;
      roleId?: string;
      agentId?: string;
      maxDepth?: string;
    };

    if (!roleId && !agentId) {
      throw new Error('Either roleId or agentId must be specified');
    }

    const reports = await reportingLineService.getAllReports(
      companyId,
      roleId,
      agentId,
      maxDepth ? parseInt(maxDepth, 10) : 5
    );
    return { data: reports };
  });

  // GET /api/v1/reporting-lines/skip-level-reports
  server.get('/reporting-lines/skip-level-reports', async (request) => {
    const { companyId, roleId, agentId, skipLevels } = request.query as {
      companyId: string;
      roleId?: string;
      agentId?: string;
      skipLevels?: string;
    };

    if (!roleId && !agentId) {
      throw new Error('Either roleId or agentId must be specified');
    }

    const reports = await reportingLineService.getSkipLevelReports(
      companyId,
      roleId,
      agentId,
      skipLevels ? parseInt(skipLevels, 10) : 1
    );
    return { data: reports };
  });

  // GET /api/v1/reporting-lines/matrix-reports
  server.get('/reporting-lines/matrix-reports', async (request) => {
    const { companyId, roleId, agentId } = request.query as {
      companyId: string;
      roleId?: string;
      agentId?: string;
    };

    if (!roleId && !agentId) {
      throw new Error('Either roleId or agentId must be specified');
    }

    const reports = await reportingLineService.getMatrixReports(companyId, roleId, agentId);
    return { data: reports };
  });

  // GET /api/v1/companies/:companyId/org-tree
  server.get('/companies/:companyId/org-tree', async (request) => {
    const { companyId } = request.params as { companyId: string };
    const tree = await reportingLineService.getOrganizationTree(companyId);
    return { data: tree };
  });

  // POST /api/v1/reporting-lines/:id/set-primary
  server.post('/reporting-lines/:id/set-primary', async (request, reply) => {
    const { id } = request.params as { id: string };
    await reportingLineService.setPrimaryReportingLine(id);
    reply.status(204);
  });
}
