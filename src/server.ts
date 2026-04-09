import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/database';

// Import routes
import { companyRoutes } from './interface/http/routes/company.routes';
import { divisionRoutes } from './interface/http/routes/division.routes';
import { departmentRoutes } from './interface/http/routes/department.routes';
import { teamRoutes } from './interface/http/routes/team.routes';
import { roleTemplateRoutes } from './interface/http/routes/role-template.routes';
import { agentProfileRoutes } from './interface/http/routes/agent-profile.routes';
import { workItemRoutes } from './interface/http/routes/work-item.routes';
import { artifactRoutes } from './interface/http/routes/artifact.routes';
import { policyRoutes } from './interface/http/routes/policy.routes';
import { healthRoutes } from './interface/http/routes/health.routes';

async function buildServer() {
  const server = Fastify({
    logger: logger,
  });

  // Register plugins
  await server.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await server.register(helmet);

  await server.register(rateLimit, {
    max: parseInt(env.RATE_LIMIT_MAX, 10),
    timeWindow: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
  });

  // Swagger documentation
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'imCEO API',
        description: 'AI Company Operating System for Claude Agent Teams',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/documentation',
  });

  // Register routes
  await server.register(healthRoutes, { prefix: '/api/v1' });
  await server.register(companyRoutes, { prefix: '/api/v1' });
  await server.register(divisionRoutes, { prefix: '/api/v1' });
  await server.register(departmentRoutes, { prefix: '/api/v1' });
  await server.register(teamRoutes, { prefix: '/api/v1' });
  await server.register(roleTemplateRoutes, { prefix: '/api/v1' });
  await server.register(agentProfileRoutes, { prefix: '/api/v1' });
  await server.register(workItemRoutes, { prefix: '/api/v1' });
  await server.register(artifactRoutes, { prefix: '/api/v1' });
  await server.register(policyRoutes, { prefix: '/api/v1' });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error(error);

    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.message,
      });
    }

    reply.status(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      error: error.name,
      message: error.message,
    });
  });

  // Not found handler
  server.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
    });
  });

  return server;
}

async function main() {
  try {
    const server = await buildServer();

    // Test database connection
    await prisma.$connect();
    logger.info('Database connection established');

    const address = await server.listen({
      port: parseInt(env.PORT, 10),
      host: env.HOST,
    });

    logger.info(`Server listening at ${address}`);
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

main();
