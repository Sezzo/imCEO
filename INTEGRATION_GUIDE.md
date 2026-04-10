# Agent Teams Integration Guide für OpenCode

## Überblick

Diese Anleitung beschreibt die schrittweise Integration des Agent Teams Moduls in die bestehende OpenCode-Architektur.

## Aktuelle OpenCode-Architektur

```
src/
├── application/services/     # Business Logic Services
├── interface/http/routes/    # Fastify Routes
├── config/                   # Konfiguration (env, logger, database)
├── domain/                   # Domain Models
└── infrastructure/         # Infrastructure Layer
```

**Bemerkenswert:**

- Fastify für HTTP-API
- Prisma für Datenbank
- Service-Klassen Pattern
- Kein WebSocket-System
- Kein Claude-Code-ähnliches Tool-System

---

## Integrations-Strategien

### Option 1: Modul-Integration (Empfohlen) ⭐

Das Agent Teams Modul als separates Paket im Projekt behalten

**Vorteile:**

- Klare Trennung der Zuständigkeiten
- Einfache Updates
- Wiederverwendbar
- Keine Verschmutzung der bestehenden Codebase

**Nachteile:**

- Zusätzliche Komplexität durch Imports

### Option 2: Native Integration

Code direkt in OpenCode-Struktur integrieren

**Vorteile:**

- Nahtlose Integration
- Einheitliche Codebase

**Nachteile:**

- Schwer zu warten
- Mischung von Patterns
- Schwer zu extrahieren

---

## Detaillierter Integrationsplan (Option 1)

### Phase 1: Datenbank-Integration

#### 1.1 Schema-Erweiterung

Füge die Agent Teams Models zum bestehenden Prisma-Schema hinzu:

```prisma
// In prisma/schema.prisma - AM ENDE HINZUFÜGEN

// ============================================================================
// AGENT TEAMS - Extension
// ============================================================================

model AgentTeam {
  teamId            String            @id @default(uuid()) @map("team_id")
  teamName          String            @unique @map("team_name")
  description       String?
  companyId         String            @map("company_id")
  leadAgentId       String            @map("lead_agent_id")
  leadSessionId     String?           @map("lead_session_id")
  currentState      TeamRuntimeState  @default(active) @map("current_state")
  metadata          Json?
  createdAt         DateTime          @default(now()) @map("created_at")
  updatedAt         DateTime          @updatedAt @map("updated_at")

  company           Company           @relation(fields: [companyId], references: [companyId], onDelete: Cascade)
  members           AgentTeamMember[]
  tasks             AgentTask[]
  mailbox           TeamMailbox[]
  sessions          AgentTeamSession[]

  @@index([companyId])
  @@map("agent_teams")
}

// ... (weitere Models aus agent-teams/prisma/schema.prisma)
```

#### 1.2 Migration durchführen

```bash
npx prisma migrate dev --name add_agent_teams_support
npx prisma generate
```

### Phase 2: Backend-Integration

#### 2.1 Neue Services erstellen

Erstelle neue Service-Klassen im OpenCode-Style:

