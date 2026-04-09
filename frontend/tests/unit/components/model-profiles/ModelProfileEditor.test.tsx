import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModelProfileEditor, type ModelProfile, type ModelProfileFormData } from '@/components/model-profiles/ModelProfileEditor';

// Mock react-hook-form
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn((name: string) => ({ name })),
    handleSubmit: (fn: (data: unknown) => void) => (e: Event) => {
      e.preventDefault();
      fn({
        name: 'Test Profile',
        description: 'Test description',
        modelId: 'claude-sonnet-4',
        temperature: 0.7,
        maxTokens: 4096,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        systemPrompt: '',
        reasoningBudget: 0,
        extendedThinking: false,
        responseFormat: 'text',
        costLimitPerTask: 1.00,
        costLimitPerDay: 10.00,
        timeLimitPerTask: 300,
        isDefault: false,
      });
    },
    control: {},
    watch: vi.fn((field: string) => {
      const values: Record<string, unknown> = {
        modelId: 'claude-sonnet-4',
        maxTokens: 4096,
        temperature: 0.7,
        reasoningBudget: 0,
        responseFormat: 'text',
        costLimitPerTask: 1.00,
        costLimitPerDay: 10.00,
        timeLimitPerTask: 300,
        extendedThinking: false,
        isDefault: false,
      };
      return values[field];
    }),
    setValue: vi.fn(),
    formState: {
      errors: {},
      isDirty: true,
      isSubmitting: false,
    },
  }),
  Controller: ({ render }: { render: (props: { field: { onChange: () => void; value: unknown } }) => JSX.Element }) =>
    render({ field: { onChange: vi.fn(), value: 0.7 } }),
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: vi.fn(() => vi.fn()),
}));

vi.mock('zod', () => ({
  z: {
    object: vi.fn(() => ({
      optional: vi.fn(() => ({})),
      default: vi.fn(() => ({})),
    })),
    string: vi.fn(() => ({
      min: vi.fn(() => ({ max: vi.fn(() => ({ optional: vi.fn(() => ({})) })) })),
    })),
    enum: vi.fn(() => ({})),
    number: vi.fn(() => ({
      min: vi.fn(() => ({ max: vi.fn(() => ({ default: vi.fn(() => ({})) })) })),
    })),
    boolean: vi.fn(() => ({ default: vi.fn(() => ({})) })),
  },
}));

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

  it('displays save button in create mode', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Create Profile')).toBeInTheDocument();
  });

  it('displays save button in edit mode', () => {
    render(
      <ModelProfileEditor
        profile={mockProfile}
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Update Profile')).toBeInTheDocument();
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

  it('displays system prompt textarea', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('System Prompt')).toBeInTheDocument();
  });

  it('displays profile name input', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Profile Name')).toBeInTheDocument();
  });

  it('displays description input', () => {
    render(
      <ModelProfileEditor
        companyId="comp-123"
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Description')).toBeInTheDocument();
  });
});
