import React, { useState, useEffect } from 'react';
import { RouteResult } from '@/types/navigation';
import { useSpeechNavigation } from '@/hooks/useSpeechNavigation';
import {
  Volume2,
  Square,
  VolumeX,
  Compass,
  MapPin,
  AlertTriangle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface DirectionsPanelProps {
  route: RouteResult | null;
  modeName: 'Fastest' | 'Step-Free';
  isStale?: boolean;
  onRecalculate?: () => void;
  routeGraphVersion?: number;
  latestGraphVersion?: number | null;
}

export const DirectionsPanel: React.FC<DirectionsPanelProps> = ({
  route,
  modeName,
  isStale = false,
  onRecalculate,
  routeGraphVersion,
  latestGraphVersion
}) => {
  const { isSupported, isSpeaking, currentSpeakingIndex, speak, speakSequence, stop } =
    useSpeechNavigation();

  const [activeStep, setActiveStep] = useState<number>(1);

  // Stop active speech if the route becomes stale during navigation
  useEffect(() => {
    if (isStale && isSpeaking) {
      stop();
    }
  }, [isStale, isSpeaking, stop]);

  if (!route || !route.available || !route.steps || route.steps.length === 0) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 text-center text-slate-500 space-y-2">
        <Compass className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
        <h4 className="text-sm font-bold text-slate-700">No Active Directions</h4>
        <p className="text-xs max-w-sm mx-auto">
          Select an origin and destination above, then click &ldquo;Calculate Route&rdquo; to
          generate landmark-guided turn-by-turn directions.
        </p>
      </div>
    );
  }

  const handleSpeakAll = () => {
    if (!route.steps) return;
    speakSequence(
      route.steps.map((s) => ({
        step: s.step,
        speech_text: s.speech_text
      }))
    );
  };

  return (
    <section
      aria-labelledby="directions-heading"
      className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-5"
    >
      {/* Header and Voice Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isStale ? 'bg-amber-500' : modeName === 'Step-Free' ? 'bg-brand-teal' : 'bg-brand-action'
              }`}
            ></span>
            <h3 id="directions-heading" className="text-lg font-black text-brand-navy flex items-center gap-2">
              <span>Turn-by-Turn Guidance ({modeName})</span>
              {routeGraphVersion !== undefined && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  isStale ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-600'
                }`}>
                  Graph v{routeGraphVersion}
                </span>
              )}
            </h3>
          </div>
          <p className="text-xs text-brand-muted mt-0.5">
            {route.steps.length} landmark-anchored step{route.steps.length === 1 ? '' : 's'} •{' '}
            {route.distance_m ?? 0}m total
            {isStale && <strong className="text-amber-800 ml-1.5">• STALE ROUTE</strong>}
          </p>
        </div>

        {/* Web Speech API Controls (User-Triggered Only, Strictly NO Autoplay) */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSupported ? (
            <>
              {!isSpeaking ? (
                <button
                  type="button"
                  onClick={handleSpeakAll}
                  disabled={isStale}
                  className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl font-bold text-xs transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action ${
                    isStale
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : 'bg-blue-50 border border-blue-200 text-brand-action hover:bg-blue-100'
                  }`}
                  aria-label={isStale ? 'Voice directions disabled: Route information changed' : 'Speak all navigation directions'}
                  title={isStale ? 'Route information changed. Recalculate before continuing.' : 'Speak all navigation directions'}
                >
                  <Volume2 className="w-4 h-4 text-current" aria-hidden="true" />
                  <span>{isStale ? 'Audio Suspended' : 'Speak Directions'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stop}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-red-50 border border-red-200 text-brand-danger hover:bg-red-100 font-bold text-xs transition-colors shadow-xs animate-pulse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-danger"
                  aria-label="Stop audio directions"
                >
                  <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>Stop Audio</span>
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 min-h-[44px] rounded-lg">
              <VolumeX className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span>Speech API not supported</span>
            </div>
          )}
        </div>
      </div>

      {/* Freshness Invalidation Banner (Step 6) */}
      {isStale && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-xs text-amber-950 space-y-3 shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <span className="block text-sm font-black text-amber-950">
                Route information changed. Recalculate before continuing.
              </span>
              <span className="block text-amber-800 font-normal">
                The campus accessibility graph was updated on the server
                {routeGraphVersion !== undefined && latestGraphVersion
                  ? ` (Calculated with Graph v${routeGraphVersion} • Server Graph v${latestGraphVersion})`
                  : ''}
                . Active turn-by-turn guidance has been suspended to prevent navigating along outdated or altered pathways.
              </span>
            </div>
          </div>

          {onRecalculate && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onRecalculate}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Recalculate Now</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Synthetic Data Disclaimer Note */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-brand-warning shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong>Notice:</strong> Landmark cues and physical features shown below are synthetic
          demonstration placeholders. Not verified for physical real-world navigation.
        </p>
      </div>

      {/* Screen Reader Live Status Region */}
      <div className="sr-only" aria-live="polite" role="status">
        {isStale
          ? 'Route information changed. Recalculate before continuing.'
          : isSpeaking && currentSpeakingIndex
          ? `Speaking step ${currentSpeakingIndex}`
          : 'Directions ready.'}
      </div>

      {/* Landmark Steps List */}
      <ol className={`space-y-3 transition-opacity ${isStale ? 'opacity-60 pointer-events-none' : ''}`} role="list">
        {route.steps.map((step) => {
          const isSelected = activeStep === step.step;
          const isCurrentlySpeaking = currentSpeakingIndex === step.step;

          return (
            <li
              key={step.step}
              onClick={() => !isStale && setActiveStep(step.step)}
              className={`p-4 rounded-xl border-2 transition-all ${
                isCurrentlySpeaking
                  ? 'border-brand-action bg-blue-50/80 shadow-md ring-2 ring-brand-action/20'
                  : isSelected
                  ? 'border-slate-400 bg-slate-50'
                  : 'border-brand-border bg-white hover:border-slate-300'
              } ${isStale ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      isCurrentlySpeaking
                        ? 'bg-brand-action text-white ring-2 ring-blue-300'
                        : isSelected
                        ? 'bg-brand-navy text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {step.step}
                  </span>

                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-brand-navy leading-snug">
                      {step.instruction}
                    </p>

                    {step.landmark && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md w-fit">
                        <MapPin className="w-3.5 h-3.5 text-brand-warning shrink-0" aria-hidden="true" />
                        <span>
                          <strong>Synthetic Landmark:</strong> {step.landmark}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Individual Step Speaker Button (Minimum 44x44px target) */}
                {isSupported && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isStale) speak(step.speech_text, step.step);
                    }}
                    disabled={isStale}
                    className="p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-400 hover:text-brand-action hover:bg-blue-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label={`Read step ${step.step} aloud`}
                  >
                    <Volume2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="pt-2 flex items-center justify-between text-xs text-brand-muted border-t border-brand-border">
        <span>Click any step to inspect</span>
        <span className="font-semibold text-slate-600">
          Arrival Landmark: {route.steps[route.steps.length - 1]?.landmark || 'Goal reached'}
        </span>
      </div>
    </section>
  );
};
