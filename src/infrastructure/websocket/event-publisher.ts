import { logger } from '../../config/logger';

const serviceLogger = logger.child({ component: 'EventPublisher' });

export interface Event {
  id: string;
  type: string;
  timestamp: Date;
  payload: Record<string, unknown>;
  metadata?: {
    sessionId?: string;
    agentId?: string;
    teamId?: string;
    userId?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
  };
}

export type EventHandler = (event: Event) => void | Promise<void>;

export class EventPublisher {
  private subscribers: Map<string, Set<EventHandler>> = new Map();
  private globalSubscribers: Set<EventHandler> = new Set();
  private eventHistory: Event[] = [];
  private maxHistorySize: number;

  constructor(maxHistorySize = 1000) {
    this.maxHistorySize = maxHistorySize;
  }

  // Subscribe to specific event types
  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    this.subscribers.get(eventType)!.add(handler);
    serviceLogger.debug({ eventType }, 'Subscriber added for event type');

    // Return unsubscribe function
    return () => {
      this.subscribers.get(eventType)?.delete(handler);
    };
  }

  // Subscribe to all events
  subscribeAll(handler: EventHandler): () => void {
    this.globalSubscribers.add(handler);
    serviceLogger.debug('Global subscriber added');

    return () => {
      this.globalSubscribers.delete(handler);
    };
  }

  // Publish an event
  publish(eventType: string, payload: Record<string, unknown>, metadata?: Event['metadata']): Event {
    const event: Event = {
      id: this.generateEventId(),
      type: eventType,
      timestamp: new Date(),
      payload,
      metadata,
    };

    // Add to history
    this.addToHistory(event);

    serviceLogger.debug(
      { eventId: event.id, type: eventType, metadata },
      'Publishing event'
    );

    // Notify type-specific subscribers
    const typeSubscribers = this.subscribers.get(eventType);
    if (typeSubscribers) {
      for (const handler of typeSubscribers) {
        this.notifyHandler(handler, event);
      }
    }

    // Notify global subscribers
    for (const handler of this.globalSubscribers) {
      this.notifyHandler(handler, event);
    }

    return event;
  }

  private async notifyHandler(handler: EventHandler, event: Event): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      serviceLogger.error(
        { eventId: event.id, error },
        'Error in event handler'
      );
    }
  }

  // Get event history
  getHistory(options?: {
    eventTypes?: string[];
    sessionId?: string;
    agentId?: string;
    since?: Date;
    limit?: number;
  }): Event[] {
    let filtered = [...this.eventHistory];

    if (options?.eventTypes) {
      filtered = filtered.filter((e) => options.eventTypes!.includes(e.type));
    }

    if (options?.sessionId) {
      filtered = filtered.filter((e) => e.metadata?.sessionId === options.sessionId);
    }

    if (options?.agentId) {
      filtered = filtered.filter((e) => e.metadata?.agentId === options.agentId);
    }

    if (options?.since) {
      filtered = filtered.filter((e) => e.timestamp >= options.since!);
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  private addToHistory(event: Event): void {
    this.eventHistory.push(event);

    // Trim history if needed
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Clear history
  clearHistory(): void {
    this.eventHistory = [];
    serviceLogger.info('Event history cleared');
  }

  // Get subscriber count
  getSubscriberCount(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const [type, handlers] of this.subscribers) {
      byType[type] = handlers.size;
    }

    return {
      total: this.globalSubscribers.size + Array.from(this.subscribers.values())
        .reduce((sum, set) => sum + set.size, 0),
      byType,
    };
  }
}

// Singleton instance
export const eventPublisher = new EventPublisher();
