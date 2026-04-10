# OpenCode Agent Teams Integration - Zusammenfassung

## Übersicht

Diese Dateien ermöglichen die Integration des Agent Teams Moduls in OpenCode:

| Datei                                 | Zweck                                      |
| ------------------------------------- | ------------------------------------------ |
| `INTEGRATION_GUIDE.md`                | Detaillierte Schritt-für-Schritt Anleitung |
| `server-integration-example.ts`       | Backend-Code-Beispiele                     |
| `prisma-agent-teams-extension.prisma` | Datenbank-Schema-Erweiterungen             |
| `frontend-integration-example.tsx`    | Frontend-React-Integration                 |
| `docker-compose-agent-teams.yml`      | Docker-Compose Konfiguration               |
| `agent-teams/`                        | Vollständiges Modul (bereits erstellt)     |

---

## Schnellstart-Integration (5 Schritte)

### Schritt 1: Datenbank vorbereiten (2 Min)

```bash
# 1. Schema erweitern
cat prisma-agent-teams-extension.prisma >> prisma/schema.prisma

# 2. Migration durchführen
npx prisma migrate dev --name add_agent_teams
npx prisma generate
```

### Schritt 2: Abhängigkeiten installieren (1 Min)

```bash
npm install @anthropic-ai/sdk ws
npm install -D @types/ws
```

### Schritt 3: Environment konfigurieren (1 Min)

```bash
# .env hinzufügen:
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
echo "AGENT_TEAMS_WS_PORT=3001" >> .env
```

### Schritt 4: Server erweitern (3 Min)

Siehe `server-integration-example.ts`:

- Imports hinzufügen
- `initializeAgentTeams()` aufrufen
- Routes registrieren
- Graceful shutdown hinzufügen

### Schritt 5: Frontend erweitern (3 Min)

Siehe `frontend-integration-example.tsx`:

- API Client erweitern
- React Context einbinden
- Routes hinzufügen

**Gesamtzeit: ~10 Minuten für grundlegende Integration**

---

## Integrations-Optionen

### Option A: Modul-Import (Empfohlen)

```typescript
// Einfacher Import des vollständigen Moduls
import { initializeAgentTeams, agentTeamRoutes } from './agent-teams/src';

const agentTeams = initializeAgentTeams({
  prisma,
  anthropicClient,
  toolRegistry,
  logger,
});

await server.register(agentTeamRoutes, { prefix: '/api/v1' });
```

**Vorteile:**

- Schnellste Integration
- Alle Features sofort verfügbar
- Klare Trennung

### Option B: Native Integration (Empfohlen für Anpassungen)

```typescript
// Services direkt in OpenCode-Struktur erstellen
// src/application/services/agent-team.service.ts
// src/application/services/agent-task.service.ts
// ...
```

**Vorteile:**

- Vollständige Kontrolle
- Einheitlicher Code-Style
- Einfacher zu debuggen

---

## Architektur-Vergleich

### Vor der Integration

```
Client → HTTP → Fastify → Services → Prisma → PostgreSQL
```

### Nach der Integration

```
Client → HTTP → Fastify → Services → Prisma → PostgreSQL
  ↓
WebSocket → Real-time Events
  ↓
Agent Execution → Anthropic API
```

---

## Konkrete Code-Beispiele

### 1. Team erstellen

```typescript
// Backend (Service)
const team = await agentTeamService.create({
  teamName: 'pr-review-142',
  description: 'Review PR #142',
  companyId: 'company-123',
  leadAgentId: 'agent-456',
});

// Frontend (React)
const { createTeam } = useAgentTeams();
await createTeam({ team_name: 'pr-review-142' });
```

### 2. Agent spawnen

```typescript
// Backend
await agentExecutionService.spawnAgent({
  name: 'security-reviewer',
  teamName: 'pr-review-142',
  prompt: 'Review for security vulnerabilities...',
  description: 'Security review',
});

// Frontend
const { spawnAgent } = useAgentTeams();
await spawnAgent('security-reviewer', 'Review for security...', 'Security review');
```

### 3. Task erstellen

```typescript
// Backend
await agentTaskService.create({
  teamId: team.teamId,
  subject: 'Security audit',
  description: 'Perform security audit',
  blockedBy: [dependencyTaskId], // Optional
});

// Frontend
const { createTask } = useAgentTeams();
await createTask('Security audit', 'Perform security audit');
```

### 4. Nachricht senden

