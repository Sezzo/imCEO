/**
 * useTeamEvents Hook
 *
 * React hook for subscribing to team events in components.
 * Handles subscription lifecycle and cleanup.
 */

import { useEffect, useCallback } from 'react';
import { teamManager } from '../../services/team/team-manager.js';
import type { TeamEvent, TeamEventHandler } from '../../services/team/types.js';

/**
 * Subscribe to events for a specific team
 */
export function useTeamEvents(teamId: string, handler: (event: TeamEvent) => void): void {
  const wrappedHandler: TeamEventHandler = useCallback(
    (event: TeamEvent) => {
      // Only handle events for this team (or global events)
      if (event.teamId === teamId || event.teamId === '*') {
        handler(event);
      }
    },
    [teamId, handler]
  );

  useEffect(() => {
    // Subscribe to team events
    const unsubscribe = teamManager.onEvent(wrappedHandler);

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [wrappedHandler]);
}

/**
 * Subscribe to all team events
 */
export function useAllTeamEvents(handler: (event: TeamEvent) => void): () => void {
  return teamManager.onEvent(handler);
}

/**
 * Get current team status reactively
 */
export function useTeamStatus(teamId: string) {
  const getStatus = useCallback(() => {
    return teamManager.getTeamStatus(teamId);
  }, [teamId]);

  return { getStatus };
}
