import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import type {
  IEventPublisher,
  AgentTeamWebSocketEvents,
  WebSocketMessage,
  ClientConnection,
  SubscriptionType,
  WebSocketServerConfig,
  ConnectionStats,
} from './types';

/**
 * WebSocket Server for Agent Teams
 *
 * Handles real-time communication between:
 * - Agent execution runners and the system
 * - Frontend UI and the backend
 * - Inter-agent messaging through events
 *
 * Features:
 * - Channel-based subscriptions (team:*, agent:*, global)
 * - Automatic reconnection handling
 * - Heartbeat/ping-pong for connection health
 * - Broadcast and targeted messaging
 */
export class AgentTeamWebSocketServer implements IEventPublisher {
  private server: WSServer | null = null;
  private connections: Map<string, ClientConnection> = new Map();
  private config: WebSocketServerConfig;
  private pingInterval: NodeJS.Timeout | null = null;
  private stats: ConnectionStats = {
    totalConnections: 0,
    connectionsByTeam: {},
    connectionsByAgent: {},
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
  };

  constructor(config: Partial<WebSocketServerConfig> = {}) {
    this.config = {
      port: config.port || 3001,
      path: config.path || '/ws/agent-teams',
      pingIntervalMs: config.pingIntervalMs || 30000,
      pongTimeoutMs: config.pongTimeoutMs || 10000,
      maxConnections: config.maxConnections || 1000,
      enableCompression: config.enableCompression ?? true,
    };
  }

  /**
   * Start the WebSocket server
   */
  start(): void {
    this.server = new WSServer({
      port: this.config.port,
      path: this.config.path,
      perMessageDeflate: this.config.enableCompression,
    });

    this.server.on('connection', this.handleConnection.bind(this));
    this.server.on('error', this.handleServerError.bind(this));

    // Start heartbeat
    this.startHeartbeat();

    console.log(
      `Agent Teams WebSocket server started on port ${this.config.port} at ${this.config.path}`
    );
  }

