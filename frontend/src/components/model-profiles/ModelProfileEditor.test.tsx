import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelProfileEditor, type ModelProfile, type ModelProfileFormData } from './ModelProfileEditor';

const mockProfile: ModelProfile = {
  profileId: 'profile-1',
  companyId: 'comp-123',
  name: 'Code Review Assistant',
  description: 'Optimized for code review tasks',
  modelId: 'claude-sonnet-4',
  temperature: 0.5,
  maxTokens: 4096,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  systemPrompt: 'You are a code review assistant.',
  reasoningBudget: 4000,
  extendedThinking: true,
  responseFormat: 'text',
  costLimitPerTask: 1.00,
  costLimitPerDay: 10.00,
  timeLimitPerTask: 300,
  isDefault: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('ModelProfileEditor', () => {
  const mockHandlers = {
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create mode header when no profile provided', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Create Model Profile')).toBeInTheDocument();
    expect(screen.getByText('Configure AI model settings and cost limits')).toBeInTheDocument();
  });

  it('renders edit mode header when profile provided', () => {
    render(
      <ModelProfileEditor
        profile={mockProfile}
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Edit Model Profile')).toBeInTheDocument();
  });

  it('renders all tabs', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
  });

  it('displays model selection cards', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Claude Opus 4')).toBeInTheDocument();
    expect(screen.getByText('Claude Sonnet 4')).toBeInTheDocument();
    expect(screen.getByText('Claude Haiku 4')).toBeInTheDocument();
    expect(screen.getByText('GPT-4o')).toBeInTheDocument();
    expect(screen.getByText('GPT-4o Mini')).toBeInTheDocument();
    expect(screen.getByText('Gemini Pro')).toBeInTheDocument();
  });

  it('displays model prices', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('$15.00/1K')).toBeInTheDocument();
    expect(screen.getByText('$3.00/1K')).toBeInTheDocument();
    expect(screen.getByText('$0.25/1K')).toBeInTheDocument();
  });

  it('allows selecting a model', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    const modelCard = screen.getByText('Claude Opus 4').closest('label');
    expect(modelCard).toBeInTheDocument();

    if (modelCard) {
      fireEvent.click(modelCard);
    }

    // Model should be selected (check for checkmark icon)
    expect(modelCard?.querySelector('svg')).toBeInTheDocument();
  });

  it('validates required name field', async () => {
    const user = userEvent.setup();
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    // Try to submit without name
    const nameInput = screen.getByPlaceholderText('e.g., Code Review Assistant');
    await user.clear(nameInput);

    const saveButton = screen.getByText('Create Profile');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });

  it('validates name max length', async () => {
    const user = userEvent.setup();
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    const nameInput = screen.getByPlaceholderText('e.g., Code Review Assistant');
    await user.type(nameInput, 'a'.repeat(101));

    const saveButton = screen.getByText('Create Profile');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Name too long')).toBeInTheDocument();
    });
  });

  it('populates form with profile data in edit mode', () => {
    render(
      <ModelProfileEditor
        profile={mockProfile}
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    // Check that the name is populated
    const nameInput = screen.getByDisplayValue('Code Review Assistant');
    expect(nameInput).toBeInTheDocument();

    // Check description
    expect(screen.getByDisplayValue('Optimized for code review tasks')).toBeInTheDocument();

    // Check system prompt
    expect(screen.getByDisplayValue('You are a code review assistant.')).toBeInTheDocument();
  });

  it('displays cost estimation', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Cost Estimation')).toBeInTheDocument();
    expect(screen.getByText('per request (estimated)')).toBeInTheDocument();
  });

  it('displays temperature slider', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    // Switch to Advanced tab
    const advancedTab = screen.getByText('Advanced');
    fireEvent.click(advancedTab);

    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('Precise (0)')).toBeInTheDocument();
    expect(screen.getByText('Balanced (1)')).toBeInTheDocument();
    expect(screen.getByText('Creative (2)')).toBeInTheDocument();
  });

  it('displays max tokens input', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    // Switch to Advanced tab
    const advancedTab = screen.getByText('Advanced');
    fireEvent.click(advancedTab);

    expect(screen.getByText('Max Tokens')).toBeInTheDocument();
  });

  it('shows reasoning budget for Claude models', () => {
    render(
      <ModelProfileEditor
        profile={mockProfile}
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    // Switch to Advanced tab
    const advancedTab = screen.getByText('Advanced');
    fireEvent.click(advancedTab);

    expect(screen.getByText('Reasoning Budget')).toBeInTheDocument();
  });

  it('shows response format options', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    // Switch to Advanced tab
    const advancedTab = screen.getByText('Advanced');
    fireEvent.click(advancedTab);

    expect(screen.getByText('Response Format')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('JSON Object')).toBeInTheDocument();
    expect(screen.getByText('JSON Schema')).toBeInTheDocument();
  });

  it('displays cost limits in cost tab', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    // Switch to Cost tab
    const costTab = screen.getByText('Cost');
    fireEvent.click(costTab);

    expect(screen.getByText('Cost Limit Per Task ($)')).toBeInTheDocument();
    expect(screen.getByText('Daily Cost Limit ($)')).toBeInTheDocument();
    expect(screen.getByText('Time Limit Per Task (seconds)')).toBeInTheDocument();
  });

  it('displays cost control tips', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    // Switch to Cost tab
    const costTab = screen.getByText('Cost');
    fireEvent.click(costTab);

    expect(screen.getByText('Cost Control Tips')).toBeInTheDocument();
    expect(screen.getByText(/Set lower limits for experimental/)).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockHandlers.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with form data when save button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    // Fill in the name
    const nameInput = screen.getByPlaceholderText('e.g., Code Review Assistant');
    await user.type(nameInput, 'Test Profile');

    // Fill in description
    const descriptionInput = screen.getByPlaceholderText('Brief description of this profile\'s purpose...');
    await user.type(descriptionInput, 'Test description');

    // Click save
    const saveButton = screen.getByText('Create Profile');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockHandlers.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Profile',
          description: 'Test description',
          modelId: 'claude-sonnet-4',
        })
      );
    });
  });

  it('displays save button disabled when no changes', () => {
    render(
      <ModelProfileEditor
        profile={mockProfile}
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    const saveButton = screen.getByText('Update Profile');
    expect(saveButton).toBeDisabled();
  });

  it('displays unsaved changes indicator', async () => {
    const user = userEvent.setup();
    render(
      <ModelProfileEditor
        profile={mockProfile}
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    // Initially should show "All changes saved"
    expect(screen.getByText('All changes saved')).toBeInTheDocument();

    // Make a change
    const nameInput = screen.getByDisplayValue('Code Review Assistant');
    await user.type(nameInput, ' Modified');

    // Should now show "Unsaved changes"
    await waitFor(() => {
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });
  });

  it('allows setting as default profile', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    const defaultCheckbox = screen.getByLabelText('Set as Default Profile');
    expect(defaultCheckbox).toBeInTheDocument();

    fireEvent.click(defaultCheckbox);
    expect(defaultCheckbox).toBeChecked();
  });

  it('displays extended thinking option', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    // Switch to Advanced tab
    const advancedTab = screen.getByText('Advanced');
    fireEvent.click(advancedTab);

    expect(screen.getByLabelText('Extended Thinking')).toBeInTheDocument();
    expect(screen.getByText('Enable step-by-step reasoning for complex tasks')).toBeInTheDocument();
  });

  it('closes editor when X button clicked', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    const closeButton = screen.getByRole('button', { name: '' }); // X button has no text
    fireEvent.click(closeButton);

    expect(mockHandlers.onCancel).toHaveBeenCalledTimes(1);
  });
});
