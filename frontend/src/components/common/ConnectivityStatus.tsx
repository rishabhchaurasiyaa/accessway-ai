import React, { useState, useEffect, useCallback, useRef } from 'react';
import { checkHealth, HealthStatusResponse } from '@/services/api';
import {
  Server,
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RotateCcw,
  Loader2
} from 'lucide-react';

export type ApiConnectionState = 'checking' | 'online' | 'offline';
export type DbConnectionState =
  | 'checking'
  | 'connected'
  | 'disconnected'
  | 'not_configured'
  | 'unavailable'
  | 'unknown';


interface ConnectivityStatusProps {
  /** Optional polling interval in ms (defaults to 30000ms / 30s). Set to 0 to disable automatic polling. */
  pollIntervalMs?: number;
  /** Compact presentation mode for constrained header view */
  compact?: boolean;
}

export const ConnectivityStatus: React.FC<ConnectivityStatusProps> = ({
  pollIntervalMs = 30000,
  compact = false
}) => {
  const [apiState, setApiState] = useState<ApiConnectionState>('checking');
  const [dbState, setDbState] = useState<DbConnectionState>('checking');
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  const inFlightRef = useRef<boolean>(false);

  const executeHealthCheck = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsRefreshing(true);

    try {
      const data: HealthStatusResponse = await checkHealth();
      if (!isMountedRef.current) return;

      // 1. API Status Determination: Successful response from /health means API is Online
      setApiState('online');

      // 2. Database Status Determination:
      // Allowed to be 'connected' ONLY when database_status === 'connected'
      // Never inferred from API availability alone.
      const rawDbStatus = data?.database_status;
      if (rawDbStatus === 'connected') {
        setDbState('connected');
        setDatabaseError(null);
      } else if (rawDbStatus === 'disconnected') {
        setDbState('disconnected');
        setDatabaseError(data?.database_error || 'Database connection unreachable');
      } else if (rawDbStatus === 'not_configured') {
        setDbState('not_configured');
        setDatabaseError(data?.database_error || 'DATABASE_URL contains placeholder credentials');
      } else {
        // Unknown or missing database status must never be reported as connected
        setDbState('unknown');
        setDatabaseError('Unknown database status returned by server');
      }

      setLastChecked(new Date());
    } catch (err: unknown) {
      if (!isMountedRef.current) return;

      // When GET /api/v1/health fails because backend is unreachable or times out:
      // API Status must show: API Offline
      setApiState('offline');
      // Database Status must show: DB Status Unavailable (do NOT show DB Disconnected)
      setDbState('unavailable');

      const msg = err instanceof Error ? err.message : 'Backend service unreachable';
      setDatabaseError(msg);
      setLastChecked(new Date());
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    executeHealthCheck();

    if (pollIntervalMs > 0) {
      const intervalId = window.setInterval(() => {
        executeHealthCheck();
      }, pollIntervalMs);

      return () => {
        isMountedRef.current = false;
        window.clearInterval(intervalId);
      };
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [executeHealthCheck, pollIntervalMs]);

  // Semantic styling configurations
  const getApiBadge = () => {
    switch (apiState) {
      case 'online':
        return {
          label: 'API Online',
          bg: 'bg-emerald-50 text-emerald-900 border-emerald-300',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-brand-success shrink-0" aria-hidden="true" />,
          ariaText: 'API server is online and operational.'
        };
      case 'offline':
        return {
          label: 'API Offline',
          bg: 'bg-red-50 text-brand-danger border-red-300',
          icon: <XCircle className="w-3.5 h-3.5 text-brand-danger shrink-0" aria-hidden="true" />,
          ariaText: 'API server is offline or unreachable at the configured URL.'
        };
      default:
        return {
          label: 'API Checking...',
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          icon: <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin shrink-0" aria-hidden="true" />,
          ariaText: 'Checking API server connectivity.'
        };
    }
  };

  const getDbBadge = () => {
    switch (dbState) {
      case 'connected':
        return {
          label: 'DB Connected',
          bg: 'bg-emerald-50 text-emerald-900 border-emerald-300',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-brand-success shrink-0" aria-hidden="true" />,
          ariaText: 'PostgreSQL database connection verified and operational.'
        };
      case 'disconnected':
        return {
          label: 'DB Disconnected',
          bg: 'bg-amber-50 text-amber-900 border-amber-300',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-brand-warning shrink-0" aria-hidden="true" />,
          ariaText: `Database connection is disconnected${databaseError ? ': ' + databaseError : ''}.`
        };
      case 'unavailable':
        return {
          label: 'DB Status Unavailable',
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: <HelpCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />,
          ariaText: 'Database status is unavailable because the API server is offline.'
        };
      case 'not_configured':
        return {
          label: 'DB Not Configured',
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: <HelpCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />,
          ariaText: 'Database is not configured (placeholder credentials detected).'
        };
      case 'unknown':
        return {
          label: 'DB Status Unknown',
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          icon: <HelpCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />,
          ariaText: 'Database connection status is unknown.'
        };
      default:
        return {
          label: 'DB Checking...',
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          icon: <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin shrink-0" aria-hidden="true" />,
          ariaText: 'Checking database connection status.'
        };
    }
  };

  const apiBadge = getApiBadge();
  const dbBadge = getDbBadge();

  return (
    <div
      role="region"
      aria-label="System Connectivity Diagnostics"
      className="flex flex-wrap items-center gap-2 text-xs"
    >
      {/* Live region for screen readers */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {apiBadge.ariaText} {dbBadge.ariaText}
      </span>

      {/* API Status Badge */}
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-bold ${apiBadge.bg} transition-colors`}
        title={`FastAPI Gateway: ${apiBadge.label}`}
      >
        <Server className="w-3 h-3 opacity-70 shrink-0" aria-hidden="true" />
        {apiBadge.icon}
        <span>{apiBadge.label}</span>
      </div>

      {/* Database Status Badge */}
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-bold ${dbBadge.bg} transition-colors`}
        title={
          databaseError
            ? `Database: ${dbBadge.label} (${databaseError})`
            : `Database: ${dbBadge.label}`
        }
      >
        <Database className="w-3 h-3 opacity-70 shrink-0" aria-hidden="true" />
        {dbBadge.icon}
        <span>{dbBadge.label}</span>
      </div>

      {/* Manual Refresh Button (Accessible touch target >= 44x44px) */}
      <button
        type="button"
        onClick={() => executeHealthCheck()}
        disabled={isRefreshing}
        aria-label="Refresh API and database connection status"
        className="inline-flex items-center justify-center p-2.5 min-h-[44px] min-w-[44px] rounded-lg text-slate-600 hover:text-brand-action hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action disabled:opacity-50"
        title={lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Check connection'}
      >
        <RotateCcw
          className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-action' : ''}`}
          aria-hidden="true"
        />
        <span className="sr-only">Refresh Status</span>
      </button>

      {/* Timestamp subtext (hidden in compact mode) */}
      {!compact && lastChecked && (
        <span className="hidden xl:inline text-[11px] text-slate-500 font-medium">
          Updated {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      )}
    </div>
  );
};
