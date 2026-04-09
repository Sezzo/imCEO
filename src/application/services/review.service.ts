import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { ReviewType, ReviewResult } from '@prisma/client';

const serviceLogger = logger.child({ component: 'ReviewService' });

export interface CreateReviewDTO {
  reviewType: ReviewType;
  targetWorkItemId?: string;
  targetArtifactId?: string;
  reviewerRoleId?: string;
  reviewerAgentId?: string;
}

export interface UpdateReviewDTO {
  reviewType?: ReviewType;
  reviewerRoleId?: string;
  reviewerAgentId?: string;
}

export interface SubmitReviewDTO {
  result: ReviewResult;
  findings: string;
  mandatoryFixes?: string[];
  optionalNotes?: string;
  severity?: string;
}

export interface ReviewFilters {
  reviewType?: ReviewType;
  targetWorkItemId?: string;
  targetArtifactId?: string;
  reviewerRoleId?: string;
  reviewerAgentId?: string;
  result?: ReviewResult;
}

export interface ReviewRequirement {
  reviewType: ReviewType;
  required: boolean;
  minimumReviewers?: number;
}

export interface ReviewSummary {
  totalReviews: number;
  byType: Record<string, number>;
  byResult: Record<string, number>;
  approved: number;
  rejected: number;
  pending: number;
}

