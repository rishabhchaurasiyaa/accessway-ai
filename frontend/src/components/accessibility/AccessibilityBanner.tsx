import React from 'react';
import { Info, ShieldCheck } from 'lucide-react';

export const AccessibilityBanner: React.FC = () => {
  return (
    <aside
      aria-label="Campus Survey & Deployment Notice"
      className="bg-blue-50 border-b border-blue-200 text-blue-950 px-4 py-2.5 text-xs sm:text-sm font-medium"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-brand-action shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-bold tracking-wide text-brand-navy">
              Target Campus: Lovely Professional University (LPU).
            </strong>{' '}
            Official campus floor plans, building maps, and physical surveys are pending authorization. Live navigation is disabled until verified infrastructure data is provisioned.
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs bg-white/90 border border-blue-200 px-3 py-1 rounded-full text-slate-800 shadow-sm font-semibold shrink-0">
          <ShieldCheck className="w-4 h-4 text-brand-success" aria-hidden="true" />
          <span>Code Fuzion 2026 — Problem Statement M9</span>
        </div>
      </div>
    </aside>
  );
};