```typescript
// src/application/services/agent-team.service.ts
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const serviceLogger = logger.child({ component: 'AgentTeamService' });

export interface CreateAgentTeamDTO {
  teamName: string;
  description?: string;
  agentType?: string;
  companyId: string;
  leadAgentId: string;
}

export class AgentTeamService {
  async findAll() {
    serviceLogger.debug('Finding all agent teams');
    return prisma.agentTeam.findMany({
      include: { members: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(teamId: string) {
    serviceLogger.debug({ teamId }, 'Finding agent team by id');
    return prisma.agentTeam.findUnique({
      where: { teamId },
      include: {
        members: true,
        tasks: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async findByCompanyId(companyId: string) {
    serviceLogger.debug({ companyId }, 'Finding agent teams by company');
    return prisma.agentTeam.findMany({
      where: { companyId },
      include: { members: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateAgentTeamDTO) {
    serviceLogger.info({ teamName: data.teamName }, 'Creating agent team');

    // Prüfen ob Lead bereits ein Team hat
    const existingTeam = await prisma.agentTeam.findFirst({
      where: { leadAgentId: data.leadAgentId },
    });

    if (existingTeam) {
      throw new Error(`Lead already manages team "${existingTeam.teamName}"`);
    }

    return prisma.agentTeam.create({
      data: {
        teamName: data.teamName,
        description: data.description,
        companyId: data.companyId,
        leadAgentId: data.leadAgentId,
        members: {
          create: [
            {
              agentId: data.leadAgentId,
              name: 'team-lead',
              agentType: data.agentType || 'team-lead',
              color: '#FF6B6B',
              backendType: 'in_process',
              isActive: true,
              isLeader: true,
            },
          ],
        },
      },
      include: { members: true },
    });
  }

  async delete(teamId: string, leadAgentId: string) {
    serviceLogger.info({ teamId }, 'Deleting agent team');

    const team = await prisma.agentTeam.findUnique({
      where: { teamId },
      include: { members: true },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    if (team.leadAgentId !== leadAgentId) {
      throw new Error('Only the team lead can delete the team');
    }

    // Prüfen auf aktive Mitglieder (außer Lead)
    const activeMembers = team.members.filter((m) => m.name !== 'team-lead' && m.isActive);
    if (activeMembers.length > 0) {
      throw new Error(`Cannot delete team with ${activeMembers.length} active member(s)`);
    }

    // Cleanup in Transaktion
    await prisma.$transaction(async (tx) => {
      await tx.agentTask.deleteMany({ where: { teamId } });
      await tx.teamMailbox.deleteMany({ where: { teamId } });
      await tx.agentExecutionLog.deleteMany({ where: { teamId } });
      await tx.agentTeamSession.deleteMany({ where: { teamId } });
      await tx.agentTeamMember.deleteMany({ where: { teamId } });
      await tx.agentTeam.delete({ where: { teamId } });
    });
  }
}

export const agentTeamService = new AgentTeamService();
```

#### 2.2 Weitere Services

```typescript
// src/application/services/agent-task.service.ts
export class AgentTaskService {
  // Task CRUD + Business Logic
}

// src/application/services/agent-mailbox.service.ts
export class AgentMailboxService {
  // Messaging Logic
}

// src/application/services/agent-execution.service.ts
export class AgentExecutionService {
  // Agent spawning & execution
}
```

#### 2.3 Routes erstellen

```typescript
// src/interface/http/routes/agent-team.routes.ts
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { agentTeamService } from '../../../application/services/agent-team.service';
import { agentTaskService } from '../../../application/services/agent-task.service';
import { agentMailboxService } from '../../../application/services/agent-mailbox.service';
import { authenticate } from '../middleware/auth'; // falls vorhanden

const CreateTeamSchema = z.object({
  team_name: z.string().min(1),
  description: z.string().optional(),
  agent_type: z.string().optional(),
});

export async function agentTeamRoutes(fastify: FastifyInstance) {
  // Teams
  fastify.post('/teams', { preHandler: authenticate }, async (request, reply) => {
    const data = CreateTeamSchema.parse(request.body);
    const session = request.session; // Annahme: Session Middleware setzt dies

    const team = await agentTeamService.create({
      teamName: data.team_name,
      description: data.description,
      agentType: data.agent_type,
      companyId: session.companyId,
      leadAgentId: session.agentId,
    });

    return reply.status(201).send({ success: true, data: team });
  });

  fastify.get('/teams', { preHandler: authenticate }, async (request) => {
    const teams = await agentTeamService.findAll();
    return { success: true, data: teams };
  });

  fastify.get('/teams/:teamId', { preHandler: authenticate }, async (request, reply) => {
    const { teamId } = request.params as { teamId: string };
    const team = await agentTeamService.findById(teamId);

    if (!team) {
      return reply.status(404).send({ error: 'Team not found' });
    }

    return { success: true, data: team };
  });

  fastify.delete('/teams/:teamId', { preHandler: authenticate }, async (request, reply) => {
    const { teamId } = request.params as { teamId: string };
    const session = request.session;

    await agentTeamService.delete(teamId, session.agentId);
    return { success: true, message: 'Team deleted' };
  });

  // Tasks
  fastify.post('/teams/:teamId/tasks', async (request, reply) => {
    // Task creation endpoint
  });

  fastify.get('/teams/:teamId/tasks', async (request) => {
    // Task listing
  });

  // Messages
  fastify.post('/teams/:teamId/messages', async (request, reply) => {
    // Send message
  });

  // Agents
  fastify.post('/teams/:teamId/agents', async (request, reply) => {
    // Spawn agent
  });
}
```

