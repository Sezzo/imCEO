import { WorkItemService, CreateWorkItemDTO, UpdateWorkItemDTO, WorkItemFilters } from '../../../src/application/services/work-item.service';
import { prismaMock } from '../../setup';
import { WorkItemState, WorkItemType } from '@prisma/client';
import { vi } from 'vitest';

describe('WorkItemService', () => {
  const service = new WorkItemService();

  const mockWorkItem = {
    workItemId: 'wi-123',
    type: WorkItemType.Task,
    title: 'Test Work Item',
    description: 'Test Description',
    state: WorkItemState.Draft,
    parentWorkItemId: null,
    companyId: 'company-123',
    divisionId: null,
    departmentId: null,
    owningTeamId: null,
    owningRoleId: null,
    assignedAgentId: null,
    priority: 'high',
    severity: 'medium',
    costLimit: 100,
    estimatedEffort: 5,
    dueAt: null,
    startedAt: null,
    completedAt: null,
    actualEffort: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  describe('findAll', () => {
    it('should return all work items without filters', async () => {
      const mockItems = [mockWorkItem, { ...mockWorkItem, workItemId: 'wi-456' }];
      prismaMock.workItem.findMany.mockResolvedValue(mockItems);

      const result = await service.findAll();

      expect(result).toEqual(mockItems);
      expect(prismaMock.workItem.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by state', async () => {
      const filters: WorkItemFilters = { state: 'Draft' };
      prismaMock.workItem.findMany.mockResolvedValue([mockWorkItem]);

      await service.findAll(filters);

      expect(prismaMock.workItem.findMany).toHaveBeenCalledWith({
        where: { state: WorkItemState.Draft },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by type', async () => {
      const filters: WorkItemFilters = { type: 'Task' };
      prismaMock.workItem.findMany.mockResolvedValue([mockWorkItem]);

      await service.findAll(filters);

      expect(prismaMock.workItem.findMany).toHaveBeenCalledWith({
        where: { type: WorkItemType.Task },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by teamId', async () => {
      const filters: WorkItemFilters = { teamId: 'team-123' };
      prismaMock.workItem.findMany.mockResolvedValue([mockWorkItem]);

      await service.findAll(filters);

      expect(prismaMock.workItem.findMany).toHaveBeenCalledWith({
        where: { owningTeamId: 'team-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should combine multiple filters', async () => {
      const filters: WorkItemFilters = { state: 'Draft', type: 'Task', teamId: 'team-123' };
      prismaMock.workItem.findMany.mockResolvedValue([mockWorkItem]);

      await service.findAll(filters);

      expect(prismaMock.workItem.findMany).toHaveBeenCalledWith({
        where: {
          state: WorkItemState.Draft,
          type: WorkItemType.Task,
          owningTeamId: 'team-123',
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('should return a work item by id with related data', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({
        ...mockWorkItem,
        childWorkItems: [],
        artifacts: [],
        agent: null,
        team: null,
      });

      const result = await service.findById('wi-123');

      expect(result).toBeDefined();
      expect(prismaMock.workItem.findUnique).toHaveBeenCalledWith({
        where: { workItemId: 'wi-123' },
        include: {
          childWorkItems: true,
          artifacts: true,
          agent: true,
          team: true,
        },
      });
    });

    it('should return null when work item not found', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    const createDTO: CreateWorkItemDTO = {
      type: WorkItemType.Task,
      title: 'New Work Item',
      description: 'New Description',
    };

    it('should create a work item with valid data', async () => {
      prismaMock.workItem.create.mockResolvedValue(mockWorkItem);

      const result = await service.create(createDTO);

      expect(result).toEqual(mockWorkItem);
      expect(prismaMock.workItem.create).toHaveBeenCalledWith({
        data: {
          type: createDTO.type,
          title: createDTO.title,
          description: createDTO.description,
          parentWorkItemId: undefined,
          companyId: undefined,
          divisionId: undefined,
          departmentId: undefined,
          owningTeamId: undefined,
          owningRoleId: undefined,
          assignedAgentId: undefined,
          priority: undefined,
          severity: undefined,
          costLimit: undefined,
          estimatedEffort: undefined,
          dueAt: undefined,
        },
      });
    });

    it('should create a work item with all optional fields', async () => {
      const fullDTO: CreateWorkItemDTO = {
        ...createDTO,
        parentWorkItemId: 'parent-123',
        companyId: 'company-123',
        divisionId: 'division-123',
        departmentId: 'dept-123',
        owningTeamId: 'team-123',
        owningRoleId: 'role-123',
        assignedAgentId: 'agent-123',
        priority: 'critical',
        severity: 'high',
        costLimit: 500,
        estimatedEffort: 10,
        dueAt: '2024-12-31',
      };
      prismaMock.workItem.create.mockResolvedValue({
        ...mockWorkItem,
        ...fullDTO,
        dueAt: new Date('2024-12-31'),
      });

      await service.create(fullDTO);

      expect(prismaMock.workItem.create).toHaveBeenCalledWith({
        data: {
          type: fullDTO.type,
          title: fullDTO.title,
          description: fullDTO.description,
          parentWorkItemId: fullDTO.parentWorkItemId,
          companyId: fullDTO.companyId,
          divisionId: fullDTO.divisionId,
          departmentId: fullDTO.departmentId,
          owningTeamId: fullDTO.owningTeamId,
          owningRoleId: fullDTO.owningRoleId,
          assignedAgentId: fullDTO.assignedAgentId,
          priority: fullDTO.priority,
          severity: fullDTO.severity,
          costLimit: fullDTO.costLimit,
          estimatedEffort: fullDTO.estimatedEffort,
          dueAt: new Date('2024-12-31'),
        },
      });
    });

    it('should throw error when prisma create fails', async () => {
      prismaMock.workItem.create.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDTO)).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    const updateDTO: UpdateWorkItemDTO = {
      title: 'Updated Work Item',
      description: 'Updated Description',
    };

    it('should update a work item with valid data', async () => {
      prismaMock.workItem.update.mockResolvedValue({ ...mockWorkItem, ...updateDTO });

      const result = await service.update('wi-123', updateDTO);

      expect(result).toEqual({ ...mockWorkItem, ...updateDTO });
      expect(prismaMock.workItem.update).toHaveBeenCalledWith({
        where: { workItemId: 'wi-123' },
        data: {
          type: undefined,
          title: updateDTO.title,
          description: updateDTO.description,
          assignedAgentId: undefined,
          priority: undefined,
          severity: undefined,
          costLimit: undefined,
          estimatedEffort: undefined,
          dueAt: undefined,
        },
      });
    });

    it('should update dueAt with proper date conversion', async () => {
      prismaMock.workItem.update.mockResolvedValue({
        ...mockWorkItem,
        dueAt: new Date('2024-06-15'),
      });

      await service.update('wi-123', { dueAt: '2024-06-15' });

      expect(prismaMock.workItem.update).toHaveBeenCalledWith({
        where: { workItemId: 'wi-123' },
        data: expect.objectContaining({
          dueAt: new Date('2024-06-15'),
        }),
      });
    });

    it('should throw error when updating non-existent work item', async () => {
      prismaMock.workItem.update.mockRejectedValue(new Error('Record not found'));

      await expect(service.update('non-existent-id', updateDTO)).rejects.toThrow('Record not found');
    });
  });

  describe('delete', () => {
    it('should delete a work item successfully', async () => {
      prismaMock.workItem.delete.mockResolvedValue(mockWorkItem);

      await service.delete('wi-123');

      expect(prismaMock.workItem.delete).toHaveBeenCalledWith({
        where: { workItemId: 'wi-123' },
      });
    });

    it('should throw error when deleting non-existent work item', async () => {
      prismaMock.workItem.delete.mockRejectedValue(new Error('Record not found'));

      await expect(service.delete('non-existent-id')).rejects.toThrow('Record not found');
    });
  });

  describe('transition - State Transitions', () => {
    it('should transition from Draft to Proposed', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue(mockWorkItem);
      prismaMock.$transaction.mockImplementation(async (operations: any) => {
        // Handle both array and function forms
        if (Array.isArray(operations)) {
          const results = [];
          for (const op of operations) {
            if (typeof op === 'object' && op !== null) {
              results.push(op);
            }
          }
          return results;
        }
        return operations;
      });
      prismaMock.workItem.update.mockResolvedValue({
        ...mockWorkItem,
        state: WorkItemState.Proposed,
      });

      const result = await service.transition('wi-123', WorkItemState.Proposed, 'Initial proposal', 'user-123', 'user');

      expect(result).toBeDefined();
    });

    it('should transition from Proposed to Approved', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({ ...mockWorkItem, state: WorkItemState.Proposed });
      prismaMock.workItem.update.mockResolvedValue({
        ...mockWorkItem,
        state: WorkItemState.Approved,
      });

      const result = await service.transition('wi-123', WorkItemState.Approved, 'Approved by manager', 'manager-123', 'user');

      expect(result).toBeDefined();
    });

    it('should transition from Ready to InProgress and set startedAt', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({ ...mockWorkItem, state: WorkItemState.Ready });
      prismaMock.workItem.update.mockResolvedValue({
        ...mockWorkItem,
        state: WorkItemState.InProgress,
        startedAt: new Date(),
      });

      await service.transition('wi-123', WorkItemState.InProgress);

      expect(prismaMock.workItem.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          state: WorkItemState.InProgress,
          startedAt: expect.any(Date),
        }),
      }));
    });

    it('should transition to Done and set completedAt', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({ ...mockWorkItem, state: WorkItemState.ApprovedForCompletion });
      prismaMock.workItem.update.mockResolvedValue({
        ...mockWorkItem,
        state: WorkItemState.Done,
        completedAt: new Date(),
      });

      await service.transition('wi-123', WorkItemState.Done);

      expect(prismaMock.workItem.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          state: WorkItemState.Done,
          completedAt: expect.any(Date),
        }),
      }));
    });

    it('should throw error for invalid state transition', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({ ...mockWorkItem, state: WorkItemState.Draft });

      await expect(
        service.transition('wi-123', WorkItemState.Done, 'Trying to skip states')
      ).rejects.toThrow('Invalid state transition from Draft to Done');
    });

    it('should return null when work item not found', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue(null);

      const result = await service.transition('non-existent-id', WorkItemState.Proposed);

      expect(result).toBeNull();
    });

    it('should handle all valid transitions from InProgress', async () => {
      const validTargets = [WorkItemState.WaitingOnDependency, WorkItemState.InReview, WorkItemState.ChangesRequested, WorkItemState.Cancelled];

      for (const targetState of validTargets) {
        prismaMock.workItem.findUnique.mockResolvedValue({ ...mockWorkItem, state: WorkItemState.InProgress });
        prismaMock.$transaction.mockImplementation(async (operations: any) => {
          if (Array.isArray(operations)) {
            return operations;
          }
          return operations;
        });
        prismaMock.workItem.update.mockResolvedValue({
          ...mockWorkItem,
          state: targetState,
        });

        const result = await service.transition('wi-123', targetState);
        expect(result).toBeDefined();
      }
    });

    it('should create history entry during transition', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue(mockWorkItem);
      prismaMock.$transaction.mockImplementation(async (operations: any) => {
        if (Array.isArray(operations)) {
          return operations;
        }
        return operations;
      });
      prismaMock.workItem.update.mockResolvedValue({
        ...mockWorkItem,
        state: WorkItemState.Proposed,
      });

      await service.transition('wi-123', WorkItemState.Proposed, 'Test reason', 'actor-123', 'user');

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('should return work item history', async () => {
      const mockHistory = [
        {
          historyId: 'hist-1',
          workItemId: 'wi-123',
          fromState: WorkItemState.Draft,
          toState: WorkItemState.Proposed,
          reason: 'Initial proposal',
          actorId: 'user-123',
          actorType: 'user',
          createdAt: new Date(),
        },
      ];
      prismaMock.workItemHistory.findMany.mockResolvedValue(mockHistory);

      const result = await service.getHistory('wi-123');

      expect(result).toEqual(mockHistory);
      expect(prismaMock.workItemHistory.findMany).toHaveBeenCalledWith({
        where: { workItemId: 'wi-123' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no history exists', async () => {
      prismaMock.workItemHistory.findMany.mockResolvedValue([]);

      const result = await service.getHistory('wi-123');

      expect(result).toEqual([]);
    });
  });

  describe('getBoard', () => {
    it('should return work items grouped by state', async () => {
      const mockItems = [
        { ...mockWorkItem, state: WorkItemState.InProgress, priority: 'high' },
        { ...mockWorkItem, workItemId: 'wi-2', state: WorkItemState.Done, priority: 'low' },
        { ...mockWorkItem, workItemId: 'wi-3', state: WorkItemState.Draft, priority: 'medium' },
      ];
      prismaMock.workItem.findMany.mockResolvedValue(mockItems);

      const result = await service.getBoard();

      expect(result).toBeDefined();
      expect(result.Draft).toHaveLength(1);
      expect(result.InProgress).toHaveLength(1);
      expect(result.Done).toHaveLength(1);
    });

    it('should return empty columns when no work items exist', async () => {
      prismaMock.workItem.findMany.mockResolvedValue([]);

      const result = await service.getBoard();

      expect(result.Draft).toEqual([]);
      expect(result.InProgress).toEqual([]);
      expect(result.Done).toEqual([]);
    });
  });

  describe('getHierarchyTree', () => {
    it('should return hierarchical tree structure', async () => {
      const mockRootWithChildren = {
        ...mockWorkItem,
        childWorkItems: [
          {
            ...mockWorkItem,
            workItemId: 'child-1',
            childWorkItems: [],
            agent: { agentId: 'agent-123', displayName: 'Test Agent' },
            team: { teamId: 'team-123', name: 'Test Team' },
          },
        ],
        agent: null,
        team: null,
      };
      prismaMock.workItem.findUnique.mockResolvedValue(mockRootWithChildren);

      const result = await service.getHierarchyTree('wi-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('wi-123');
      expect(result.children).toHaveLength(1);
    });

    it('should return null when work item not found', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue(null);

      const result = await service.getHierarchyTree('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getAncestors', () => {
    it('should return all ancestors of a work item', async () => {
      const mockItemWithParent = {
        ...mockWorkItem,
        parentWorkItem: {
          workItemId: 'parent-123',
          type: WorkItemType.Task,
          title: 'Parent Item',
          state: WorkItemState.InProgress,
          agent: null,
          team: { teamId: 'team-123', name: 'Parent Team' },
        },
      };
      prismaMock.workItem.findUnique
        .mockResolvedValueOnce(mockItemWithParent)
        .mockResolvedValueOnce(null);

      const result = await service.getAncestors('wi-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('parent-123');
    });

    it('should return empty array for root item', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({
        ...mockWorkItem,
        parentWorkItem: null,
      });

      const result = await service.getAncestors('wi-123');

      expect(result).toEqual([]);
    });

    it('should prevent infinite loops with visited set', async () => {
      const circularItem = {
        ...mockWorkItem,
        parentWorkItem: {
          workItemId: 'wi-123', // Points back to itself
          parentWorkItem: null,
        },
      };
      prismaMock.workItem.findUnique.mockResolvedValue(circularItem);

      const result = await service.getAncestors('wi-123');

      // Should stop at the first item due to visited set
      expect(result).toEqual([]);
    });
  });

  describe('getDescendants', () => {
    it('should return all descendants of a work item', async () => {
      const mockItemWithDescendants = {
        ...mockWorkItem,
        childWorkItems: [
          {
            ...mockWorkItem,
            workItemId: 'child-1',
            agent: null,
            team: null,
          },
        ],
      };
      prismaMock.workItem.findUnique
        .mockResolvedValueOnce(mockItemWithDescendants)
        .mockResolvedValueOnce({
          ...mockItemWithDescendants,
          workItemId: 'child-1',
          childWorkItems: [],
        });

      const result = await service.getDescendants('wi-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('child-1');
    });

    it('should prevent infinite loops with visited set', async () => {
      const mockItem = {
        ...mockWorkItem,
        childWorkItems: [
          {
            ...mockWorkItem,
            workItemId: 'child-1',
            agent: null,
            team: null,
          },
        ],
      };
      // Second call returns child with circular reference back to parent
      const mockChildWithCircular = {
        ...mockWorkItem,
        workItemId: 'child-1',
        childWorkItems: [
          {
            ...mockWorkItem,
            workItemId: 'wi-123', // Points back to parent
            agent: null,
            team: null,
          },
        ],
      };

      prismaMock.workItem.findUnique
        .mockResolvedValueOnce(mockItem)
        .mockResolvedValueOnce(mockChildWithCircular)
        .mockResolvedValueOnce({
          ...mockWorkItem,
          workItemId: 'wi-123',
          childWorkItems: [],
        });

      const result = await service.getDescendants('wi-123');

      expect(result).toHaveLength(1); // Only child-1, parent is skipped due to visited set
      expect(result[0].id).toBe('child-1');
    });
  });

  describe('getSiblings', () => {
    it('should return sibling work items', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({
        ...mockWorkItem,
        parentWorkItemId: 'parent-123',
      });
      prismaMock.workItem.findMany.mockResolvedValue([
        { ...mockWorkItem, workItemId: 'sibling-1', agent: null, team: null },
      ]);

      const result = await service.getSiblings('wi-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sibling-1');
    });

    it('should return empty array when no parent', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({
        ...mockWorkItem,
        parentWorkItemId: null,
      });

      const result = await service.getSiblings('wi-123');

      expect(result).toEqual([]);
    });
  });

  describe('moveInHierarchy', () => {
    it('should move work item to new parent', async () => {
      prismaMock.workItem.findUnique
        .mockResolvedValueOnce({
          ...mockWorkItem,
          workItemId: 'new-parent-123',
          childWorkItems: [],
        })
        .mockResolvedValueOnce({
          ...mockWorkItem,
          workItemId: 'wi-123',
          childWorkItems: [],
        });
      prismaMock.workItem.update.mockResolvedValue({
        ...mockWorkItem,
        parentWorkItemId: 'new-parent-123',
      });

      await service.moveInHierarchy('wi-123', 'new-parent-123');

      expect(prismaMock.workItem.update).toHaveBeenCalledWith({
        where: { workItemId: 'wi-123' },
        data: { parentWorkItemId: 'new-parent-123' },
      });
    });

    it('should throw error when moving under self', async () => {
      await expect(service.moveInHierarchy('wi-123', 'wi-123')).rejects.toThrow(
        'Cannot move work item under itself'
      );
    });

    it('should throw error when new parent not found', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue(null);

      await expect(service.moveInHierarchy('wi-123', 'non-existent-parent')).rejects.toThrow(
        'New parent work item not found'
      );
    });
  });

  describe('getImpactAnalysis', () => {
    it('should return impact analysis for a work item', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({
        ...mockWorkItem,
        childWorkItems: [
          { workItemId: 'child-1', title: 'Child 1', type: WorkItemType.Task, state: WorkItemState.Done },
        ],
        artifacts: [
          { artifactId: 'art-1', title: 'Artifact 1', type: 'Document', status: 'Final' },
        ],
      });

      const result = await service.getImpactAnalysis('wi-123');

      expect(result).toBeDefined();
      expect(result.workItem.id).toBe('wi-123');
      expect(result.directChildren).toBe(1);
      expect(result.artifacts).toHaveLength(1);
    });

    it('should throw error when work item not found', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue(null);

      await expect(service.getImpactAnalysis('non-existent-id')).rejects.toThrow('Work item not found');
    });
  });

  describe('rollupProgress', () => {
    it('should calculate rollup progress', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({
        ...mockWorkItem,
        childWorkItems: [
          { ...mockWorkItem, workItemId: 'child-1', state: WorkItemState.Done, estimatedEffort: 5, actualEffort: 5 },
          { ...mockWorkItem, workItemId: 'child-2', state: WorkItemState.InProgress, estimatedEffort: 5, actualEffort: 2 },
        ],
      });

      const result = await service.rollupProgress('wi-123');

      expect(result).toBeDefined();
      expect(result.totalItems).toBeGreaterThan(0);
      expect(result.completionPercentage).toBeDefined();
    });

    it('should throw error when work item not found', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue(null);

      await expect(service.rollupProgress('non-existent-id')).rejects.toThrow('Work item not found');
    });
  });

  describe('findOrphans', () => {
    it('should find orphaned work items', async () => {
      prismaMock.workItem.findMany.mockResolvedValue([
        { ...mockWorkItem, agent: null, team: null },
      ]);

      const result = await service.findOrphans('company-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('wi-123');
    });

    it('should exclude Vision and Goal types', async () => {
      prismaMock.workItem.findMany.mockResolvedValue([]);

      await service.findOrphans('company-123');

      expect(prismaMock.workItem.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 'company-123',
          parentWorkItemId: null,
          type: { notIn: ['Vision', 'Goal'] },
        },
        include: {
          agent: true,
          team: true,
        },
      });
    });
  });

  describe('getHierarchyPath', () => {
    it('should return hierarchy path from root to work item', async () => {
      prismaMock.workItem.findUnique
        .mockResolvedValueOnce({
          ...mockWorkItem,
          parentWorkItemId: 'parent-123',
        })
        .mockResolvedValueOnce({
          ...mockWorkItem,
          workItemId: 'parent-123',
          parentWorkItemId: null,
        });

      const result = await service.getHierarchyPath('wi-123');

      expect(result).toEqual(['parent-123', 'wi-123']);
    });

    it('should prevent infinite loops', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({
        ...mockWorkItem,
        parentWorkItemId: 'wi-123', // Circular
      });

      const result = await service.getHierarchyPath('wi-123');

      expect(result).toEqual(['wi-123']);
    });
  });

  describe('bulkUpdateParent', () => {
    it('should bulk update parent for multiple work items', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({ ...mockWorkItem, workItemId: 'new-parent-123' });
      prismaMock.workItem.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkUpdateParent(['wi-1', 'wi-2', 'wi-3'], 'new-parent-123');

      expect(result).toBe(3);
      expect(prismaMock.workItem.updateMany).toHaveBeenCalledWith({
        where: {
          workItemId: { in: ['wi-1', 'wi-2', 'wi-3'] },
        },
        data: {
          parentWorkItemId: 'new-parent-123',
        },
      });
    });

    it('should set parent to null when newParentId is null', async () => {
      prismaMock.workItem.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkUpdateParent(['wi-1', 'wi-2'], null);

      expect(result).toBe(2);
      expect(prismaMock.workItem.updateMany).toHaveBeenCalledWith({
        where: {
          workItemId: { in: ['wi-1', 'wi-2'] },
        },
        data: {
          parentWorkItemId: null,
        },
      });
    });

    it('should throw error when new parent not found', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue(null);

      await expect(service.bulkUpdateParent(['wi-1'], 'non-existent-parent')).rejects.toThrow(
        'New parent work item not found'
      );
    });

    it('should throw error when creating circular dependency', async () => {
      prismaMock.workItem.findUnique.mockResolvedValue({ ...mockWorkItem, workItemId: 'new-parent-123' });

      // Mock getDescendants to return the child as a descendant of new parent
      vi.spyOn(service, 'getDescendants').mockResolvedValueOnce([
        { id: 'wi-1' } as any,
      ]);

      await expect(service.bulkUpdateParent(['wi-1'], 'new-parent-123')).rejects.toThrow(
        'Cannot move wi-1 under its own descendant'
      );
    });
  });
});
