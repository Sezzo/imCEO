/**
 * Agent Teams Integration für OpenCode
 *
 * Diese Datei zeigt, wie das agent-teams Modul in server.ts integriert wird
 */

// ============================================================================
// 1. NEUE IMPORTS (am Anfang von server.ts hinzufügen)
// ============================================================================

// Agent Teams Modul
import { initializeAgentTeams, agentTeamRoutes, shutdownAgentTeams } from '../agent-teams/src';

// WebSocket (falls nicht schon vorhanden)
import { AgentTeamWebSocketServer } from '../agent-teams/src/infrastructure/websocket/WebSocketServer';

// Anthropic SDK (muss installiert werden: npm install @anthropic-ai/sdk)
import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// 2. ANTHROPIC CLIENT INITIALISIEREN (nach den anderen configs)
// ============================================================================

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// 3. ERWEITERTE buildServer FUNKTION
// ============================================================================

async function buildServer() {
  const server = Fastify({
    logger: logger as any,
  });

  // ... bestehende Plugins (cors, helmet, rateLimit, swagger) ...

  // ============================================================================
  // NEU: Agent Teams initialisieren
  // ============================================================================

  // Prüfen ob ANTHROPIC_API_KEY gesetzt ist
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn('ANTHROPIC_API_KEY not set - Agent Teams will not be available');
  } else {
    try {
      // Agent Teams initialisieren
      const agentTeams = initializeAgentTeams({
        prisma,
        anthropicClient,
        toolRegistry: createToolRegistry(), // Siehe unten
        logger,
        webSocketPort: parseInt(process.env.AGENT_TEAMS_WS_PORT || '3001'),
      });

      // WebSocket Server an Fastify anhängen (für Zugriff in Routes)
      server.decorate('agentTeamWebSocket', agentTeams.webSocketServer);
      server.decorate('inProcessManager', agentTeams.inProcessManager);

      logger.info('Agent Teams module initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Agent Teams:', error);
    }
  }

  // ... bestehende Route-Registrierungen ...

  // ============================================================================
  // NEU: Agent Team Routes registrieren
  // ============================================================================

  await server.register(agentTeamRoutes, { prefix: '/api/v1' });
  logger.info('Agent Team routes registered at /api/v1');

  // ... Error Handler und Not Found Handler ...

  // ============================================================================
  // NEU: Graceful Shutdown Hook
  // ============================================================================

  server.addHook('onClose', async () => {
    logger.info('Shutting down Agent Teams...');
    await shutdownAgentTeams();
  });

  return server;
}

// ============================================================================
// 4. TOOL REGISTRY (einfache Version - anpassen an bestehende Tools)
// ============================================================================

function createToolRegistry() {
  // Hier sollten alle OpenCode-Tools registriert werden
  // Dies ist ein vereinfachtes Beispiel

  const tools = new Map();

  // Standard-Tools hinzufügen
  // tools.set('ReadFile', readFileTool);
  // tools.set('WriteFile', writeFileTool);
  // ... etc.

  return {
    getTool: (name: string) => tools.get(name),
    getAllTools: () => Array.from(tools.values()),
    getToolsForAgent: (allowedTools?: string[]) => {
      if (!allowedTools) return Array.from(tools.values());
      return allowedTools.map((name) => tools.get(name)).filter(Boolean);
    },
  };
}

// ============================================================================
// 5. ERWEITERTE main() FUNKTION
// ============================================================================

async function main() {
  try {
    const server = await buildServer();

    // Test database connection
    await prisma.$connect();
    logger.info('Database connection established');

    // ============================================================================
    // NEU: Prüfen ob Agent Teams Tabellen existieren
    // ============================================================================

    try {
      await prisma.$queryRaw`SELECT 1 FROM agent_teams LIMIT 1`;
      logger.info('Agent Teams database tables verified');
    } catch (error) {
      logger.warn('Agent Teams tables may not exist - run: npx prisma migrate dev');
    }

    const address = await server.listen({
      port: parseInt(env.PORT, 10),
      host: env.HOST,
    });

    logger.info(`Server listening at ${address}`);
    logger.info(
      `Agent Teams WebSocket available at ws://localhost:${process.env.AGENT_TEAMS_WS_PORT || '3001'}`
    );
    logger.info(`Documentation available at ${address}/documentation`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received signal ${signal}, starting graceful shutdown...`);
      await server.close();
      await prisma.$disconnect();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// ============================================================================
// 6. ALTERNATIVE: Einfachere Integration (wenn vollständiges Modul zu komplex)
// ============================================================================

/**
 * Einfachere Alternative: Nur API Routes ohne vollständiges Modul
 *
 * Wenn das vollständige agent-teams Modul zu komplex ist, kann man auch
 * nur die API-Routes und Services direkt in OpenCode implementieren.
 */

async function buildServerSimple() {
  const server = Fastify({ logger: logger as any });

  // ... bestehende Setup ...

  // Einfache Agent Team Routes (nur CRUD, keine Execution)
  await server.register(simpleAgentTeamRoutes, { prefix: '/api/v1' });

  return server;
}

// ============================================================================
// 7. ENVIRONMENT VARIABLES (zu .env hinzufügen)
// ============================================================================

/**
 * Folgende Variablen zu .env hinzufügen:
 *
 * # Anthropic API (für Agent Teams)
 * ANTHROPIC_API_KEY=sk-ant-...
 *
 * # Agent Teams WebSocket (optional, default: 3001)
 * AGENT_TEAMS_WS_PORT=3001
 *
 * # Agent Teams Konfiguration (optional)
 * AGENT_TEAMS_ENABLED=true
 * AGENT_TEAMS_DEFAULT_MODEL=sonnet
 * AGENT_TEAMS_MAX_TEAM_SIZE=10
 */

// ============================================================================
// 8. PACKAGE.JSON DEPENDENCIES (zu package.json hinzufügen)
// ============================================================================

/**
 * {
 *   "dependencies": {
 *     "@anthropic-ai/sdk": "^0.24.0",
 *     "ws": "^8.16.0",
 *     "@types/ws": "^8.5.10"
 *   }
 * }
 *
 * Installieren mit: npm install @anthropic-ai/sdk ws
 *                   npm install -D @types/ws
 */
