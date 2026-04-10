import React from 'react';
import { useAgentTeams, useCurrentTeam } from '../context/AgentTeamsContext';
import { TaskList } from './TaskList';

/**
 * TeamDashboard - Main dashboard for agent team coordination
 */

export function TeamDashboard() {
  const { members, isConnected, unreadCount, createTask, spawnAgent } = useAgentTeams();

  const currentTeam = useCurrentTeam();
  const [showCreateTask, setShowCreateTask] = React.useState(false);
  const [showSpawnAgent, setShowSpawnAgent] = React.useState(false);

  if (!currentTeam) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Team Selected</h2>
          <p className="text-gray-500 mb-4">
            Create a team or join an existing one to start collaborating.
          </p>
          <button
            onClick={() => {
              /* Navigate to team creation */
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Team
          </button>
        </div>
      </div>
    );
  }

  const activeMembers = members.filter((m) => m.isActive);
  const leadMember = members.find((m) => m.isLeader);

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{currentTeam.teamName}</h1>
            {currentTeam.description && (
              <p className="text-sm text-gray-500 mt-1">{currentTeam.description}</p>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className="text-gray-600">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>

            {/* Unread Messages */}
            {unreadCount > 0 && (
              <div className="relative">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {unreadCount} new message{unreadCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateTask(true)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                + New Task
              </button>
              <button
                onClick={() => setShowSpawnAgent(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                + Spawn Agent
              </button>
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-gray-500">Team:</span>
          <div className="flex -space-x-2">
            {activeMembers.map((member) => (
              <div
                key={member.agentId}
                className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
                style={{ backgroundColor: member.color || '#999' }}
                title={`${member.name}${member.isLeader ? ' (Lead)' : ''}`}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          <span className="text-sm text-gray-500 ml-2">
            {activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Task List */}
        <div className="w-1/3 border-r border-gray-200 overflow-hidden">
          <TaskList />
        </div>

        {/* Center: Activity Feed */}
        <div className="flex-1 bg-white overflow-hidden">
          <ActivityFeed />
        </div>

        {/* Right: Member Status */}
        <div className="w-64 bg-gray-50 border-l border-gray-200 overflow-y-auto">
          <MemberStatus members={activeMembers} />
        </div>
      </div>

      {/* Modals */}
      {showCreateTask && <CreateTaskModal onClose={() => setShowCreateTask(false)} />}
      {showSpawnAgent && <SpawnAgentModal onClose={() => setShowSpawnAgent(false)} />}
    </div>
  );
}

/**
 * Activity Feed Component
 */
function ActivityFeed() {
  const { lastEvent, messages } = useAgentTeams();

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Activity Feed</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Recent messages */}
        {messages.slice(0, 20).map((message, idx) => (
          <div
            key={message.messageId || idx}
            className={`p-3 rounded-lg ${
              message.messageType === 'broadcast'
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium">
                {message.fromAgentName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{message.fromAgentName}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1">{message.summary || message.content}</p>
              </div>
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p>No activity yet.</p>
            <p className="text-sm mt-1">Team messages and events will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Member Status Component
 */
function MemberStatus({ members }: { members: any[] }) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Team Members</h3>

      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.agentId}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
              style={{ backgroundColor: member.color || '#999' }}
            >
              {member.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-medium text-sm truncate">{member.name}</span>
                {member.isLeader && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                    Lead
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {member.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            {member.planModeRequired && (
              <span className="text-xs text-blue-600" title="Plan mode required">
                📋
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Create Task Modal
 */
function CreateTaskModal({ onClose }: { onClose: () => void }) {
  const { createTask } = useAgentTeams();
  const [subject, setSubject] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description) return;

    setIsSubmitting(true);
    try {
      await createTask(subject, description);
      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Create New Task</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief task title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-none"
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !subject || !description}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Spawn Agent Modal
 */
function SpawnAgentModal({ onClose }: { onClose: () => void }) {
  const { spawnAgent } = useAgentTeams();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [prompt, setPrompt] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !prompt || !description) return;

    setIsSubmitting(true);
    try {
      await spawnAgent(name, prompt, description);
      onClose();
    } catch (error) {
      console.error('Failed to spawn agent:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Spawn New Agent</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., security-reviewer"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Short description (3-5 words)"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-40 resize-none"
              placeholder="Detailed instructions for the agent..."
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name || !prompt || !description}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Spawning...' : 'Spawn Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
