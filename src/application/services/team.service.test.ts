import { TeamService, CreateTeamDTO, UpdateTeamDTO } from './team.service';
import { prismaMock } from '../../test/singleton';

describe('TeamService', () => {
  const service = new TeamService();

  const mockTeam = {
    teamId: 'team-123',
    departmentId: 'dept-123',
    name: 'Test Team',
    description: 'Test Description',
    mission: 'Test Mission',
    teamType: 'Development',
    leadRoleId: null,
    defaultModelProfileId: null,
    defaultSkillBundleId: null,
    defaultMcpBundleId: null,
    allowedInteractions: ['collaboration'],
    companyId: 'company-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  describe('findAll', () => {
    it('should return all teams ordered by createdAt desc', async () => {
      const mockTeams = [mockTeam, { ...mockTeam, teamId: 'team-456' }];
      prismaMock.team.findMany.mockResolvedValue(mockTeams);

      const result = await service.findAll();

      expect(result).toEqual(mockTeams);
      expect(prismaMock.team.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no teams exist', async () => {
      prismaMock.team.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return a team by id with related data', async () => {
      prismaMock.team.findUnique.mockResolvedValue({
        ...mockTeam,
        agentProfiles: [],
      });

      const result = await service.findById('team-123');

      expect(result).toEqual({
        ...mockTeam,
        agentProfiles: [],
      });
      expect(prismaMock.team.findUnique).toHaveBeenCalledWith({
        where: { teamId: 'team-123' },
        include: {
          agentProfiles: true,
        },
      });
    });

    it('should return null when team not found', async () => {
      prismaMock.team.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByDepartmentId', () => {
    it('should return teams for a specific department', async () => {
      const mockTeams = [mockTeam];
      prismaMock.team.findMany.mockResolvedValue(mockTeams);

      const result = await service.findByDepartmentId('dept-123');

      expect(result).toEqual(mockTeams);
      expect(prismaMock.team.findMany).toHaveBeenCalledWith({
        where: { departmentId: 'dept-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when department has no teams', async () => {
      prismaMock.team.findMany.mockResolvedValue([]);

      const result = await service.findByDepartmentId('dept-no-teams');

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const createDTO: CreateTeamDTO = {
      departmentId: 'dept-123',
      name: 'New Team',
      description: 'New Description',
    };

    it('should create a team with valid data', async () => {
      prismaMock.team.create.mockResolvedValue(mockTeam);

      const result = await service.create(createDTO);

      expect(result).toEqual(mockTeam);
      expect(prismaMock.team.create).toHaveBeenCalledWith({
        data: {
          departmentId: createDTO.departmentId,
          name: createDTO.name,
          description: createDTO.description,
          mission: undefined,
          teamType: undefined,
          leadRoleId: undefined,
          defaultModelProfileId: undefined,
          defaultSkillBundleId: undefined,
          defaultMcpBundleId: undefined,
          allowedInteractions: [],
        },
      });
    });

    it('should create a team with all optional fields', async () => {
      const fullDTO: CreateTeamDTO = {
        ...createDTO,
        mission: 'New Mission',
        teamType: 'Operations',
        leadRoleId: 'role-123',
        defaultModelProfileId: 'model-123',
        defaultSkillBundleId: 'skill-123',
        defaultMcpBundleId: 'mcp-123',
        allowedInteractions: ['interaction1', 'interaction2'],
      };
      prismaMock.team.create.mockResolvedValue({
        ...mockTeam,
        ...fullDTO,
      });

      await service.create(fullDTO);

      expect(prismaMock.team.create).toHaveBeenCalledWith({
        data: {
          departmentId: fullDTO.departmentId,
          name: fullDTO.name,
          description: fullDTO.description,
          mission: fullDTO.mission,
          teamType: fullDTO.teamType,
          leadRoleId: fullDTO.leadRoleId,
          defaultModelProfileId: fullDTO.defaultModelProfileId,
          defaultSkillBundleId: fullDTO.defaultSkillBundleId,
          defaultMcpBundleId: fullDTO.defaultMcpBundleId,
          allowedInteractions: fullDTO.allowedInteractions,
        },
      });
    });

    it('should throw error when prisma create fails', async () => {
      prismaMock.team.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDTO)).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    const updateDTO: UpdateTeamDTO = {
      name: 'Updated Team',
      description: 'Updated Description',
    };

    it('should update a team with valid data', async () => {
      prismaMock.team.update.mockResolvedValue({ ...mockTeam, ...updateDTO });

      const result = await service.update('team-123', updateDTO);

      expect(result).toEqual({ ...mockTeam, ...updateDTO });
      expect(prismaMock.team.update).toHaveBeenCalledWith({
        where: { teamId: 'team-123' },
        data: {
          name: updateDTO.name,
          description: updateDTO.description,
          mission: undefined,
          teamType: undefined,
          leadRoleId: undefined,
          defaultModelProfileId: undefined,
          defaultSkillBundleId: undefined,
          defaultMcpBundleId: undefined,
          allowedInteractions: undefined,
        },
      });
    });

    it('should update team with all fields', async () => {
      const fullUpdateDTO: UpdateTeamDTO = {
        name: 'Updated',
        mission: 'Updated Mission',
        teamType: 'Support',
        leadRoleId: 'new-lead-123',
        defaultModelProfileId: 'new-model-123',
        allowedInteractions: ['updated-interaction'],
      };
      prismaMock.team.update.mockResolvedValue({
        ...mockTeam,
        ...fullUpdateDTO,
      });

      await service.update('team-123', fullUpdateDTO);

      expect(prismaMock.team.update).toHaveBeenCalledWith({
        where: { teamId: 'team-123' },
        data: {
          name: fullUpdateDTO.name,
          description: undefined,
          mission: fullUpdateDTO.mission,
          teamType: fullUpdateDTO.teamType,
          leadRoleId: fullUpdateDTO.leadRoleId,
          defaultModelProfileId: fullUpdateDTO.defaultModelProfileId,
          defaultSkillBundleId: undefined,
          defaultMcpBundleId: undefined,
          allowedInteractions: fullUpdateDTO.allowedInteractions,
        },
      });
    });

    it('should throw error when updating non-existent team', async () => {
      prismaMock.team.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.update('non-existent-id', updateDTO)).rejects.toThrow('Record not found');
    });
  });

  describe('delete', () => {
    it('should delete a team successfully', async () => {
      prismaMock.team.delete.mockResolvedValue(mockTeam);

      await service.delete('team-123');

      expect(prismaMock.team.delete).toHaveBeenCalledWith({
        where: { teamId: 'team-123' },
      });
    });

    it('should throw error when deleting non-existent team', async () => {
      prismaMock.team.delete.mockRejectedValue(new Error('Record not found'));

      await expect(service.delete('non-existent-id')).rejects.toThrow('Record not found');
    });
  });
});
