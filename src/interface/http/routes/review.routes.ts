import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ReviewService } from '../../../application/services/review.service';
import { ReviewType, ReviewResult } from '@prisma/client';

const createReviewSchema = z.object({
  reviewType: z.nativeEnum(ReviewType),
  targetWorkItemId: z.string().uuid().optional(),
  targetArtifactId: z.string().uuid().optional(),
  reviewerRoleId: z.string().uuid().optional(),
  reviewerAgentId: z.string().uuid().optional(),
});

const updateReviewSchema = z.object({
  reviewType: z.nativeEnum(ReviewType).optional(),
  reviewerRoleId: z.string().uuid().optional(),
  reviewerAgentId: z.string().uuid().optional(),
});

const submitReviewSchema = z.object({
  result: z.nativeEnum(ReviewResult),
  findings: z.string().min(1),
  mandatoryFixes: z.array(z.string()).optional(),
  optionalNotes: z.string().optional(),
  severity: z.string().optional(),
});

const assignReviewSchema = z.object({
  reviewerRoleId: z.string().uuid().optional(),
  reviewerAgentId: z.string().uuid().optional(),
});

export async function reviewRoutes(server: FastifyInstance) {
  const reviewService = new ReviewService();

  // GET /api/v1/reviews
  server.get('/reviews', async (request) => {
    const {
      reviewType,
      targetWorkItemId,
      targetArtifactId,
      reviewerRoleId,
      reviewerAgentId,
      result,
    } = request.query as {
      reviewType?: ReviewType;
      targetWorkItemId?: string;
      targetArtifactId?: string;
      reviewerRoleId?: string;
      reviewerAgentId?: string;
      result?: ReviewResult;
    };

    const filters = {
      ...(reviewType && { reviewType }),
      ...(targetWorkItemId && { targetWorkItemId }),
      ...(targetArtifactId && { targetArtifactId }),
      ...(reviewerRoleId && { reviewerRoleId }),
      ...(reviewerAgentId && { reviewerAgentId }),
      ...(result && { result }),
    };

    const reviews = await reviewService.findAll(
      Object.keys(filters).length > 0 ? filters : undefined
    );
    return { data: reviews };
  });

  // POST /api/v1/reviews
  server.post('/reviews', async (request, reply) => {
    const data = createReviewSchema.parse(request.body);
    const review = await reviewService.create(data);
    reply.status(201);
    return { data: review };
  });

  // GET /api/v1/reviews/:id
  server.get('/reviews/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const review = await reviewService.findById(id);

    if (!review) {
      reply.status(404);
      throw new Error('Review not found');
    }

    return { data: review };
  });

  // PUT /api/v1/reviews/:id
  server.put('/reviews/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateReviewSchema.parse(request.body);
    const review = await reviewService.update(id, data);
    return { data: review };
  });

  // DELETE /api/v1/reviews/:id
  server.delete('/reviews/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await reviewService.delete(id);
    reply.status(204);
  });

  // POST /api/v1/reviews/:id/submit
  server.post('/reviews/:id/submit', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = submitReviewSchema.parse(request.body);
    const review = await reviewService.submit(id, data);
    return { data: review };
  });

  // POST /api/v1/reviews/:id/assign
  server.post('/reviews/:id/assign', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reviewerRoleId, reviewerAgentId } = assignReviewSchema.parse(request.body);
    const review = await reviewService.assignReview(id, reviewerRoleId, reviewerAgentId);
    return { data: review };
  });

  // GET /api/v1/work-items/:workItemId/reviews/required
  server.get('/work-items/:workItemId/reviews/required', async (request) => {
    const { workItemId } = request.params as { workItemId: string };
    const required = await reviewService.getRequiredReviews(workItemId);
    return { data: required };
  });

  // GET /api/v1/work-items/:workItemId/reviews/status
  server.get('/work-items/:workItemId/reviews/status', async (request) => {
    const { workItemId } = request.params as { workItemId: string };
    const status = await reviewService.getReviewStatus(workItemId);
    return { data: status };
  });

  // GET /api/v1/artifacts/:artifactId/reviews/required
  server.get('/artifacts/:artifactId/reviews/required', async (request) => {
    const { artifactId } = request.params as { artifactId: string };
    const required = await reviewService.getRequiredReviews(undefined, artifactId);
    return { data: required };
  });

  // GET /api/v1/artifacts/:artifactId/reviews/status
  server.get('/artifacts/:artifactId/reviews/status', async (request) => {
    const { artifactId } = request.params as { artifactId: string };
    const status = await reviewService.getReviewStatus(undefined, artifactId);
    return { data: status };
  });

  // GET /api/v1/agents/:agentId/pending-reviews
  server.get('/agents/:agentId/pending-reviews', async (request) => {
    const { agentId } = request.params as { agentId: string };
    const reviews = await reviewService.getPendingReviewsForAgent(agentId);
    return { data: reviews };
  });

  // GET /api/v1/roles/:roleId/pending-reviews
  server.get('/roles/:roleId/pending-reviews', async (request) => {
    const { roleId } = request.params as { roleId: string };
    const reviews = await reviewService.getPendingReviewsForRole(roleId);
    return { data: reviews };
  });

  // GET /api/v1/work-items/:workItemId/reviews/summary
  server.get('/work-items/:workItemId/reviews/summary', async (request) => {
    const { workItemId } = request.params as { workItemId: string };
    const summary = await reviewService.getReviewSummary(workItemId, 'workItem');
    return { data: summary };
  });

  // GET /api/v1/artifacts/:artifactId/reviews/summary
  server.get('/artifacts/:artifactId/reviews/summary', async (request) => {
    const { artifactId } = request.params as { artifactId: string };
    const summary = await reviewService.getReviewSummary(artifactId, 'artifact');
    return { data: summary };
  });

  // GET /api/v1/work-items/:workItemId/reviews/mandatory-fixes
  server.get('/work-items/:workItemId/reviews/mandatory-fixes', async (request) => {
    const { workItemId } = request.params as { workItemId: string };
    const fixes = await reviewService.findMandatoryFixes(workItemId);
    return { data: fixes };
  });

  // GET /api/v1/artifacts/:artifactId/reviews/mandatory-fixes
  server.get('/artifacts/:artifactId/reviews/mandatory-fixes', async (request) => {
    const { artifactId } = request.params as { artifactId: string };
    const fixes = await reviewService.findMandatoryFixes(undefined, artifactId);
    return { data: fixes };
  });
}