```typescript
// Backend
await agentMailboxService.sendMessage({
  teamId,
  toAgentId: 'security-reviewer',
  fromAgentId: 'team-lead',
  messageType: 'text',
  content: 'Found SQL injection in auth.ts',
  summary: 'Found SQL injection',
});

// Frontend
const { sendMessage } = useAgentTeams();
await sendMessage('security-reviewer', 'Found SQL injection', 'Found vulnerability');
```

---

## API-Endpunkte nach Integration

| Endpoint                     | Methode   | Beschreibung     |
| ---------------------------- | --------- | ---------------- |
| `/api/v1/teams`              | POST      | Team erstellen   |
| `/api/v1/teams/:id`          | GET       | Team Details     |
| `/api/v1/teams/:id`          | DELETE    | Team löschen     |
| `/api/v1/teams/:id/tasks`    | POST      | Task erstellen   |
| `/api/v1/teams/:id/tasks`    | GET       | Tasks listen     |
| `/api/v1/teams/:id/messages` | POST      | Nachricht senden |
| `/api/v1/teams/:id/agents`   | POST      | Agent spawnen    |
| `ws://host:3001`             | WebSocket | Real-time Events |

---

## Frontend-Komponenten

Nach Integration verfügbar:

```tsx
// Komplette Team-Dashboard
<TeamDashboard />

// Nur Task-Liste
<TaskList />

// Nur Mitglieder-Liste
<MemberList />

// Mit Context
<AgentTeamsProvider>
  <App />
</AgentTeamsProvider>
```

---

## Konfiguration

### Minimale Konfiguration

```env
ANTHROPIC_API_KEY=sk-ant-...
```

### Empfohlene Konfiguration

```env
ANTHROPIC_API_KEY=sk-ant-...
AGENT_TEAMS_WS_PORT=3001
AGENT_TEAMS_ENABLED=true
AGENT_TEAMS_DEFAULT_MODEL=sonnet
AGENT_TEAMS_MAX_TEAM_SIZE=10
```

### Produktions-Konfiguration

```env
ANTHROPIC_API_KEY=sk-ant-...
AGENT_TEAMS_WS_PORT=3001
REDIS_URL=redis://localhost:6379
AGENT_TEAMS_WORKERS=4
```

---

## Häufige Fragen

### Q: Brauche ich Redis?

**A:** Optional. Für einfache Integration nicht nötig. Für produktionsreife Background-Execution empfohlen.

### Q: Funktioniert es mit dem bestehenden Auth-System?

**A:** Ja. Einfach `preHandler: authenticate` zu Routes hinzufügen.

### Q: Kann ich nur Teile des Moduls verwenden?

**A:** Ja. Z.B. nur Team-Management ohne Agent-Execution.

### Q: Wie viele Agents können parallel laufen?

**A:** Standard: Unbegrenzt (In-Process). Mit Redis Queue: Skalierbar.

### Q: Funktioniert es im Browser?

**A:** Ja. WebSocket-Verbindung für Real-time Updates.

---

## Troubleshooting

| Problem                       | Lösung                                        |
| ----------------------------- | --------------------------------------------- |
| "ANTHROPIC_API_KEY not set"   | API Key in .env hinzufügen                    |
| "Table not found"             | Migration ausführen: `npx prisma migrate dev` |
| "WebSocket connection failed" | Port 3001 prüfen, Firewall/CORS checken       |
| "Agent spawn failed"          | Logs prüfen, API Key validieren               |
| "Module not found"            | `npm install` in agent-teams/ ausführen       |

---

## Nächste Schritte

### Sofort (Heute)

1. [ ] Datenbank-Migration durchführen
2. [ ] Abhängigkeiten installieren
3. [ ] Server-Integration testen
4. [ ] Frontend-Komponenten hinzufügen

### Kurzfristig (Diese Woche)

1. [ ] Auth-Integration vervollständigen
2. [ ] Tests schreiben
3. [ ] Dokumentation aktualisieren
4. [ ] Docker-Compose anpassen

### Langfristig (Diesen Monat)

1. [ ] Produktions-Deployment planen
2. [ ] Monitoring einrichten
3. [ ] Performance optimieren
4. [ ] Custom Agents definieren

---

## Support

Bei Fragen oder Problemen:

1. README.md im `agent-teams/` Ordner lesen
2. INTEGRATION_GUIDE.md konsultieren
3. Code-Beispiele in dieser Datei prüfen
4. Logs auf Fehler untersuchen

---

**Status:** ✅ Alle Integrations-Dateien erstellt

**Bereit für:** Sofortige Integration in OpenCode

**Geschätzte Zeit:** 10-30 Minuten je nach Erfahrung
