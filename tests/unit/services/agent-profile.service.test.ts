import { AgentProfileService, CreateAgentProfileDTO, UpdateAgentProfileDTO } from '../../../src/application/services/agent-profile.service';
import { prismaMock } from '../setup';

describe('AgentProfileService', () => {
  const service = new AgentProfileService();

  const mockAgentProfile = {
    agentId: 'agent-123',
    teamId: 'team-123',
    roleTemplateId: null,
    displayName: 'Test Agent',
    internalName: 'test_agent',
    seniority: 'Senior',
    customPromptOverride: 'Custom Prompt',
    maxParallelTasks: 5,
    maxContextBudget: 1000,
    maxCostPerTask: 50,
    status: 'active',
    companyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  describe('findAll', () => {
    it('should return all agent profiles ordered by createdAt desc', async () => {
      const mockProfiles = [mockAgentProfile, { ...mockAgentProfile, agentId: 'agent-456' }];
      prismaMock.agentProfile.findMany.mockResolvedValue(mockProfiles);

      const result = await service.findAll();

      expect(result).toEqual(mockProfiles);
      expect(prismaMock.agentProfile.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no agent profiles exist', async () => {
      prismaMock.agentProfile.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return an agent profile by id with related data', async () => {
      prismaMock.agentProfile.findUnique.mockResolvedValue({
        ...mockAgentProfile,
        team: { teamId: 'team-123', name: 'Team Name' },
        roleTemplate: null,
      });

      const result = await service.findById('agent-123');

      expect(result).toEqual({
        ...mockAgentProfile,
        team: { teamId: 'team-123', name: 'Team Name' },
        roleTemplate: null,
      });
      expect(prismaMock.agentProfile.findUnique).toHaveBeenCalledWith({
        where: { agentId: 'agent-123' },
        include: {
          team: true,
          roleTemplate: true,
        },
      });
    });

    it('should return null when agent profile not found', async () => {
      prismaMock.agentProfile.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByTeamId', () => {
    it('should return agent profiles for a specific team', async () => {
      const mockProfiles = [mockAgentProfile];
      prismaMock.agentProfile.findMany.mockResolvedValue(mockProfiles);

      const result = await service.findByTeamId('team-123');

      expect(result).toEqual(mockProfiles);
      expect(prismaMock.agentProfile.findMany).toHaveBeenCalledWith({
        where: { teamId: 'team-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when team has no agent profiles', async () => {
      prismaMock.agentProfile.findMany.mockResolvedValue([]);

      const result = await service.findByTeamId('team-no-agents');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const createDTO: CreateAgentProfileDTO = {
      teamId: 'team-123',
      displayName: 'New Agent',
      internalName: 'new_agent',
    };

    it('should create an agent profile with valid data', async () => {
      prismaMock.agentProfile.create.mockResolvedValue(mockAgentProfile);

      const result = await service.create(createDTO);

      expect(result).toEqual(mockAgentProfile);
      expect(prismaMock.agentProfile.create).toHaveBeenCalledWith({
        data: {
          teamId: createDTO.teamId,
          roleTemplateId: undefined,
          displayName: createDTO.displayName,
          internalName: createDTO.internalName,
          seniority: undefined,
          customPromptOverride: undefined,
          maxParallelTasks: 1,
          maxContextBudget: undefined,
          maxCostPerTask: undefined,
        },
      });
    });

    it('should create an agent profile with all optional fields', async () => {
      const fullDTO: CreateAgentProfileDTO = {
        ...createDTO,
        roleTemplateId: 'role-123',
        seniority: 'Junior',
        customPromptOverride: 'Override Prompt',
        maxParallelTasks: 10,
        maxContextBudget: 2000,
        maxCostPerTask: 100,
      };
      prismaMock.agentProfile.create.mockResolvedValue({
        ...mockAgentProfile,
        ...fullDTO,
      });

      await service.create(fullDTO);

      expect(prismaMock.agentProfile.create).toHaveBeenCalledWith({
        data: {
          teamId: fullDTO.teamId,
          roleTemplateId: fullDTO.roleTemplateId,
          displayName: fullDTO.displayName,
          internalName: fullDTO.internalName,
          seniority: fullDTO.seniority,
          customPromptOverride: fullDTO.customPromptOverride,
          maxParallelTasks: fullDTO.maxParallelTasks,
          maxContextBudget: fullDTO.maxContextBudget,
          maxCostPerTask: fullDTO.maxCostPerTask,
        },
      });
    });

    it('should use default maxParallelTasks when not provided', async () => {
      const dtoWithoutMaxTasks: CreateAgentProfileDTO = {
        teamId: 'team-123',
        displayName: 'Agent',
        internalName: 'agent',
      };
      prismaMock.agentProfile.create.mockResolvedValue({
        ...mockAgentProfile,
        maxParallelTasks: 1,
      });

      await service.create(dtoWithoutMaxTasks);

      expect(prismaMock.agentProfile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          maxParallelTasks: 1,
        }),
      });
    });

    it('should throw error when prisma create fails', async () => {
      prismaMock.agentProfile.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDTO)).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    const updateDTO: UpdateAgentProfileDTO = {
      displayName: 'Updated Agent',
      seniority: 'Lead',
    };

    it('should update an agent profile with valid data', async () => {
      prismaMock.agentProfile.update.mockResolvedValue({ ...mockAgentProfile, ...updateDTO });

      const result = await service.update('agent-123', updateDTO);

      expect(result).toEqual({ ...mockAgentProfile, ...updateDTO });
      expect(prismaMock.agentProfile.update).toHaveBeenCalledWith({
        where: { agentId: 'agent-123' },
        data: {
          roleTemplateId: undefined,
          displayName: updateDTO.displayName,
          internalName: undefined,
          seniority: updateDTO.seniority,
          customPromptOverride: undefined,
          maxParallelTasks: undefined,
          maxContextBudget: undefined,
          maxCostPerTask: undefined,
        },
      });
    });

    it('should update agent profile with all fields', async () => {
      const fullUpdateDTO: UpdateAgentProfileDTO = {
        roleTemplateId: 'new-role-123',
        displayName: 'Updated',
        internalName: 'updated_agent',
        seniority: 'Expert',
        customPromptOverride: 'New Override',
        maxParallelTasks: 15,
        maxContextBudget: 5000,
        maxCostPerTask: 200,
      };
      prismaMock.agentProfile.update.mockResolvedValue({
        ...mockAgentProfile,
        ...fullUpdateDTO,
      });

      await service.update('agent-123', fullUpdateDTO);

      expect(prismaMock.agentProfile.update).toHaveBeenCalledWith({
        where: { agentId: 'agent-123' },
        data: {
          roleTemplateId: fullUpdateDTO.roleTemplateId,
          displayName: fullUpdateDTO.displayName,
          internalName: fullUpdateDTO.internalName,
          seniority: fullUpdateDTO.seniority,
          customPromptOverride: fullUpdateDTO.customPromptOverride,
          maxParallelTasks: fullUpdateDTO.maxParallelTasks,
          maxContextBudget: fullUpdateDTO.maxContextBudget,
          maxCostPerTask: fullUpdateDTO.maxCostPerTask,
        },
      });
    });

    it('should throw error when updating non-existent agent profile', async () => {
      prismaMock.agentProfile.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.update('non-existent-id', updateDTO)).rejects.toThrow('Record not found');
    });
  });

  describe('delete', () => {
    it('should delete an agent profile successfully', async () => {
      prismaMock.agentProfile.delete.mockResolvedValue(mockAgentProfile);

      await service.delete('agent-123');

      expect(prismaMock.agentProfile.delete).toHaveBeenCalledWith({
        where: { agentId: 'agent-123' },
      });
    });

    it('should throw error when deleting non-existent agent profile', async () => {
      prismaMock.agentProfile.delete.mockRejectedValue(new Error('Record not found'));

      await expect(service.delete('non-existent-id')).rejects.toThrow('Record not found');
    });
  });

  describe('activate', () => {
    it('should activate an agent profile', async () => {
      prismaMock.agentProfile.update.mockResolvedValue({
        ...mockAgentProfile,
        status: 'active',
      });

      const result = await service.activate('agent-123');

      expect(result.status).toBe('active');
      expect(prismaMock.agentProfile.update).toHaveBeenCalledWith({
        where: { agentId: 'agent-123' },
        data: { status: 'active' },
      });
    });

    it('should throw error when activating non-existent agent profile', async () => {
      prismaMock.agentProfile.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.activate('non-existent-id')).rejects.toThrow('Record not found');
    });
  });

  describe('deactivate', () => {
    it('should deactivate an agent profile', async () => {
      prismaMock.agentProfile.update.mockResolvedValue({
        ...mockAgentProfile,
        status: 'inactive',
      });

      const result = await service.deactivate('agent-123');

      expect(result.status).toBe('inactive');
      expect(prismaMock.agentProfile.update).toHaveBeenCalledWith({
        where: { agentId: 'agent-123' },
        data: { status: 'inactive' },
      });
    });

    it('should throw error when deactivating non-existent agent profile', async () => {
      prismaMock.agentProfile.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.deactivate('non-existent-id')).rejects.toThrow('Record not found');
    });
  });
});