  /**
   * Stop the WebSocket server gracefully
   */
  async stop(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all connections gracefully
    for (const connection of this.connections.values()) {
      connection.socket.close(1000, 'Server shutting down');
    }

    // Wait for connections to close
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.connections.size === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });

    this.server?.close();
    console.log('Agent Teams WebSocket server stopped');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    // Check max connections
    if (this.connections.size >= this.config.maxConnections) {
      socket.close(1013, 'Maximum connections reached');
      return;
    }

    const connectionId = randomUUID();
    const connection: ClientConnection = {
      id: connectionId,
      socket,
      subscriptions: new Set(),
      connectedAt: new Date(),
      lastPingAt: new Date(),
    };

    this.connections.set(connectionId, connection);
    this.stats.totalConnections++;

    // Set up socket event handlers
    socket.on('message', (data) => this.handleMessage(connection, data));
    socket.on('close', (code, reason) => this.handleClose(connection, code, reason));
    socket.on('error', (error) => this.handleError(connection, error));
    socket.on('pong', () => {
      connection.lastPingAt = new Date();
    });

    // Send welcome message
    this.sendToConnection(connection, {
      type: 'connection:established',
      payload: {
        connectionId,
        timestamp: new Date().toISOString(),
      },
    } as any);

    console.log(`Client ${connectionId} connected. Total connections: ${this.connections.size}`);
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(connection: ClientConnection, data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      this.stats.messagesReceived++;

      // Handle subscription commands
      if (message.type === 'subscribe') {
        this.handleSubscribe(connection, message.payload as { channel: SubscriptionType });
        return;
      }

      if (message.type === 'unsubscribe') {
        this.handleUnsubscribe(connection, message.payload as { channel: SubscriptionType });
        return;
      }

      if (message.type === 'ping') {
        this.sendToConnection(connection, {
          type: 'pong',
          payload: { timestamp: new Date().toISOString() },
        } as any);
        return;
      }

      // Handle metadata update
      if (message.type === 'metadata:update') {
        const metadata = message.payload as {
          teamName?: string;
          agentId?: string;
          userId?: string;
        };
        connection.metadata = { ...connection.metadata, ...metadata };
        this.updateConnectionStats(connection);
        return;
      }

      console.log(`Received message type ${message.type} from ${connection.id}`);
    } catch (error) {
      this.stats.errors++;
      console.error(`Error handling message from ${connection.id}:`, error);
      this.sendToConnection(connection, {
        type: 'error',
        payload: { message: 'Invalid message format' },
      } as any);
    }
  }

  /**
   * Handle subscription request
   */
  private handleSubscribe(
    connection: ClientConnection,
    payload: { channel: SubscriptionType }
  ): void {
    const { channel } = payload;
    connection.subscriptions.add(channel);

    // Update stats
    if (channel.startsWith('team:')) {
      const teamName = channel.replace('team:', '');
      this.stats.connectionsByTeam[teamName] = (this.stats.connectionsByTeam[teamName] || 0) + 1;

      // Update connection metadata
      if (!connection.metadata?.teamName) {
        connection.metadata = { ...connection.metadata, teamName };
      }
    }

    if (channel.startsWith('agent:')) {
      const agentId = channel.replace('agent:', '');
      this.stats.connectionsByAgent[agentId] = (this.stats.connectionsByAgent[agentId] || 0) + 1;
    }

    this.sendToConnection(connection, {
      type: 'subscription:confirmed',
      payload: { channel, subscribed: true },
    } as any);

    console.log(`Client ${connection.id} subscribed to ${channel}`);
  }

  /**
   * Handle unsubscribe request
   */
  private handleUnsubscribe(
    connection: ClientConnection,
    payload: { channel: SubscriptionType }
  ): void {
    const { channel } = payload;
    connection.subscriptions.delete(channel);

    // Update stats
    if (channel.startsWith('team:')) {
      const teamName = channel.replace('team:', '');
      this.stats.connectionsByTeam[teamName] = Math.max(
        0,
        (this.stats.connectionsByTeam[teamName] || 0) - 1
      );
    }

    if (channel.startsWith('agent:')) {
      const agentId = channel.replace('agent:', '');
      this.stats.connectionsByAgent[agentId] = Math.max(
        0,
        (this.stats.connectionsByAgent[agentId] || 0) - 1
      );
    }

    this.sendToConnection(connection, {
      type: 'subscription:confirmed',
      payload: { channel, subscribed: false },
    } as any);

    console.log(`Client ${connection.id} unsubscribed from ${channel}`);
  }

  /**
   * Handle connection close
   */
  private handleClose(connection: ClientConnection, code: number, reason: Buffer): void {
    // Update stats
    for (const channel of connection.subscriptions) {
      if (channel.startsWith('team:')) {
        const teamName = channel.replace('team:', '');
        this.stats.connectionsByTeam[teamName] = Math.max(
          0,
          (this.stats.connectionsByTeam[teamName] || 0) - 1
        );
      }
      if (channel.startsWith('agent:')) {
        const agentId = channel.replace('agent:', '');
        this.stats.connectionsByAgent[agentId] = Math.max(
          0,
          (this.stats.connectionsByAgent[agentId] || 0) - 1
        );
      }
    }

    this.connections.delete(connection.id);
    console.log(
      `Client ${connection.id} disconnected (code: ${code}, reason: ${reason?.toString()}). Total connections: ${this.connections.size}`
    );
  }

  /**
   * Handle connection error
   */
  private handleError(connection: ClientConnection, error: Error): void {
    this.stats.errors++;
    console.error(`WebSocket error for client ${connection.id}:`, error);
  }

  /**
   * Handle server-level error
   */
  private handleServerError(error: Error): void {
    this.stats.errors++;
    console.error('WebSocket server error:', error);
  }

  /**
   * Send message to specific connection
   */
  private sendToConnection(connection: ClientConnection, message: WebSocketMessage): void {
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.send(JSON.stringify(message));
      this.stats.messagesSent++;
    }
  }

  /**
   * Start heartbeat/ping-pong
   */
  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      const now = new Date();
      const deadConnections: string[] = [];

      for (const [id, connection] of this.connections) {
        const timeSinceLastPong = now.getTime() - connection.lastPingAt.getTime();

        if (timeSinceLastPong > this.config.pongTimeoutMs) {
          // Connection appears dead
          deadConnections.push(id);
          connection.socket.terminate();
        } else {
          // Send ping
          connection.socket.ping();
        }
      }

      // Clean up dead connections
      for (const id of deadConnections) {
        this.connections.delete(id);
      }

      if (deadConnections.length > 0) {
        console.log(`Cleaned up ${deadConnections.length} dead connections`);
      }
    }, this.config.pingIntervalMs);
  }

  /**
   * Update connection statistics based on metadata
   */
  private updateConnectionStats(connection: ClientConnection): void {
    const metadata = connection.metadata;
    if (!metadata) return;

    if (metadata.teamName) {
      const channel: SubscriptionType = `team:${metadata.teamName}`;
      if (!connection.subscriptions.has(channel)) {
        this.handleSubscribe(connection, { channel });
      }
    }

    if (metadata.agentId) {
      const channel: SubscriptionType = `agent:${metadata.agentId}`;
      if (!connection.subscriptions.has(channel)) {
        this.handleSubscribe(connection, { channel });
      }
    }
  }

  // ============================================================================
  // IEventPublisher Implementation
  // ============================================================================

  /**
   * Publish event to global subscribers
   */
  async publish<K extends keyof AgentTeamWebSocketEvents>(
    type: K,
    payload: AgentTeamWebSocketEvents[K]
  ): Promise<void> {
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      id: randomUUID(),
    };

    for (const connection of this.connections.values()) {
      if (connection.subscriptions.has('global')) {
        this.sendToConnection(connection, message);
      }
    }
  }

  /**
   * Publish event to specific team subscribers
   */
  async publishToTeam<K extends keyof AgentTeamWebSocketEvents>(
    teamName: string,
    type: K,
    payload: AgentTeamWebSocketEvents[K]
  ): Promise<void> {
    const channel: SubscriptionType = `team:${teamName}`;
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      id: randomUUID(),
    };

    for (const connection of this.connections.values()) {
      if (connection.subscriptions.has(channel) || connection.subscriptions.has('global')) {
        this.sendToConnection(connection, message);
      }
    }
  }

  /**
   * Publish event to specific agent subscribers
   */
  async publishToAgent<K extends keyof AgentTeamWebSocketEvents>(
    agentId: string,
    type: K,
    payload: AgentTeamWebSocketEvents[K]
  ): Promise<void> {
    const channel: SubscriptionType = `agent:${agentId}`;
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      id: randomUUID(),
    };

    for (const connection of this.connections.values()) {
      if (connection.subscriptions.has(channel) || connection.subscriptions.has('global')) {
        this.sendToConnection(connection, message);
      }
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * Get active connections for a team
   */
  getTeamConnections(teamName: string): ClientConnection[] {
    const channel: SubscriptionType = `team:${teamName}`;
    return Array.from(this.connections.values()).filter((conn) => conn.subscriptions.has(channel));
  }

  /**
   * Get active connections for an agent
   */
  getAgentConnections(agentId: string): ClientConnection[] {
    const channel: SubscriptionType = `agent:${agentId}`;
    return Array.from(this.connections.values()).filter((conn) => conn.subscriptions.has(channel));
  }

  /**
   * Broadcast to all connections
   */
  broadcast(message: Omit<WebSocketMessage, 'id' | 'timestamp'>): void {
    const fullMessage: WebSocketMessage = {
      ...message,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };

    for (const connection of this.connections.values()) {
      this.sendToConnection(connection, fullMessage);
    }
  }
}

// Singleton instance
let webSocketServer: AgentTeamWebSocketServer | null = null;

export function initializeWebSocketServer(
  config?: Partial<WebSocketServerConfig>
): AgentTeamWebSocketServer {
  if (!webSocketServer) {
    webSocketServer = new AgentTeamWebSocketServer(config);
    webSocketServer.start();
  }
  return webSocketServer;
}

export function getWebSocketServer(): AgentTeamWebSocketServer | null {
  return webSocketServer;
}

export function stopWebSocketServer(): Promise<void> {
  if (webSocketServer) {
    return webSocketServer.stop();
  }
  return Promise.resolve();
}
