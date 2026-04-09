import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArtifactList } from '../../../src/components/artifacts/ArtifactList';

// Mock modules
const mockArtifactList = vi.fn();

vi.mock('../../../src/api/client', () => ({
  artifactApi: {
    list: (...args: unknown[]) => mockArtifactList(...args),
  },
}));

vi.mock('../../../src/store/companyStore', () => ({
  useCompanyStore: vi.fn(() => ({
    teams: [
      { teamId: 'team-1', name: 'Backend Team' },
      { teamId: 'team-2', name: 'Frontend Team' },
    ],
  })),
}));

const mockArtifacts = [
  {
    artifactId: 'art-1',
    type: 'TechnicalSpec',
    title: 'API Specification',
    description: 'REST API design document',
    status: 'Approved',
    version: '1.0',
    ownerTeamId: 'team-1',
    ownerAgentId: 'agent-1',
    sourceWorkItemId: 'work-1',
    content: '## API Design',
    contentHash: null,
    storageUri: null,
    approvalState: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
  {
    artifactId: 'art-2',
    type: 'DocumentationDraft',
    title: 'User Guide',
    description: 'End user documentation',
    status: 'Draft',
    version: '0.5',
    ownerTeamId: 'team-2',
    ownerAgentId: null,
    sourceWorkItemId: 'work-2',
    content: null,
    contentHash: null,
    storageUri: null,
    approvalState: null,
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z',
  },
];

describe('ArtifactList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArtifactList.mockResolvedValue({
      data: { data: mockArtifacts },
    });
  });

  it('renders artifact list header', async () => {
    render(<ArtifactList />);

    await waitFor(() => {
      expect(screen.getByText('Artifacts')).toBeInTheDocument();
      expect(screen.getByText('Documents and deliverables')).toBeInTheDocument();
    });
  });

  it('renders New Artifact button', async () => {
    render(<ArtifactList />);

    await waitFor(() => {
      expect(screen.getByText('New Artifact')).toBeInTheDocument();
    });
  });

  it('renders artifact list after loading', async () => {
    render(<ArtifactList />);

    await waitFor(() => {
      expect(screen.getByText('API Specification')).toBeInTheDocument();
      expect(screen.getByText('User Guide')).toBeInTheDocument();
    });
  });

  it('displays artifact type badges', async () => {
    render(<ArtifactList />);

    await waitFor(() => {
      expect(screen.getByText('Technical Spec')).toBeInTheDocument();
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });
  });

  it('displays artifact status', async () => {
    render(<ArtifactList />);

    await waitFor(() => {
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });
  });

  it('displays version numbers', async () => {
    render(<ArtifactList />);

    await waitFor(() => {
      expect(screen.getByText('v1.0')).toBeInTheDocument();
      expect(screen.getByText('v0.5')).toBeInTheDocument();
    });
  });

  it('displays team names', async () => {
    render(<ArtifactList />);

    await waitFor(() => {
      expect(screen.getByText('Backend Team')).toBeInTheDocument();
      expect(screen.getByText('Frontend Team')).toBeInTheDocument();
    });
  });

  it('filters artifacts by search query', async () => {
    const user = userEvent.setup();
    render(<ArtifactList />);

    await waitFor(() => {
      expect(screen.getByText('API Specification')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search artifacts...');
    await user.type(searchInput, 'API');

    // Should only show API Specification
    expect(screen.getByText('API Specification')).toBeInTheDocument();
    expect(screen.queryByText('User Guide')).not.toBeInTheDocument();
  });

  it('filters artifacts by type', async () => {
    render(<ArtifactList />);

    await waitFor(() => {
      expect(screen.getByText('API Specification')).toBeInTheDocument();
    });

    const typeSelect = screen.getByDisplayValue('All Types');
    fireEvent.change(typeSelect, { target: { value: 'TechnicalSpec' } });

    await waitFor(() => {
      expect(mockArtifactList).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'TechnicalSpec' })
      );
    });
  });

  it('accepts workItemId prop', async () => {
    render(<ArtifactList workItemId="work-1" />);

    await waitFor(() => {
      expect(mockArtifactList).toHaveBeenCalledWith(
        expect.objectContaining({ workItemId: 'work-1' })
      );
    });
  });

  it('handles API error gracefully', async () => {
    mockArtifactList.mockRejectedValue(new Error('Failed to load artifacts'));

    render(<ArtifactList />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load artifacts')).toBeInTheDocument();
    });
  });

  it('displays empty state when no artifacts', async () => {
    mockArtifactList.mockResolvedValue({
      data: { data: [] },
    });

    render(<ArtifactList />);

    await waitFor(() => {
      expect(screen.getByText('No artifacts found')).toBeInTheDocument();
    });
  });
});
