import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ArtifactService } from '../../../application/services/artifact.service';
import { ArtifactType, ArtifactStatus } from '@prisma/client';

const createArtifactSchema = z.object({
  type: z.nativeEnum(ArtifactType),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  content: z.string().optional(),
  ownerTeamId: z.string().uuid().optional(),
  ownerAgentId: z.string().uuid().optional(),
  sourceWorkItemId: z.string().uuid().optional(),
});

const updateArtifactSchema = createArtifactSchema.partial();

export async function artifactRoutes(server: FastifyInstance) {
  const artifactService = new ArtifactService();

  server.get('/artifacts', async (request) => {
    const { type, status, workItemId } = request.query as { type?: string; status?: string; workItemId?: string };
    const artifacts = await artifactService.findAll({ type, status, workItemId });
    return { data: artifacts };
  });

  server.post('/artifacts', async (request, reply) => {
    const data = createArtifactSchema.parse(request.body);
    const artifact = await artifactService.create(data);
    reply.status(201);
    return { data: artifact };
  });

  server.get('/artifacts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const artifact = await artifactService.findById(id);
    if (!artifact) {
      reply.status(404);
      throw new Error('Artifact not found');
    }
    return { data: artifact };
  });

  server.put('/artifacts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = updateArtifactSchema.parse(request.body);
    const artifact = await artifactService.update(id, data);
    if (!artifact) {
      reply.status(404);
      throw new Error('Artifact not found');
    }
    return { data: artifact };
  });

  server.delete('/artifacts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await artifactService.delete(id);
    reply.status(204);
  });

  server.post('/artifacts/:id/versions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { content } = z.object({ content: z.string() }).parse(request.body);
    const artifact = await artifactService.createVersion(id, content);
    return { data: artifact };
  });

  server.get('/artifacts/:id/versions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const versions = await artifactService.getVersions(id);
    return { data: versions };
  });
}
