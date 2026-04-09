import { useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  Filter,
  Search,
  Clock,
  AlertTriangle,
  Info,
  CheckCircle,
  X,
  ChevronRight,
  Mail,
  BellRing,
  BellOff,
  Pin,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'system';
export type NotificationCategory = 'task' | 'delegation' | 'review' | 'approval' | 'cost' | 'system' | 'security';

interface Notification {
  notificationId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  pinned: boolean;
  link?: string;
  linkText?: string;
  metadata?: {
    workItemId?: string;
    agentId?: string;
    cost?: number;
    priority?: string;
  };
}

interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  soundEnabled: boolean;
  categories: Record<NotificationCategory, { enabled: boolean; minPriority: 'low' | 'medium' | 'high' }>;
}

interface NotificationCenterProps {
  notifications: Notification[];
  preferences: NotificationPreferences;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (notificationId: string) => void;
  onClearAll: () => void;
  onTogglePin: (notificationId: string) => void;
  onUpdatePreferences: (preferences: NotificationPreferences) => void;
}

const TYPE_CONFIG: Record<NotificationType, { icon: React.ReactNode; color: string; bg: string }> = {
  info: { icon: <Info className="w-4 h-4" />, color: 'text-blue-600', bg: 'bg-blue-100' },
  success: { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-600', bg: 'bg-green-100' },
  warning: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-100' },
  error: { icon: <X className="w-4 h-4" />, color: 'text-red-600', bg: 'bg-red-100' },
  system: { icon: <Bell className="w-4 h-4" />, color: 'text-purple-600', bg: 'bg-purple-100' },
};

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  task: 'Tasks',
  delegation: 'Delegations',
  review: 'Reviews',
  approval: 'Approvals',
  cost: 'Cost Alerts',
  system: 'System',
  security: 'Security',
};

export function NotificationCenter({
  notifications,
  preferences,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onClearAll,
  onTogglePin,
  onUpdatePreferences,
}: NotificationCenterProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'pinned'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<NotificationCategory | 'all'>('all');
  const [filterType, setFilterType] = useState<NotificationType | 'all'>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;
  const pinnedCount = notifications.filter((n) => n.pinned).length;

  const filteredNotifications = notifications.filter((notification) => {
    const matchesSearch =
      !searchTerm ||
      notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = filterCategory === 'all' || notification.category === filterCategory;
    const matchesType = filterType === 'all' || notification.type === filterType;
    const matchesTab =
      activeTab === 'all' ? true :
      activeTab === 'unread' ? !notification.read :
      activeTab === 'pinned' ? notification.pinned :
      true;

    return matchesSearch && matchesCategory && matchesType && matchesTab;
  });

  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = new Date(notification.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let group: string;
    if (date.toDateString() === today.toDateString()) {
      group = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      group = 'Yesterday';
    } else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      group = 'This Week';
    } else {
      group = 'Earlier';
    }

    if (!groups[group]) groups[group] = [];
    groups[group].push(notification);
    return groups;
  }, {} as Record<string, Notification[]>);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-2xl max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-pink-50 to-rose-50">
        <div className="flex items-center gap-3">
          <div className="relative p-2 bg-pink-100 rounded-lg">
            <Bell className="w-5 h-5 text-pink-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            <p className="text-sm text-gray-500">
              {unreadCount} unread • {notifications.length} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={onMarkAllAsRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 text-sm"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-4">Notification Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.emailEnabled}
                  onChange={(e) => onUpdatePreferences({ ...preferences, emailEnabled: e.target.checked })}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                />
                <span className="text-sm text-gray-700">Email notifications</span>
                <Mail className="w-4 h-4 text-gray-400" />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.pushEnabled}
                  onChange={(e) => onUpdatePreferences({ ...preferences, pushEnabled: e.target.checked })}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                />
                <span className="text-sm text-gray-700">Push notifications</span>
                <BellRing className="w-4 h-4 text-gray-400" />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preferences.soundEnabled}
                  onChange={(e) => onUpdatePreferences({ ...preferences, soundEnabled: e.target.checked })}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                />
                <span className="text-sm text-gray-700">Sound</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="px-4 py-3 border-b border-gray-200 space-y-3">
        <div className="flex gap-1">
          {(['all', 'unread', 'pinned'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize',
                activeTab === tab
                  ? 'bg-pink-100 text-pink-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {tab}
              {tab === 'unread' && unreadCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  {unreadCount}
                </span>
              )}
              {tab === 'pinned' && pinnedCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {pinnedCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 text-sm"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as NotificationCategory | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as NotificationType | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
          >
            <option value="all">All Types</option>
            {Object.keys(TYPE_CONFIG).map((key) => (
              <option key={key} value={key} className="capitalize">{key}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <BellOff className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No notifications to display</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {Object.entries(groupedNotifications).map(([group, items]) => (
              <div key={group}>
                <div className="px-4 py-2 bg-gray-50 sticky top-0 z-10">
                  <span className="text-xs font-medium text-gray-500 uppercase">{group}</span>
                </div>
                {items.map((notification) => {
                  const typeConfig = TYPE_CONFIG[notification.type];

                  return (
                    <div
                      key={notification.notificationId}
                      className={clsx(
                        'group flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors',
                        !notification.read && 'bg-pink-50/30'
                      )}
                    >
                      {/* Icon */}
                      <div className={clsx('p-2 rounded-lg flex-shrink-0', typeConfig.bg)}>
                        <span className={typeConfig.color}>{typeConfig.icon}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className={clsx(
                              'font-medium text-sm',
                              !notification.read ? 'text-gray-900' : 'text-gray-600'
                            )}>
                              {notification.title}
                            </h4>
                            <p className="text-sm text-gray-600 mt-0.5">{notification.message}</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => onTogglePin(notification.notificationId)}
                              className={clsx(
                                'p-1 rounded',
                                notification.pinned ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'
                              )}
                            >
                              <Pin className={clsx('w-4 h-4', notification.pinned && 'fill-current')} />
                            </button>
                            {!notification.read && (
                              <button
                                onClick={() => onMarkAsRead(notification.notificationId)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => onDelete(notification.notificationId)}
                              className="p-1 text-gray-400 hover:text-red-500 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                          </span>
                          <span className="text-xs text-gray-400">
                            {CATEGORY_LABELS[notification.category]}
                          </span>
                          {notification.link && (
                            <a
                              href={notification.link}
                              className="text-xs text-pink-600 hover:text-pink-700 flex items-center gap-1"
                            >
                              {notification.linkText || 'View'}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {filteredNotifications.length} of {notifications.length} notifications
        </span>
        <button
          onClick={onClearAll}
          className="text-sm text-red-600 hover:text-red-700"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}

// Compact notification bell for navbar
interface NotificationBellProps {
  count: number;
  onClick: () => void;
}

export function NotificationBell({ count, onClick }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 hover:bg-gray-100 rounded-lg text-gray-600"
    >
      <Bell className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