#### 2.4 Server-Integration

```typescript
// In src/server.ts
import { agentTeamRoutes } from './interface/http/routes/agent-team.routes';

// ... andere imports ...

async function buildServer() {
  const server = Fastify({ logger: logger as any });

  // ... bestehende Plugins ...

  // NEU: Agent Team Routes
  await server.register(agentTeamRoutes, { prefix: '/api/v1' });

  // ... restliche Konfiguration ...
}
```

### Phase 3: WebSocket-Integration

#### 3.1 WebSocket-Plugin

```typescript
// src/infrastructure/websocket/WebSocketServer.ts
// (aus dem agent-teams Modul kopieren und anpassen)

import { WebSocketServer as WSServer } from 'ws';
import type { FastifyInstance } from 'fastify';

export function initializeWebSocket(fastify: FastifyInstance, port: number = 3001) {
  const wss = new WSServer({ port });

  wss.on('connection', (ws) => {
    fastify.log.info('New WebSocket connection');

    ws.on('message', (message) => {
      // Handle messages
    });
  });

  fastify.addHook('onClose', async () => {
    wss.close();
  });

  return wss;
}
```

#### 3.2 Event-Publisher Service

```typescript
// src/application/services/event-publisher.service.ts
import { getWebSocketServer } from '../../infrastructure/websocket/WebSocketServer';

export class EventPublisher {
  async publishToTeam(teamName: string, event: string, payload: any) {
    const wss = getWebSocketServer();
    // Broadcast to team subscribers
  }
}

export const eventPublisher = new EventPublisher();
```

### Phase 4: Frontend-Integration

#### 4.1 React Context Provider

```typescript
// frontend/src/contexts/AgentTeamsContext.tsx
// (aus agent-teams/frontend kopieren und anpassen)

import React, { createContext, useContext } from 'react';

interface AgentTeamsContextType {
  // ...
}

export const AgentTeamsProvider: React.FC = ({ children }) => {
  // Implementation
};
```

#### 4.2 Komponenten

```typescript
// frontend/src/components/teams/TeamDashboard.tsx
export function TeamDashboard() {
  // Implementation
}

// frontend/src/components/teams/TaskList.tsx
export function TaskList() {
  // Implementation
}
```

#### 4.3 Router-Integration

```typescript
// frontend/src/App.tsx oder Router-Konfiguration
import { TeamDashboard } from './components/teams/TeamDashboard';

// Neue Route hinzufügen
<Route path="/teams/:teamId" element={<TeamDashboard />} />
```

### Phase 5: Agent-Execution-Integration

#### 5.1 Anthropic Client Setup

```typescript
// src/config/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

export const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

#### 5.2 Agent Runner Integration

```typescript
// src/infrastructure/agent-execution/AgentRunner.ts
// (aus agent-teams Modul kopieren)

import { anthropicClient } from '../../config/anthropic';
import { prisma } from '../../config/database';
import { eventPublisher } from '../../application/services/event-publisher.service';

export async function runAgent(config: AgentRunnerConfig) {
  // Implementation aus agent-teams Modul
}
```

#### 5.3 Background Job Queue (optional)

Für produktionsreife Agent-Execution:

```typescript
// Using Bull or similar
import Queue from 'bull';

