/**
 * Team Services Module
 *
 * Central export point for all team-related services.
 */

// Core Services
export { teamManager, TeamManager } from './team-manager.js';
export { agentRouter, AgentRouter } from './agent-router.js';
export { coordinationEngine, TeamCoordinationEngine } from './coordination-engine.js';
export { teamConfig, TeamConfigurationManager } from './team-config.js';

// Types
export type * from './types.js';

// Configuration Types
export type { TeamTemplate, StoredTeamConfig, TeamsConfigFile } from './team-config.js';
