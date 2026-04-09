import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { Decimal } from '@prisma/client/runtime/library';

const serviceLogger = logger.child({ component: 'ModelProfileService' });

export interface CreateModelProfileDTO {
  companyId: string;
  name: string;
  modelVariant: string;
  description?: string;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities?: Record<string, any>;
  inputCostPer1k: number;
  outputCostPer1k: number;
  cachingEnabled?: boolean;
  cachingCostPer1k?: number;
  batchingEnabled?: boolean;
  batchingDiscount?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateModelProfileDTO extends Partial<CreateModelProfileDTO> {}

export interface ModelProfileFilters {
  companyId?: string;
  isActive?: boolean;
  isDefault?: boolean;
  modelVariant?: string;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: Decimal;
  cachingDiscount?: Decimal;
  batchingDiscount?: Decimal;
  finalCost: Decimal;
}

export class ModelProfileService {
  async findAll(filters?: ModelProfileFilters) {
    serviceLogger.debug({ filters }, 'Finding all model profiles');
    return prisma.modelProfile.findMany({
      where: {
        ...(filters?.companyId && { companyId: filters.companyId }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.isDefault !== undefined && { isDefault: filters.isDefault }),
        ...(filters?.modelVariant && { modelVariant: filters.modelVariant }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ modelProfileId: id }, 'Finding model profile by id');
    return prisma.modelProfile.findUnique({
      where: { modelProfileId: id },
    });
  }

  async findDefaultForCompany(companyId: string) {
    serviceLogger.debug({ companyId }, 'Finding default model profile for company');
    return prisma.modelProfile.findFirst({
      where: {
        companyId,
        isDefault: true,
        isActive: true,
      },
    });
  }

  async create(data: CreateModelProfileDTO) {
    serviceLogger.info({ name: data.name, modelVariant: data.modelVariant }, 'Creating model profile');

    // If this is set as default, unset any existing default
    if (data.isDefault) {
      await prisma.modelProfile.updateMany({
        where: {
          companyId: data.companyId,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    return prisma.modelProfile.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        modelVariant: data.modelVariant,
        description: data.description,
        contextWindow: data.contextWindow,
        maxOutputTokens: data.maxOutputTokens,
        capabilities: data.capabilities ?? {},
        inputCostPer1k: data.inputCostPer1k,
        outputCostPer1k: data.outputCostPer1k,
        cachingEnabled: data.cachingEnabled ?? false,
        cachingCostPer1k: data.cachingCostPer1k,
        batchingEnabled: data.batchingEnabled ?? false,
        batchingDiscount: data.batchingDiscount,
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(id: string, data: UpdateModelProfileDTO) {
    serviceLogger.info({ modelProfileId: id }, 'Updating model profile');

    const existing = await prisma.modelProfile.findUnique({
      where: { modelProfileId: id },
    });

    if (!existing) {
      throw new Error('Model profile not found');
    }

    // If setting as default, unset existing default
    if (data.isDefault && !existing.isDefault) {
      await prisma.modelProfile.updateMany({
        where: {
          companyId: existing.companyId,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    return prisma.modelProfile.update({
      where: { modelProfileId: id },
      data: {
        name: data.name,
        modelVariant: data.modelVariant,
        description: data.description,
        contextWindow: data.contextWindow,
        maxOutputTokens: data.maxOutputTokens,
        capabilities: data.capabilities,
        inputCostPer1k: data.inputCostPer1k,
        outputCostPer1k: data.outputCostPer1k,
        cachingEnabled: data.cachingEnabled,
        cachingCostPer1k: data.cachingCostPer1k,
        batchingEnabled: data.batchingEnabled,
        batchingDiscount: data.batchingDiscount,
        isDefault: data.isDefault,
        isActive: data.isActive,
      },
    });
  }

  async delete(id: string) {
    serviceLogger.info({ modelProfileId: id }, 'Deleting model profile');
    await prisma.modelProfile.delete({
      where: { modelProfileId: id },
    });
  }

  async estimateCost(
    modelProfileId: string,
    inputTokens: number,
    outputTokens: number,
    useCaching: boolean = false,
    useBatching: boolean = false
  ): Promise<CostEstimate> {
    serviceLogger.debug({ modelProfileId, inputTokens, outputTokens }, 'Estimating cost');

    const profile = await prisma.modelProfile.findUnique({
      where: { modelProfileId },
    });

    if (!profile) {
      throw new Error('Model profile not found');
    }

    // Calculate base cost (per 1k tokens)
    const inputCost = (inputTokens / 1000) * Number(profile.inputCostPer1k);
    const outputCost = (outputTokens / 1000) * Number(profile.outputCostPer1k);
    let estimatedCost = new Decimal(inputCost + outputCost);

    let cachingDiscount = new Decimal(0);
    let batchingDiscount = new Decimal(0);

    // Apply caching discount if enabled
    if (useCaching && profile.cachingEnabled && profile.cachingCostPer1k) {
      const cachedInputCost = (inputTokens / 1000) * Number(profile.cachingCostPer1k);
      cachingDiscount = estimatedCost.sub(new Decimal(cachedInputCost + outputCost));
      estimatedCost = new Decimal(cachedInputCost + outputCost);
    }

    // Apply batching discount if enabled
    if (useBatching && profile.batchingEnabled && profile.batchingDiscount) {
      batchingDiscount = estimatedCost.mul(Number(profile.batchingDiscount));
      estimatedCost = estimatedCost.sub(batchingDiscount);
    }

    return {
      inputTokens,
      outputTokens,
      estimatedCost,
      cachingDiscount: cachingDiscount.gt(0) ? cachingDiscount : undefined,
      batchingDiscount: batchingDiscount.gt(0) ? batchingDiscount : undefined,
      finalCost: estimatedCost,
    };
  }

  async getCapabilities(id: string): Promise<Record<string, any> | null> {
    serviceLogger.debug({ modelProfileId: id }, 'Getting model capabilities');
    const profile = await prisma.modelProfile.findUnique({
      where: { modelProfileId: id },
      select: { capabilities: true },
    });

    return profile?.capabilities as Record<string, any> | null;
  }

  async compareProfiles(profileIds: string[]): Promise<Record<string, any>[]> {
    serviceLogger.debug({ profileIds }, 'Comparing model profiles');

    const profiles = await prisma.modelProfile.findMany({
      where: {
        modelProfileId: { in: profileIds },
      },
    });

    return profiles.map((p) => ({
      id: p.modelProfileId,
      name: p.name,
      modelVariant: p.modelVariant,
      contextWindow: p.contextWindow,
      maxOutputTokens: p.maxOutputTokens,
      inputCostPer1k: p.inputCostPer1k,
      outputCostPer1k: p.outputCostPer1k,
      capabilities: p.capabilities,
      cachingEnabled: p.cachingEnabled,
      batchingEnabled: p.batchingEnabled,
    }));
  }

  async setDefault(id: string): Promise<void> {
    serviceLogger.info({ modelProfileId: id }, 'Setting model profile as default');

    const profile = await prisma.modelProfile.findUnique({
      where: { modelProfileId: id },
    });

    if (!profile) {
      throw new Error('Model profile not found');
    }

    // Unset existing default
    await prisma.modelProfile.updateMany({
      where: {
        companyId: profile.companyId,
        isDefault: true,
      },
      data: { isDefault: false },
    });

    // Set new default
    await prisma.modelProfile.update({
      where: { modelProfileId: id },
      data: { isDefault: true, isActive: true },
    });
  }
}
