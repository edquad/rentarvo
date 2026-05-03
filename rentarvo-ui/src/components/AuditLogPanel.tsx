import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { History, ChevronDown, ChevronUp } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: any;
  afterJson: any;
  createdAt: string;
  user: { name: string; email: string };
}

interface Props {
  entityType: string;
  entityId: string;
}

function formatAction(action: string): string {
  const verbs: Record<string, string> = { create: 'Created', update: 'Updated', delete: 'Deleted' };
  const parts = action.split('.');
  if (parts.length === 2) {
    const verb = verbs[parts[1]] || parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    const entity = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return `${verb} ${entity}`;
  }
  return action
    .replace(/_/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function AuditLogPanel({ entityType, entityId }: Props) {
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', entityType, entityId],
    queryFn: () =>
      api.get<{ data: AuditLog[]; total: number }>(
        `/audit-logs?entityType=${entityType}&entityId=${entityId}&limit=20`
      ),
  });

  const logs: AuditLog[] = data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="border rounded-lg">
          <button
            onClick={() => setExpanded(expanded === log.id ? null : log.id)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-gray-50"
          >
            <div className="flex items-center gap-2 text-left">
              <span className="font-medium">{formatAction(log.action)}</span>
              <span className="text-gray-400">by {log.user?.name || 'System'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span title={new Date(log.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'long' })}>{timeAgo(log.createdAt)}</span>
              {(log.beforeJson || log.afterJson) && (
                expanded === log.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />
              )}
            </div>
          </button>
          {expanded === log.id && (log.beforeJson || log.afterJson) && (
            <div className="px-3 pb-3 text-xs">
              {log.beforeJson && (
                <div className="mb-1">
                  <span className="text-gray-400">Before:</span>
                  <pre className="mt-0.5 bg-red-50 p-2 rounded text-red-700 overflow-x-auto max-h-32">
                    {JSON.stringify(log.beforeJson, null, 2)}
                  </pre>
                </div>
              )}
              {log.afterJson && (
                <div>
                  <span className="text-gray-400">After:</span>
                  <pre className="mt-0.5 bg-green-50 p-2 rounded text-green-700 overflow-x-auto max-h-32">
                    {JSON.stringify(log.afterJson, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