export const agentExecutionQueue = new Queue('agent-execution', {
  redis: { port: 6379, host: '127.0.0.1' },
});

agentExecutionQueue.process(async (job) => {
  const result = await runAgent(job.data);
  return result;
});
```

---

## Komplette Integrations-Checkliste

### Datenbank

- [ ] Prisma-Schema erweitern
- [ ] Migration durchführen
- [ ] Datenbank-Indizes prüfen

### Backend

- [ ] AgentTeamService erstellen
- [ ] AgentTaskService erstellen
- [ ] AgentMailboxService erstellen
- [ ] AgentExecutionService erstellen
- [ ] EventPublisherService erstellen
- [ ] Routes registrieren
- [ ] WebSocket-Server initialisieren
- [ ] Auth-Middleware für Routes

### Frontend

- [ ] AgentTeamsContext Provider
- [ ] TeamDashboard Komponente
- [ ] TaskList Komponente
- [ ] API Client Integration
- [ ] WebSocket Client Integration
- [ ] Routes hinzufügen

### Infrastruktur

- [ ] Anthropic SDK einrichten
- [ ] WebSocket-Server Port konfigurieren
- [ ] Umgebungsvariablen (.env)
- [ ] Docker-Compose (optional)
- [ ] Redis für Job Queue (optional)

### Tests

- [ ] Unit Tests für Services
- [ ] Integration Tests für API
- [ ] E2E Tests für Frontend

---

## Code-Beispiele

### Beispiel 1: Team erstellen und Agent spawnen

```typescript
// In einem Controller oder Service
import { agentTeamService } from '../services/agent-team.service';
import { agentExecutionService } from '../services/agent-execution.service';

async function setupReviewTeam() {
  // 1. Team erstellen
  const team = await agentTeamService.create({
    teamName: 'pr-review-142',
    description: 'Review PR #142',
    companyId: 'company-123',
    leadAgentId: 'agent-456',
  });

  // 2. Security Reviewer spawnen
  const securityAgent = await agentExecutionService.spawnAgent({
    name: 'security-reviewer',
    teamName: team.teamName,
    prompt: 'Review for security vulnerabilities...',
    description: 'Security review',
  });

  // 3. Task erstellen
  await agentTaskService.create({
    teamId: team.teamId,
    subject: 'Security audit',
    description: 'Perform security audit on auth module',
  });

  return team;
}
```

### Beispiel 2: React Hook für Teams

```typescript
// frontend/src/hooks/useAgentTeam.ts
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function useAgentTeam(teamId: string) {
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/teams/${teamId}`)
      .then((res) => setTeam(res.data))
      .finally(() => setLoading(false));
  }, [teamId]);

  const createTask = async (subject: string, description: string) => {
    const res = await api.post(`/teams/${teamId}/tasks`, {
      subject,
      description,
    });
    return res.data;
  };

  return { team, loading, createTask };
}
```

---

## Troubleshooting

### Problem: WebSocket-Verbindung fehlschlägt

**Lösung:**

- Prüfen ob Port frei ist
- CORS-Konfiguration überprüfen
- Firewall-Regeln checken

### Problem: Agent spawnen schlägt fehl

**Lösung:**

- ANTHROPIC_API_KEY prüfen
- Logs auf Fehler checken
- Berechtigungen prüfen

### Problem: Tasks werden nicht angezeigt

**Lösung:**

- Datenbank-Verbindung prüfen
- Prisma Client neu generieren
- Query-Logs aktivieren

---

## Nächste Schritte

1. **Phase 1 starten**: Datenbank-Schema erweitern
2. **Services implementieren**: Mit OpenCode-Patterns
3. **Routes hinzufügen**: Zu bestehendem Server
4. **Frontend integrieren**: React Komponenten
5. **Testen**: Unit & Integration Tests
6. **Deployen**: Mit Docker oder direkt

Soll ich mit einer spezifischen Phase beginnen?
