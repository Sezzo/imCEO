import { logger } from '../../config/logger';
import { EventPublisher, Event, eventPublisher } from './event-publisher';

const serviceLogger = logger.child({ component: 'WebSocketServer' });

export interface WebSocketClient {
  id: string;
  socket: WebSocket;
  subscriptions: Set<string>;
  metadata: {
    userId?: string;
    teamId?: string;
    sessionId?: string;
    agentId?: string;
    connectedAt: Date;
    lastPingAt: Date;
  };
}

export interface WebSocketMessage {
  type: string;
  payload?: Record<string, unknown>;
  timestamp?: Date;
}

export class WebSocketServer {
  private clients: Map<string, WebSocketClient> = new Map();
  private eventPublisher: EventPublisher;
  private heartbeatInterval?: NodeJS.Timeout;
  private unsubscribeFromEvents?: () => void;

  constructor(eventPublisher: EventPublisher) {
    this.eventPublisher = eventPublisher;
  }

  // Initialize WebSocket server (would integrate with Fastify in production)
  initialize(server?: any): void {
    serviceLogger.info('Initializing WebSocket server');

    // Subscribe to all events and broadcast to clients
    this.unsubscribeFromEvents = this.eventPublisher.subscribeAll((event) => {
      this.broadcastEvent(event);
    });

    // Start heartbeat monitoring
    this.startHeartbeat();
  }