export class ReviewService {
  async findAll(filters?: ReviewFilters) {
    serviceLogger.debug({ filters }, 'Finding all reviews');

    return prisma.review.findMany({
      where: {
        ...(filters?.reviewType && { reviewType: filters.reviewType }),
        ...(filters?.targetWorkItemId && { targetWorkItemId: filters.targetWorkItemId }),
        ...(filters?.targetArtifactId && { targetArtifactId: filters.targetArtifactId }),
        ...(filters?.reviewerRoleId && { reviewerRoleId: filters.reviewerRoleId }),
        ...(filters?.reviewerAgentId && { reviewerAgentId: filters.reviewerAgentId }),
        ...(filters?.result && { result: filters.result }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    serviceLogger.debug({ reviewId: id }, 'Finding review by id');
    return prisma.review.findUnique({
      where: { reviewId: id },
    });
  }

  async create(data: CreateReviewDTO) {
    serviceLogger.info({
      reviewType: data.reviewType,
      targetWorkItemId: data.targetWorkItemId,
      targetArtifactId: data.targetArtifactId,
    }, 'Creating review');

    // Validate that at least one target is specified
    if (!data.targetWorkItemId && !data.targetArtifactId) {
      throw new Error('Either targetWorkItemId or targetArtifactId must be specified');
    }

    // Validate target exists
    if (data.targetWorkItemId) {
      const workItem = await prisma.workItem.findUnique({
        where: { workItemId: data.targetWorkItemId },
      });
      if (!workItem) {
        throw new Error('Target work item not found');
      }
    }

    if (data.targetArtifactId) {
      const artifact = await prisma.artifact.findUnique({
        where: { artifactId: data.targetArtifactId },
      });
      if (!artifact) {
        throw new Error('Target artifact not found');
      }
    }

    return prisma.review.create({
      data: {
        reviewType: data.reviewType,
        targetWorkItemId: data.targetWorkItemId,
        targetArtifactId: data.targetArtifactId,
        reviewerRoleId: data.reviewerRoleId,
        reviewerAgentId: data.reviewerAgentId,
      },
    });
  }

  async update(id: string, data: UpdateReviewDTO) {
    serviceLogger.info({ reviewId: id }, 'Updating review');

    const review = await prisma.review.findUnique({
      where: { reviewId: id },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    if (review.result) {
      throw new Error('Cannot update review that has already been submitted');
    }

    return prisma.review.update({
      where: { reviewId: id },
      data: {
        reviewType: data.reviewType,
        reviewerRoleId: data.reviewerRoleId,
        reviewerAgentId: data.reviewerAgentId,
      },
    });
  }

  async submit(id: string, data: SubmitReviewDTO) {
    serviceLogger.info({ reviewId: id, result: data.result }, 'Submitting review');

    const review = await prisma.review.findUnique({
      where: { reviewId: id },
      include: {
        artifact: true,
      },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    if (review.result) {
      throw new Error('Review has already been submitted');
    }

    const updated = await prisma.review.update({
      where: { reviewId: id },
      data: {
        result: data.result,
        findings: data.findings,
        mandatoryFixes: data.mandatoryFixes ?? [],
        optionalNotes: data.optionalNotes,
        severity: data.severity,
        resolvedAt: new Date(),
      },
    });

    // Update artifact status if this is an artifact review
    if (review.targetArtifactId && review.artifact) {
      let newStatus = review.artifact.status;

      switch (data.result) {
        case 'approved':
        case 'approved_with_notes':
          newStatus = 'Approved';
          break;
        case 'changes_requested':
          newStatus = 'UnderReview';
          break;
        case 'rejected':
          newStatus = 'Superseded';
          break;
        case 'escalated':
          // Keep current status, escalation is tracked separately
          break;
      }

      if (newStatus !== review.artifact.status) {
        await prisma.artifact.update({
          where: { artifactId: review.targetArtifactId },
          data: { status: newStatus },
        });
      }
    }

    return updated;
  }

  async delete(id: string) {
    serviceLogger.info({ reviewId: id }, 'Deleting review');

    const review = await prisma.review.findUnique({
      where: { reviewId: id },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    if (review.result) {
      throw new Error('Cannot delete a review that has already been submitted');
    }

    await prisma.review.delete({
      where: { reviewId: id },
    });
  }

  async getRequiredReviews(
    workItemId?: string,
    artifactId?: string
  ): Promise<ReviewRequirement[]> {
    serviceLogger.debug({ workItemId, artifactId }, 'Getting required reviews');

    if (!workItemId && !artifactId) {
      throw new Error('Either workItemId or artifactId must be specified');
    }

    // Get work item or artifact to determine required reviews
    let requiredReviewTypes: ReviewType[] = [];

    if (workItemId) {
      const workItem = await prisma.workItem.findUnique({
        where: { workItemId },
        include: {
          team: {
            include: {
              department: {
                include: {
                  division: true,
                },
              },
            },
          },
        },
      });

      if (workItem) {
        // Determine reviews based on work item type
        switch (workItem.type) {
          case 'Vision':
          case 'Goal':
            requiredReviewTypes = ['executive_review'];
            break;
          case 'Architecture':
          case 'ADR':
            requiredReviewTypes = ['architecture_review', 'security_review'];
            break;
          case 'Epic':
          case 'Story':
            requiredReviewTypes = ['lead_review', 'peer_review'];
            break;
          default:
            requiredReviewTypes = ['peer_review'];
        }
      }
    }

    if (artifactId) {
      const artifact = await prisma.artifact.findUnique({
        where: { artifactId },
      });

      if (artifact) {
        // Determine reviews based on artifact type
        switch (artifact.type) {
          case 'ArchitectureProposal':
          case 'SystemDesign':
            requiredReviewTypes = ['architecture_review'];
            break;
          case 'SecurityReview':
            requiredReviewTypes = ['security_review'];
            break;
          case 'ComplianceReport':
            requiredReviewTypes = ['compliance_review'];
            break;
          default:
            // Merge with existing or use default
            requiredReviewTypes = [...new Set([...requiredReviewTypes, 'peer_review'])];
        }
      }
    }

    // Check which reviews have been completed
    const existingReviews = await prisma.review.findMany({
      where: {
        ...(workItemId && { targetWorkItemId: workItemId }),
        ...(artifactId && { targetArtifactId: artifactId }),
        result: { not: null },
      },
    });

    const completedTypes = new Set(existingReviews.map((r) => r.reviewType));

    return requiredReviewTypes.map((type) => ({
      reviewType: type,
      required: !completedTypes.has(type),
      minimumReviewers: 1,
    }));
  }

  async getReviewStatus(workItemId?: string, artifactId?: string) {
    serviceLogger.debug({ workItemId, artifactId }, 'Getting review status');

    if (!workItemId && !artifactId) {
      throw new Error('Either workItemId or artifactId must be specified');
    }

    const [requiredReviews, completedReviews] = await Promise.all([
      this.getRequiredReviews(workItemId, artifactId),
      prisma.review.findMany({
        where: {
          ...(workItemId && { targetWorkItemId: workItemId }),
          ...(artifactId && { targetArtifactId: artifactId }),
        },
      }),
    ]);

    const completedTypes = new Map<string, ReviewResult[]>();
    completedReviews.forEach((review) => {
      if (!completedTypes.has(review.reviewType)) {
        completedTypes.set(review.reviewType, []);
      }
      if (review.result) {
        completedTypes.get(review.reviewType)!.push(review.result);
      }
    });

    const isApproved = requiredReviews.every((req) => {
      if (!req.required) return true;
      const results = completedTypes.get(req.reviewType) || [];
      return results.some((r) => r === 'approved' || r === 'approved_with_notes');
    });

    const isBlocked = Array.from(completedTypes.values()).some((results) =>
      results.some((r) => r === 'rejected' || r === 'changes_requested')
    );

    return {
      requiredReviews,
      completedReviews: completedReviews.map((r) => ({
        id: r.reviewId,
        type: r.reviewType,
        result: r.result,
        reviewer: r.reviewerAgentId || r.reviewerRoleId,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
      })),
      isApproved,
      isBlocked,
      canProceed: isApproved && !isBlocked,
    };
  }

  async assignReview(id: string, reviewerRoleId?: string, reviewerAgentId?: string) {
    serviceLogger.info({ reviewId: id, reviewerRoleId, reviewerAgentId }, 'Assigning review');

    if (!reviewerRoleId && !reviewerAgentId) {
      throw new Error('Either reviewerRoleId or reviewerAgentId must be specified');
    }

    const review = await prisma.review.findUnique({
      where: { reviewId: id },
    });

    if (!review) {
      throw new Error('Review not found');
    }

    if (review.result) {
      throw new Error('Cannot assign review that has already been submitted');
    }

    return prisma.review.update({
      where: { reviewId: id },
      data: {
        reviewerRoleId,
        reviewerAgentId,
      },
    });
  }

  async getPendingReviewsForAgent(agentId: string) {
    serviceLogger.debug({ agentId }, 'Getting pending reviews for agent');

    return prisma.review.findMany({
      where: {
        reviewerAgentId: agentId,
        result: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingReviewsForRole(roleId: string) {
    serviceLogger.debug({ roleId }, 'Getting pending reviews for role');

    return prisma.review.findMany({
      where: {
        reviewerRoleId: roleId,
        result: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReviewSummary(
    targetId: string,
    targetType: 'workItem' | 'artifact'
  ): Promise<ReviewSummary> {
    serviceLogger.debug({ targetId, targetType }, 'Getting review summary');

    const reviews = await prisma.review.findMany({
      where: {
        ...(targetType === 'workItem'
          ? { targetWorkItemId: targetId }
          : { targetArtifactId: targetId }),
      },
    });

    const byType: Record<string, number> = {};
    const byResult: Record<string, number> = {};
    let approved = 0;
    let rejected = 0;
    let pending = 0;

    reviews.forEach((review) => {
      // Count by type
      byType[review.reviewType] = (byType[review.reviewType] || 0) + 1;

      // Count by result
      if (review.result) {
        byResult[review.result] = (byResult[review.result] || 0) + 1;

        if (review.result === 'approved' || review.result === 'approved_with_notes') {
          approved++;
        } else if (review.result === 'rejected') {
          rejected++;
        }
      } else {
        pending++;
      }
    });

    return {
      totalReviews: reviews.length,
      byType,
      byResult,
      approved,
      rejected,
      pending,
    };
  }

  async findMandatoryFixes(workItemId?: string, artifactId?: string) {
    serviceLogger.debug({ workItemId, artifactId }, 'Finding mandatory fixes');

    const reviews = await prisma.review.findMany({
      where: {
        ...(workItemId && { targetWorkItemId: workItemId }),
        ...(artifactId && { targetArtifactId: artifactId }),
        result: { in: ['changes_requested', 'rejected'] },
      },
    });

    const allFixes: Array<{
      reviewId: string;
      reviewType: ReviewType;
      fixes: string[];
    }> = [];

    for (const review of reviews) {
      const fixes = review.mandatoryFixes as string[] | null;
      if (fixes && fixes.length > 0) {
        allFixes.push({
          reviewId: review.reviewId,
          reviewType: review.reviewType,
          fixes,
        });
      }
    }

    return allFixes;
  }
}
