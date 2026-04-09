import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { EscalationTrigger, EscalationState } from '@prisma/client';

const serviceLogger = logger.child({ component: 'EscalationChainService' });

export interface CreateEscalationChainDTO {
  companyId: string;
  name: string;
  description?: string;
  triggerType: EscalationTrigger;
  triggerCondition: string;
  level1RoleId: string;
  level2RoleId?: string;
  level3RoleId?: string;
  autoEscalateTime?: number;
  notifyOnTrigger?: boolean;
}

export interface UpdateEscalationChainDTO extends Partial<CreateEscalationChainDTO> {}

export interface EscalationChainFilters {
  companyId?: string;
  triggerType?: EscalationTrigger;
  state?: EscalationState;
}

export interface TriggerEscalationDTO {
  targetType: string;
  targetId: string;
  triggerReason: string;
  triggeredBy?: string;
}

export interface EscalateLevelDTO {
  escalationEventId: string;
  resolution?: string;
}

export class EscalationChainService {
  async findAll(filters?: EscalationChainFilters) {
    serviceLogger.debug({ filters }, 'Finding all escalation chains');
    return prisma.escalationChain.findMany({
      where: {
        ...(filters?.companyId && { companyId: filters.companyId }),
        ...(filters?.triggerType && { triggerType: filters.triggerType }),
        ...(filters?.state && { state: filters.state }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ escalationChainId: id }, 'Finding escalation chain by id');
    return prisma.escalationChain.findUnique({
      where: { escalationChainId: id },
      include: {
        escalationEvents: {
          where: { resolvedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async create(data: CreateEscalationChainDTO) {
    serviceLogger.info({
      name: data.name,
      triggerType: data.triggerType,
    }, 'Creating escalation chain');

    return prisma.escalationChain.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        description: data.description,
        triggerType: data.triggerType,
        triggerCondition: data.triggerCondition,
        level1RoleId: data.level1RoleId,
        level2RoleId: data.level2RoleId,
        level3RoleId: data.level3RoleId,
        autoEscalateTime: data.autoEscalateTime,
        notifyOnTrigger: data.notifyOnTrigger ?? true,
        state: 'active',
      },
    });
  }

  async update(id: string, data: UpdateEscalationChainDTO) {
    serviceLogger.info({ escalationChainId: id }, 'Updating escalation chain');

    return prisma.escalationChain.update({
      where: { escalationChainId: id },
      data: {
        name: data.name,
        description: data.description,
        triggerType: data.triggerType,
        triggerCondition: data.triggerCondition,
        level1RoleId: data.level1RoleId,
        level2RoleId: data.level2RoleId,
        level3RoleId: data.level3RoleId,
        autoEscalateTime: data.autoEscalateTime,
        notifyOnTrigger: data.notifyOnTrigger,
        state: data.state,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ escalationChainId: id }, 'Deleting escalation chain');
    await prisma.escalationChain.delete({
      where: { escalationChainId: id },
    });
  }

  async activate(id: string) {
    serviceLogger.info({ escalationChainId: id }, 'Activating escalation chain');
    return prisma.escalationChain.update({
      where: { escalationChainId: id },
      data: { state: 'active' },
    });
  }

  async deactivate(id: string) {
    serviceLogger.info({ escalationChainId: id }, 'Deactivating escalation chain');
    return prisma.escalationChain.update({
      where: { escalationChainId: id },
      data: { state: 'cancelled' },
    });
  }

  async trigger(id: string, data: TriggerEscalationDTO) {
    serviceLogger.info({
      escalationChainId: id,
      targetType: data.targetType,
      targetId: data.targetId,
    }, 'Triggering escalation');

    const chain = await prisma.escalationChain.findUnique({
      where: { escalationChainId: id },
    });

    if (!chain) {
      throw new Error('Escalation chain not found');
    }

    if (chain.state !== 'active') {
      throw new Error('Escalation chain is not active');
    }

    // Update chain state to triggered
    await prisma.escalationChain.update({
      where: { escalationChainId: id },
      data: { state: 'triggered' },
    });

    // Create escalation event at level 1
    const event = await prisma.escalationEvent.create({
      data: {
        escalationChainId: id,
        targetType: data.targetType,
        targetId: data.targetId,
        triggeredBy: data.triggeredBy,
        triggerReason: data.triggerReason,
        currentLevel: 1,
        escalatedToRoleId: chain.level1RoleId,
      },
    });

    // TODO: Send notification if notifyOnTrigger is enabled
    if (chain.notifyOnTrigger) {
      serviceLogger.info({ escalationEventId: event.escalationEventId }, 'Notification would be sent');
    }

    return event;
  }

  async escalateLevel(data: EscalateLevelDTO) {
    serviceLogger.info({ escalationEventId: data.escalationEventId }, 'Escalating to next level');

    const event = await prisma.escalationEvent.findUnique({
      where: { escalationEventId: data.escalationEventId },
      include: { escalationChain: true },
    });

    if (!event) {
      throw new Error('Escalation event not found');
    }

    if (event.resolvedAt) {
      throw new Error('Escalation event is already resolved');
    }

    const chain = event.escalationChain;
    const nextLevel = event.currentLevel + 1;

    // Determine who to escalate to based on level
    let nextRoleId: string | undefined;
    switch (nextLevel) {
      case 2:
        nextRoleId = chain.level2RoleId || undefined;
        break;
      case 3:
        nextRoleId = chain.level3RoleId || undefined;
        break;
      default:
        nextRoleId = undefined;
    }

    if (!nextRoleId) {
      throw new Error('No higher escalation level available');
    }

    // Update the escalation event
    const updated = await prisma.escalationEvent.update({
      where: { escalationEventId: data.escalationEventId },
      data: {
        currentLevel: nextLevel,
        escalatedToRoleId: nextRoleId,
      },
    });

    return updated;
  }

  async resolve(id: string, resolution: string) {
    serviceLogger.info({ escalationEventId: id }, 'Resolving escalation');

    const event = await prisma.escalationEvent.update({
      where: { escalationEventId: id },
      data: {
        resolvedAt: new Date(),
        resolution,
      },
    });

    // Reset chain state back to active if all events are resolved
    const pendingEvents = await prisma.escalationEvent.count({
      where: {
        escalationChainId: event.escalationChainId,
        resolvedAt: null,
      },
    });

    if (pendingEvents === 0) {
      await prisma.escalationChain.update({
        where: { escalationChainId: event.escalationChainId },
        data: { state: 'active' },
      });
    }

    return event;
  }

  async getEvents(escalationChainId: string, onlyActive: boolean = false) {
    serviceLogger.debug({ escalationChainId, onlyActive }, 'Getting escalation events');

    return prisma.escalationEvent.findMany({
      where: {
        escalationChainId,
        ...(onlyActive && { resolvedAt: null }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async evaluateCondition(
    chainId: string,
    context: Record<string, any>
  ): Promise<{ shouldTrigger: boolean; reason?: string }> {
    serviceLogger.debug({ chainId, context }, 'Evaluating escalation condition');

    const chain = await prisma.escalationChain.findUnique({
      where: { escalationChainId: chainId },
    });

    if (!chain) {
      throw new Error('Escalation chain not found');
    }

    // Parse and evaluate the trigger condition
    // Format examples:
    // - "cost > 100"
    // - "time > 3600"
    // - "failures >= 3"
    // - "blocked == true"
    const condition = chain.triggerCondition;

    try {
      const match = condition.match(/(\w+)\s*(>|>=|<|<=|=|==)\s*(.+)/);
      if (!match) {
        return { shouldTrigger: false, reason: 'Invalid condition format' };
      }

      const [, field, operator, value] = match;
      const contextValue = context[field];
      const compareValue = isNaN(Number(value)) ? value : Number(value);

      if (contextValue === undefined) {
        return { shouldTrigger: false, reason: `Field ${field} not found in context` };
      }

      let result = false;
      switch (operator) {
        case '>':
          result = contextValue > compareValue;
          break;
        case '>=':
          result = contextValue >= compareValue;
          break;
        case '<':
          result = contextValue < compareValue;
          break;
        case '<=':
          result = contextValue <= compareValue;
          break;
        case '=':
        case '==':
          result = contextValue === compareValue;
          break;
        default:
          return { shouldTrigger: false, reason: 'Unknown operator' };
      }

      return {
        shouldTrigger: result,
        reason: result ? `Condition met: ${field} ${operator} ${value}` : `Condition not met: ${field} is ${contextValue}`,
      };
    } catch (error) {
      serviceLogger.error({ condition, error }, 'Failed to evaluate condition');
      return { shouldTrigger: false, reason: 'Error evaluating condition' };
    }
  }

  async autoEscalateCheck(chainId: string): Promise<void> {
    serviceLogger.debug({ chainId }, 'Checking auto-escalation');

    const chain = await prisma.escalationChain.findUnique({
      where: { escalationChainId: chainId },
      include: {
        escalationEvents: {
          where: { resolvedAt: null },
        },
      },
    });

    if (!chain || !chain.autoEscalateTime || chain.state !== 'triggered') {
      return;
    }

    const now = new Date();

    for (const event of chain.escalationEvents) {
      const timeElapsed = (now.getTime() - event.createdAt.getTime()) / 1000; // in seconds

      if (timeElapsed > chain.autoEscalateTime) {
        try {
          await this.escalateLevel({
            escalationEventId: event.escalationEventId,
            resolution: `Auto-escalated after ${chain.autoEscalateTime} seconds`,
          });
          serviceLogger.info({
            escalationEventId: event.escalationEventId,
          }, 'Auto-escalated event');
        } catch (error) {
          serviceLogger.warn({
            escalationEventId: event.escalationEventId,
            error,
          }, 'Failed to auto-escalate event');
        }
      }
    }
  }

  async getActiveEscalations(companyId: string) {
    serviceLogger.debug({ companyId }, 'Getting active escalations');

    const chains = await prisma.escalationChain.findMany({
      where: {
        companyId,
        state: 'triggered',
      },
      include: {
        escalationEvents: {
          where: { resolvedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return chains.flatMap((chain) =>
      chain.escalationEvents.map((event) => ({
        chainId: chain.escalationChainId,
        chainName: chain.name,
        eventId: event.escalationEventId,
        targetType: event.targetType,
        targetId: event.targetId,
        currentLevel: event.currentLevel,
        escalatedToRoleId: event.escalatedToRoleId,
        triggerReason: event.triggerReason,
        createdAt: event.createdAt,
      }))
    );
  }
}
