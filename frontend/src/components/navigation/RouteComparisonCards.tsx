import React from 'react';
import { RouteCalculateResponse } from '@/types/navigation';
import {
  Clock,
  Navigation2,
  Accessibility,
  Zap,
  AlertOctagon,
  CheckCircle,
  Footprints,
  ArrowUpDown,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface RouteComparisonCardsProps {
  calculation: RouteCalculateResponse | null;
  activeMode: 'fastest' | 'step_free';
  onSelectMode: (mode: 'fastest' | 'step_free') => void;
  isLoading?: boolean;
  isStale?: boolean;
  latestGraphVersion?: number | null;
  onRecalculate?: () => void;
}

export const RouteComparisonCards: React.FC<RouteComparisonCardsProps> = ({
  calculation,
  activeMode,
  onSelectMode,
  isLoading = false,
  isStale = false,
  latestGraphVersion,
  onRecalculate
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true">
        <div className="h-44 bg-white border border-brand-border rounded-2xl animate-pulse p-6">
          <div className="h-5 w-32 bg-slate-200 rounded mb-4"></div>
          <div className="h-8 w-24 bg-slate-200 rounded mb-2"></div>
          <div className="h-4 w-48 bg-slate-200 rounded"></div>
        </div>
        <div className="h-44 bg-white border border-brand-border rounded-2xl animate-pulse p-6">
          <div className="h-5 w-32 bg-slate-200 rounded mb-4"></div>
          <div className="h-8 w-24 bg-slate-200 rounded mb-2"></div>
          <div className="h-4 w-48 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!calculation) {
    return null;
  }

  const fastest = calculation.routes.fastest;
  const stepFree = calculation.routes.step_free;

  const formatSeconds = (sec?: number | null) => {
    if (sec === undefined || sec === null) return '--';
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    if (mins === 0) return `${remainingSec}s`;
    return remainingSec > 0 ? `${mins}m ${remainingSec}s` : `${mins} min`;
  };

  return (
    <div
      role="region"
      aria-label="Route Comparison Options"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider">
            Route Options Calculated
          </h3>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-brand-action border border-blue-200">
            Verified Routing Engine
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
            isStale
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}>
            Graph v{calculation.graph_version}
            {isStale && latestGraphVersion ? ` (Server v${latestGraphVersion})` : ''}
          </span>
        </div>
        <span className="text-xs text-brand-muted">
          Select preferred profile below
        </span>
      </div>

      {/* Stale route notification banner */}
      {isStale && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs font-bold text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
            <span>
              <strong>Route information changed. Recalculate before continuing.</strong>
              {latestGraphVersion !== undefined && latestGraphVersion !== null && (
                <span className="font-normal ml-1">
                  (Route generated on Graph v{calculation.graph_version}, but server is now on Graph v{latestGraphVersion})
                </span>
              )}
            </span>
          </div>
          {onRecalculate && (
            <button
              type="button"
              onClick={onRecalculate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition-colors shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Recalculate Now</span>
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fastest Route Card */}
        <button
          type="button"
          onClick={() => onSelectMode('fastest')}
          disabled={!fastest?.available}
          aria-pressed={activeMode === 'fastest'}
          className={`text-left p-5 rounded-2xl border-2 transition-all relative focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 ${
            activeMode === 'fastest'
              ? 'border-brand-action bg-blue-50/70 shadow-md ring-2 ring-brand-action/20'
              : 'border-brand-border bg-brand-surface hover:border-slate-400 shadow-sm'
          } ${!fastest?.available ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-100 text-brand-action">
                <Zap className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-action block">
                  Time-Optimized
                </span>
                <h4 className="text-base font-extrabold text-brand-navy">Fastest Route</h4>
              </div>
            </div>

            {activeMode === 'fastest' && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-action bg-white px-2 py-0.5 rounded-full border border-blue-200">
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                Active
              </span>
            )}
          </div>

          {fastest?.available ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-black text-brand-navy">
                  {formatSeconds(fastest.estimated_seconds)}
                </span>
                <span className="text-sm font-medium text-slate-600">
                  {fastest.distance_m ?? '--'} meters total
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                  <Clock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  {fastest.estimated_seconds}s
                </span>

                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                  <Footprints className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                  Stairs: {fastest.stairs_count ?? 0} steps
                </span>

                {(fastest.lifts_count ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                    <ArrowUpDown className="w-3.5 h-3.5 text-brand-action" aria-hidden="true" />
                    Elevator transit
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-brand-danger font-medium flex items-start gap-2">
              <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{fastest?.reason || 'No connecting route found.'}</span>
            </div>
          )}
        </button>

        {/* Step-Free Route Card */}
        <button
          type="button"
          onClick={() => onSelectMode('step_free')}
          disabled={!stepFree?.available}
          aria-pressed={activeMode === 'step_free'}
          className={`text-left p-5 rounded-2xl border-2 transition-all relative focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300 ${
            activeMode === 'step_free'
              ? 'border-brand-teal bg-teal-50/70 shadow-md ring-2 ring-brand-teal/20'
              : 'border-brand-border bg-brand-surface hover:border-slate-400 shadow-sm'
          } ${!stepFree?.available ? 'opacity-90 cursor-not-allowed bg-amber-50/40' : 'cursor-pointer'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-teal-100 text-brand-teal">
                <Accessibility className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-teal block">
                  Mobility Verified
                </span>
                <h4 className="text-base font-extrabold text-brand-navy">Step-Free Route</h4>
              </div>
            </div>

            {activeMode === 'step_free' && stepFree?.available && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-teal bg-white px-2 py-0.5 rounded-full border border-teal-200">
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                Active
              </span>
            )}
          </div>

          {stepFree?.available ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-black text-brand-navy">
                  {formatSeconds(stepFree.estimated_seconds)}
                </span>
                <span className="text-sm font-medium text-slate-600">
                  {stepFree.distance_m ?? '--'} meters total
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-teal-200 text-brand-teal">
                  <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  0 Stairs (Strictly Verified)
                </span>

                {(stepFree.ramps_count ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                    <Navigation2 className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />
                    {stepFree.ramps_count} Accessible Ramp(s)
                  </span>
                )}

                {(stepFree.lifts_count ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                    <ArrowUpDown className="w-3.5 h-3.5 text-brand-teal" aria-hidden="true" />
                    {stepFree.lifts_count} Elevator Transit
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3.5 bg-amber-100/90 border border-amber-300 rounded-xl text-xs text-amber-950 font-medium flex items-start gap-2.5 shadow-sm">
              <AlertOctagon className="w-5 h-5 text-brand-warning shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold text-brand-warning text-sm">
                  No verified step-free route is currently available.
                </p>
                <p className="mt-1 text-slate-700">
                  All available paths to this destination require stairs or pass through currently
                  blocked elevators. A step-free route cannot be safely completed at this time.
                </p>
              </div>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};