  // Add a new client connection
  addClient(clientId: string, socket: WebSocket, metadata?: Partial<WebSocketClient['metadata']>): WebSocketClient {
    serviceLogger.info({ clientId }, 'WebSocket client connected');

    const client: WebSocketClient = {
      id: clientId,
      socket,
      subscriptions: new Set(),
      metadata: {
        connectedAt: new Date(),
        lastPingAt: new Date(),
        ...metadata,
      },
    };

    this.clients.set(clientId, client);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection_established',
      payload: {
        clientId,
        serverTime: new Date().toISOString(),
      },
    });

    return client;
  }

  // Remove a client connection
  removeClient(clientId: string): void {
    serviceLogger.info({ clientId }, 'WebSocket client disconnected');
    this.clients.delete(clientId);
  }

  // Handle incoming message from client
  handleMessage(clientId: string, message: WebSocketMessage): void {
    serviceLogger.debug({ clientId, messageType: message.type }, 'Received WebSocket message');

    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(clientId, message.payload?.eventTypes as string[]);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(clientId, message.payload?.eventTypes as string[]);
        break;

      case 'ping':
        this.handlePing(clientId);
        break;

      case 'join_session':
        this.handleJoinSession(clientId, message.payload?.sessionId as string);
        break;

      case 'leave_session':
        this.handleLeaveSession(clientId);
        break;

      default:
        serviceLogger.warn({ clientId, messageType: message.type }, 'Unknown message type');
    }
  }

  private handleSubscribe(clientId: string, eventTypes?: string[]): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (eventTypes) {
      for (const type of eventTypes) {
        client.subscriptions.add(type);
      }
    }

    serviceLogger.debug({ clientId, eventTypes }, 'Client subscribed to events');

    this.sendToClient(clientId, {
      type: 'subscribed',
      payload: { eventTypes: Array.from(client.subscriptions) },
    });
  }

  private handleUnsubscribe(clientId: string, eventTypes?: string[]): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (eventTypes) {
      for (const type of eventTypes) {
        client.subscriptions.delete(type);
      }
    } else {
      client.subscriptions.clear();
    }

    serviceLogger.debug({ clientId, eventTypes }, 'Client unsubscribed from events');

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      payload: { eventTypes: Array.from(client.subscriptions) },
    });
  }

  private handlePing(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.metadata.lastPingAt = new Date();
    }

    this.sendToClient(clientId, {
      type: 'pong',
      payload: { serverTime: new Date().toISOString() },
    });
  }

  private handleJoinSession(clientId: string, sessionId?: string): void {
    if (!sessionId) return;

    const client = this.clients.get(clientId);
    if (!client) return;

    client.metadata.sessionId = sessionId;

    serviceLogger.debug({ clientId, sessionId }, 'Client joined session');

    this.sendToClient(clientId, {
      type: 'session_joined',
      payload: { sessionId },
    });
  }

  private handleLeaveSession(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const sessionId = client.metadata.sessionId;
    delete client.metadata.sessionId;

    serviceLogger.debug({ clientId, sessionId }, 'Client left session');

    this.sendToClient(clientId, {
      type: 'session_left',
      payload: { sessionId },
    });
  }

  // Send message to specific client
  sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      const messageWithTimestamp = {
        ...message,
        timestamp: new Date().toISOString(),
      };

      // In production with actual WebSocket:
      // client.socket.send(JSON.stringify(messageWithTimestamp));

      serviceLogger.debug({ clientId, messageType: message.type }, 'Sent message to client');
      return true;
    } catch (error) {
      serviceLogger.error({ clientId, error }, 'Failed to send message to client');
      return false;
    }
  }

  // Broadcast event to relevant clients
  private broadcastEvent(event: Event): void {
    const message: WebSocketMessage = {
      type: event.type,
      payload: {
        ...event.payload,
        eventId: event.id,
        metadata: event.metadata,
      },
      timestamp: event.timestamp,
    };

    for (const [clientId, client] of this.clients) {
      // Check if client should receive this event
      if (this.shouldReceiveEvent(client, event)) {
        this.sendToClient(clientId, message);
      }
    }
  }

  private shouldReceiveEvent(client: WebSocketClient, event: Event): boolean {
    // Check if client is subscribed to this event type
    const isSubscribed =
      client.subscriptions.size === 0 || // No subscriptions = receive all
      client.subscriptions.has(event.type) ||
      client.subscriptions.has('*'); // Wildcard subscription

    if (!isSubscribed) return false;

    // Check session filtering
    if (client.metadata.sessionId && event.metadata?.sessionId) {
      return client.metadata.sessionId === event.metadata.sessionId;
    }

    // Check team filtering
    if (client.metadata.teamId && event.metadata?.teamId) {
      return client.metadata.teamId === event.metadata.teamId;
    }

    // Check agent filtering
    if (client.metadata.agentId && event.metadata?.agentId) {
      return client.metadata.agentId === event.metadata.agentId;
    }

    return true;
  }

  // Broadcast to all clients
  broadcast(message: WebSocketMessage, filter?: { sessionId?: string; teamId?: string }): void {
    for (const [clientId, client] of this.clients) {
      if (filter?.sessionId && client.metadata.sessionId !== filter.sessionId) {
        continue;
      }
      if (filter?.teamId && client.metadata.teamId !== filter.teamId) {
        continue;
      }
      this.sendToClient(clientId, message);
    }
  }

  // Get connected clients
  getClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }

  getClientCount(): number {
    return this.clients.size;
  }

  // Heartbeat monitoring
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.checkClientHealth();
    }, 30000); // Check every 30 seconds
  }

  private checkClientHealth(): void {
    const now = Date.now();
    const timeoutMs = 120000; // 2 minutes timeout

    for (const [clientId, client] of this.clients) {
      const timeSinceLastPing = now - client.metadata.lastPingAt.getTime();

      if (timeSinceLastPing > timeoutMs) {
        serviceLogger.warn({ clientId, timeSinceLastPing }, 'Client timed out');
        this.removeClient(clientId);
      }
    }
  }

  // Shutdown
  destroy(): void {
    serviceLogger.info('Shutting down WebSocket server');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.unsubscribeFromEvents) {
      this.unsubscribeFromEvents();
    }

    // Close all client connections
    for (const clientId of this.clients.keys()) {
      this.removeClient(clientId);
    }

    this.clients.clear();
  }
}

// Singleton instance
export const websocketServer = new WebSocketServer(eventPublisher);
