/**
 * Team Creation Wizard Component
 *
 * Interactive wizard for creating new agent teams.
 * Guides users through team setup with templates or custom configuration.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import type { ToolUseContext } from '../../Tool.js';
import type { AgentConfig, AgentRole } from '../../services/team/types.js';
import { teamQuickSetup } from '../../commands/team/index.js';

interface TeamCreationWizardProps {
  context: ToolUseContext;
  onComplete?: (result: string) => void;
  onCancel?: () => void;
}

type WizardStep = 'template' | 'name' | 'custom-config' | 'confirm' | 'complete';

interface WizardState {
  step: WizardStep;
  template?: 'dev' | 'review' | 'research' | 'custom';
  name: string;
  agents: Omit<AgentConfig, 'id'>[];
  error?: string;
  result?: string;
}

export function TeamCreationWizard({
  context,
  onComplete,
  onCancel,
}: TeamCreationWizardProps): JSX.Element {
  const { exit } = useApp();
  const [state, setState] = useState<WizardState>({
    step: 'template',
    name: '',
    agents: [],
  });

  // Handle cancel
  useInput((input, key) => {
    if (key.escape) {
      onCancel?.();
      exit();
    }
  });

  const handleTemplateSelect = useCallback((item: { value: WizardState['template'] }) => {
    if (item.value === 'custom') {
      setState((prev) => ({ ...prev, step: 'custom-config', template: 'custom' }));
    } else {
      setState((prev) => ({ ...prev, step: 'name', template: item.value }));
    }
  }, []);

  const handleNameSubmit = useCallback(
    (name: string) => {
      if (!name.trim()) {
        setState((prev) => ({ ...prev, error: 'Name is required' }));
        return;
      }

      setState((prev) => ({ ...prev, name, error: undefined }));

      if (state.template && state.template !== 'custom') {
        // Use template
        setState((prev) => ({ ...prev, step: 'confirm' }));
      }
    },
    [state.template]
  );

  const handleConfirm = useCallback(
    async (confirmed: boolean) => {
      if (!confirmed) {
        setState((prev) => ({ ...prev, step: 'template' }));
        return;
      }

      try {
        let result: string;

        if (state.template && state.template !== 'custom') {
          result = await teamQuickSetup(state.template, state.name, context);
        } else {
          // Custom team creation would go here
          result = 'Custom team creation not yet implemented in wizard.';
        }

        setState((prev) => ({ ...prev, step: 'complete', result }));
        onComplete?.(result);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: `Failed to create team: ${error}`,
          step: 'template',
        }));
      }
    },
    [state.template, state.name, context, onComplete]
  );

  // Render based on current step
  switch (state.step) {
    case 'template':
      return (
        <Box flexDirection="column">
          <Text bold>Select Team Template</Text>
          {state.error && (
            <Box marginY={1}>
              <Text color="red">{state.error}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: 'Development Team (Dev + Reviewer + Tester)', value: 'dev' },
                { label: 'Review Team (Primary + Security Reviewer)', value: 'review' },
                { label: 'Research Team (Lead + Analyst + Fact Checker)', value: 'research' },
                { label: 'Custom Configuration', value: 'custom' },
              ]}
              onSelect={handleTemplateSelect}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press ESC to cancel</Text>
          </Box>
        </Box>
      );

    case 'name':
      return (
        <Box flexDirection="column">
          <Text bold>Enter Team Name</Text>
          <Text dimColor>Template: {state.template}</Text>
          <Box marginY={1}>
            <TextInput
              value={state.name}
              onChange={(value) => setState((prev) => ({ ...prev, name: value }))}
              onSubmit={handleNameSubmit}
              placeholder="My Team"
            />
          </Box>
          {state.error && <Text color="red">{state.error}</Text>}
        </Box>
      );

    case 'custom-config':
      return (
        <Box flexDirection="column">
          <Text bold>Custom Team Configuration</Text>
          <Text>Custom configuration wizard is not fully implemented.</Text>
          <Text>Please use the CLI commands for custom team setup:</Text>
          <Box marginY={1}>
            <Text color="blue">/team create &lt;name&gt; --agents [...]</Text>
          </Box>
          <Text dimColor>Press ESC to cancel</Text>
        </Box>
      );

    case 'confirm':
      return (
        <Box flexDirection="column">
          <Text bold>Confirm Team Creation</Text>
          <Box marginY={1}>
            <Text>Name: {state.name}</Text>
            <Text>Template: {state.template}</Text>
          </Box>
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: 'Create Team', value: true },
                { label: 'Go Back', value: false },
              ]}
              onSelect={(item) => handleConfirm(item.value as boolean)}
            />
          </Box>
        </Box>
      );

    case 'complete':
      return (
        <Box flexDirection="column">
          <Text bold color="green">
            Team Created Successfully!
          </Text>
          <Box marginY={1}>
            <Text>{state.result}</Text>
          </Box>
          <Text dimColor>Press any key to exit</Text>
        </Box>
      );

    default:
      return <Text>Unknown step</Text>;
  }
}
