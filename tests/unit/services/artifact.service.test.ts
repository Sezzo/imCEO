import { ArtifactService, CreateArtifactDTO, UpdateArtifactDTO, ArtifactFilters } from '../../../src/application/services/artifact.service';
import { prismaMock } from '../../setup';

describe('ArtifactService', () => {
  const service = new ArtifactService();

  const mockArtifact = {
    artifactId: 'artifact-123',
    type: 'TechnicalSpec',
    title: 'Test Artifact',
    description: 'Test Description',
    content: 'Test Content',
    version: '1.0.0',
    ownerTeamId: 'team-123',
    ownerAgentId: 'agent-123',
    sourceWorkItemId: 'workitem-123',
    status: 'Draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  describe('findAll', () => {
    it('should return all artifacts without filters', async () => {
      const mockArtifacts = [mockArtifact, { ...mockArtifact, artifactId: 'artifact-456' }];
      prismaMock.artifact.findMany.mockResolvedValue(mockArtifacts);

      const result = await service.findAll();

      expect(result).toEqual(mockArtifacts);
      expect(prismaMock.artifact.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by type', async () => {
      const filters: ArtifactFilters = { type: 'Document' };
      prismaMock.artifact.findMany.mockResolvedValue([mockArtifact]);

      await service.findAll(filters);

      expect(prismaMock.artifact.findMany).toHaveBeenCalledWith({
        where: {
          type: 'TechnicalSpec',
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by status', async () => {
      const filters: ArtifactFilters = { status: 'Draft' };
      prismaMock.artifact.findMany.mockResolvedValue([mockArtifact]);

      await service.findAll(filters);

      expect(prismaMock.artifact.findMany).toHaveBeenCalledWith({
        where: {
          status: 'Draft',
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by workItemId', async () => {
      const filters: ArtifactFilters = { workItemId: 'workitem-123' };
      prismaMock.artifact.findMany.mockResolvedValue([mockArtifact]);

      await service.findAll(filters);

      expect(prismaMock.artifact.findMany).toHaveBeenCalledWith({
        where: {
          sourceWorkItemId: 'workitem-123',
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should combine multiple filters', async () => {
      const filters: ArtifactFilters = {
        type: 'Document',
        status: 'Draft',
        workItemId: 'workitem-123',
      };
      prismaMock.artifact.findMany.mockResolvedValue([mockArtifact]);

      await service.findAll(filters);

      expect(prismaMock.artifact.findMany).toHaveBeenCalledWith({
        where: {
          type: 'TechnicalSpec',
          status: 'Draft',
          sourceWorkItemId: 'workitem-123',
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no artifacts exist', async () => {
      prismaMock.artifact.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return an artifact by id with related data', async () => {
      prismaMock.artifact.findUnique.mockResolvedValue({
        ...mockArtifact,
        reviews: [],
        workItem: null,
      });

      const result = await service.findById('artifact-123');

      expect(result).toEqual({
        ...mockArtifact,
        reviews: [],
        workItem: null,
      });
      expect(prismaMock.artifact.findUnique).toHaveBeenCalledWith({
        where: { artifactId: 'artifact-123' },
        include: {
          reviews: true,
          workItem: true,
        },
      });
    });

    it('should return null when artifact not found', async () => {
      prismaMock.artifact.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    const createDTO: CreateArtifactDTO = {
      type: 'TechnicalSpec',
      title: 'New Artifact',
      description: 'New Description',
    };

    it('should create an artifact with valid data', async () => {
      prismaMock.artifact.create.mockResolvedValue(mockArtifact);

      const result = await service.create(createDTO);

      expect(result).toEqual(mockArtifact);
      expect(prismaMock.artifact.create).toHaveBeenCalledWith({
        data: {
          type: createDTO.type,
          title: createDTO.title,
          description: createDTO.description,
          content: undefined,
          ownerTeamId: undefined,
          ownerAgentId: undefined,
          sourceWorkItemId: undefined,
        },
      });
    });

    it('should create an artifact with all optional fields', async () => {
      const fullDTO: CreateArtifactDTO = {
        ...createDTO,
        content: 'Full Content',
        ownerTeamId: 'team-456',
        ownerAgentId: 'agent-456',
        sourceWorkItemId: 'workitem-456',
      };
      prismaMock.artifact.create.mockResolvedValue({
        ...mockArtifact,
        ...fullDTO,
      });

      await service.create(fullDTO);

      expect(prismaMock.artifact.create).toHaveBeenCalledWith({
        data: {
          type: fullDTO.type,
          title: fullDTO.title,
          description: fullDTO.description,
          content: fullDTO.content,
          ownerTeamId: fullDTO.ownerTeamId,
          ownerAgentId: fullDTO.ownerAgentId,
          sourceWorkItemId: fullDTO.sourceWorkItemId,
        },
      });
    });

    it('should throw error when prisma create fails', async () => {
      prismaMock.artifact.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDTO)).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    const updateDTO: UpdateArtifactDTO = {
      title: 'Updated Artifact',
      description: 'Updated Description',
    };

    it('should update an artifact without changing version when content not changed', async () => {
      prismaMock.artifact.findUnique.mockResolvedValue(mockArtifact);
      prismaMock.artifact.update.mockResolvedValue({
        ...mockArtifact,
        ...updateDTO,
      });

      const result = await service.update('artifact-123', updateDTO);

      expect(result).toEqual({ ...mockArtifact, ...updateDTO });
      expect(prismaMock.artifact.update).toHaveBeenCalledWith({
        where: { artifactId: 'artifact-123' },
        data: {
          type: undefined,
          title: updateDTO.title,
          description: updateDTO.description,
          content: undefined,
          version: undefined,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should increment version when content is changed', async () => {
      prismaMock.artifact.findUnique.mockResolvedValue(mockArtifact);
      prismaMock.artifact.update.mockResolvedValue({
        ...mockArtifact,
        content: 'New Content',
        version: '1.0.1',
      });

      await service.update('artifact-123', { content: 'New Content' });

      expect(prismaMock.artifact.update).toHaveBeenCalledWith({
        where: { artifactId: 'artifact-123' },
        data: {
          type: undefined,
          title: undefined,
          description: undefined,
          content: 'New Content',
          version: '1.0.1',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should return null when artifact not found', async () => {
      prismaMock.artifact.findUnique.mockResolvedValue(null);

      const result = await service.update('non-existent-id', updateDTO);

      expect(result).toBeNull();
    });

    it('should throw error when prisma update fails', async () => {
      prismaMock.artifact.findUnique.mockResolvedValue(mockArtifact);
      prismaMock.artifact.update.mockRejectedValue(new Error('Database error'));

      await expect(service.update('artifact-123', updateDTO)).rejects.toThrow('Database error');
    });
  });

  describe('delete', () => {
    it('should delete an artifact successfully', async () => {
      prismaMock.artifact.delete.mockResolvedValue(mockArtifact);

      await service.delete('artifact-123');

      expect(prismaMock.artifact.delete).toHaveBeenCalledWith({
        where: { artifactId: 'artifact-123' },
      });
    });

    it('should throw error when deleting non-existent artifact', async () => {
      prismaMock.artifact.delete.mockRejectedValue(new Error('Record not found'));

      await expect(service.delete('non-existent-id')).rejects.toThrow('Record not found');
    });
  });

  describe('createVersion', () => {
    it('should create new version with incremented patch number', async () => {
      prismaMock.artifact.findUnique.mockResolvedValue({ ...mockArtifact, version: '1.0.5' });
      prismaMock.artifact.update.mockResolvedValue({
        ...mockArtifact,
        content: 'New Version Content',
        version: '1.0.6',
      });

      const result = await service.createVersion('artifact-123', 'New Version Content');

      expect(result.version).toBe('1.0.6');
      expect(prismaMock.artifact.update).toHaveBeenCalledWith({
        where: { artifactId: 'artifact-123' },
        data: {
          content: 'New Version Content',
          version: '1.0.6',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw error when artifact not found', async () => {
      prismaMock.artifact.findUnique.mockResolvedValue(null);

      await expect(service.createVersion('non-existent-id', 'Content')).rejects.toThrow('Artifact not found');
    });

    it('should handle different version formats', async () => {
      prismaMock.artifact.findUnique.mockResolvedValue({ ...mockArtifact, version: '2.1.9' });
      prismaMock.artifact.update.mockResolvedValue({
        ...mockArtifact,
        version: '2.1.10',
      });

      const result = await service.createVersion('artifact-123', 'Content');

      expect(result.version).toBe('2.1.10');
    });
  });

  describe('getVersions', () => {
    it('should return current version information', async () => {
      prismaMock.artifact.findUnique.mockResolvedValue(mockArtifact);

      const result = await service.getVersions('artifact-123');

      expect(result).toEqual([
        {
          version: mockArtifact.version,
          createdAt: mockArtifact.updatedAt,
        },
      ]);
    });

    it('should throw error when artifact not found', async () => {
      prismaMock.artifact.findUnique.mockResolvedValue(null);

      await expect(service.getVersions('non-existent-id')).rejects.toThrow('Artifact not found');
    });
  });
});
