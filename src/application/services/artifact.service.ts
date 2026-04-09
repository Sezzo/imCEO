import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { ArtifactType, ArtifactStatus } from '@prisma/client';

const serviceLogger = logger.child({ component: 'ArtifactService' });

export interface CreateArtifactDTO {
  type: ArtifactType;
  title: string;
  description?: string;
  content?: string;
  ownerTeamId?: string;
  ownerAgentId?: string;
  sourceWorkItemId?: string;
}

export interface UpdateArtifactDTO extends Partial<CreateArtifactDTO> {}

export interface ArtifactFilters {
  type?: string;
  status?: string;
  workItemId?: string;
}

export class ArtifactService {
  async findAll(filters?: ArtifactFilters) {
    serviceLogger.debug({ filters }, 'Finding all artifacts');
    return prisma.artifact.findMany({
      where: {
        ...(filters?.type && { type: filters.type as ArtifactType }),
        ...(filters?.status && { status: filters.status as ArtifactStatus }),
        ...(filters?.workItemId && { sourceWorkItemId: filters.workItemId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ artifactId: id }, 'Finding artifact by id');
    return prisma.artifact.findUnique({
      where: { artifactId: id },
      include: {
        reviews: true,
        workItem: true,
      },
    });
  }

  async create(data: CreateArtifactDTO) {
    serviceLogger.info({ title: data.title, type: data.type }, 'Creating artifact');
    return prisma.artifact.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        content: data.content,
        ownerTeamId: data.ownerTeamId,
        ownerAgentId: data.ownerAgentId,
        sourceWorkItemId: data.sourceWorkItemId,
      },
    });
  }

  async update(id: string, data: UpdateArtifactDTO) {
    serviceLogger.info({ artifactId: id }, 'Updating artifact');

    const current = await prisma.artifact.findUnique({
      where: { artifactId: id },
    });

    if (!current) {
      return null;
    }

    // Increment version if content changed
    const newVersion = data.content && data.content !== current.content
      ? this.incrementVersion(current.version)
      : undefined;

    return prisma.artifact.update({
      where: { artifactId: id },
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        content: data.content,
        version: newVersion,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ artifactId: id }, 'Deleting artifact');
    await prisma.artifact.delete({
      where: { artifactId: id },
    });
  }

  async createVersion(id: string, content: string) {
    serviceLogger.info({ artifactId: id }, 'Creating artifact version');
    const current = await prisma.artifact.findUnique({
      where: { artifactId: id },
    });

    if (!current) {
      throw new Error('Artifact not found');
    }

    const newVersion = this.incrementVersion(current.version);

    return prisma.artifact.update({
      where: { artifactId: id },
      data: {
        content,
        version: newVersion,
        updatedAt: new Date(),
      },
    });
  }

  async getVersions(id: string) {
    serviceLogger.debug({ artifactId: id }, 'Getting artifact versions');
    // This would typically query a versions table
    // For now, return placeholder
    const artifact = await prisma.artifact.findUnique({
      where: { artifactId: id },
    });

    if (!artifact) {
      throw new Error('Artifact not found');
    }

    return [
      {
        version: artifact.version,
        createdAt: artifact.updatedAt,
      },
    ];
  }

  private incrementVersion(currentVersion: string): string {
    const parts = currentVersion.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1; // Increment patch
    return parts.join('.');
  }
}
