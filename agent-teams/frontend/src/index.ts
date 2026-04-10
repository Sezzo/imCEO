/**
 * Agent Teams Frontend - React Components
 */

// Context
export {
  AgentTeamsProvider,
  useAgentTeams,
  useCurrentTeam,
  useTeamTasks,
  useTeamMessages,
} from './context/AgentTeamsContext';

// Components
export { TeamDashboard } from './components/TeamDashboard';
export { TaskList } from './components/TaskList';

// Types
export type {
  Team,
  TeamMember,
  Task,
  Message,
  AgentSession,
  AgentTeamsContextType,
} from './context/AgentTeamsContext';
