import React from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  Volume2,
  Footprints,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Building2,
  ArrowRight,
  Info,
  MapPin
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section
        aria-labelledby="hero-heading"
        className="text-center pt-8 sm:pt-14 pb-8 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="space-y-6">
          {/* Target Campus Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-brand-navy border border-blue-200 text-xs font-bold tracking-wide shadow-xs">
            <span className="w-2 h-2 rounded-full bg-brand-action"></span>
            <span>Target Campus: Lovely Professional University (LPU)</span>
          </div>

          <h1
            id="hero-heading"
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-brand-navy tracking-tight leading-tight"
          >
            Accessible Campus Navigation{' '}
            <span className="text-brand-action block sm:inline">for Everyone.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-700 max-w-2xl mx-auto leading-relaxed">
            Indoor and outdoor accessible routing for university campuses. Prioritizes certified
            step-free wheelchair paths, spoken turn-by-turn landmark directions, and dynamic
            hazard rerouting.
          </p>

          {/* Call-to-Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/navigate"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-brand-action text-white font-bold text-base shadow hover:bg-blue-700 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
            >
              <span>Explore Route Planner</span>
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </Link>

            <Link
              to="/report"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-white border-2 border-brand-navy text-brand-navy font-bold text-base shadow-sm hover:bg-slate-50 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300"
            >
              <AlertTriangle className="w-5 h-5 text-brand-warning" aria-hidden="true" />
              <span>Report an Issue</span>
            </Link>
          </div>

          {/* Status & Authorization Notice */}
          <div className="pt-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-950 text-left font-medium max-w-xl mx-auto">
              <Info className="w-4 h-4 text-brand-action shrink-0" aria-hidden="true" />
              <span>
                <strong>Campus Survey Notice:</strong> ACCESSWAY AI is targeted for deployment at Lovely Professional University (LPU). Official campus floor plans, building maps, and physical surveys are pending institutional authorization. Real campus navigation is disabled until verified infrastructure data is provisioned.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Feature Highlights */}
      <section aria-labelledby="features-heading" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 id="features-heading" className="text-2xl sm:text-3xl font-extrabold text-brand-navy">
            Core Accessibility Capabilities
          </h2>
          <p className="text-sm text-brand-muted mt-2">
            Engineered to fulfill all requirements of Code Fuzion 2026 Problem Statement M9
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Feature 1 */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-200 text-brand-action flex items-center justify-center mb-5">
              <Compass className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-brand-navy mb-2">
              Dual-Routing Engine (Fastest vs. Step-Free)
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              Provides side-by-side comparison of time-optimized routes and 100% verified step-free
              paths. If no step-free route exists due to broken lifts or stairs-only access, it
              honestly alerts you rather than silently routing through barriers.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-brand-teal">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>Zero-step wheelchair path verification</span>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-teal-100 border border-teal-200 text-brand-teal flex items-center justify-center mb-5">
              <Volume2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-brand-navy mb-2">
              Inclusive Navigation &amp; Spoken Audio
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              Native screen reader accessibility designed for TalkBack and VoiceOver. Includes
              integrated Web Speech API for on-demand spoken directions with strict user control (no
              disruptive autoplay).
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-brand-teal">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>TalkBack, VoiceOver &amp; Web Speech API ready</span>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 text-brand-success flex items-center justify-center mb-5">
              <Footprints className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-brand-navy mb-2">
              Landmark-Based Step Guidance
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              Physical landmarks (fountains, tactile floor tiles, information desks,
              braille elevator panels) anchor instructions so visually impaired users can navigate
              confidently without estimating meter distances.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-brand-success">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>Sensory &amp; physical landmarks at every turning point</span>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 text-brand-warning flex items-center justify-center mb-5">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-brand-navy mb-2">
              Crowdsourced Reporting &amp; Admin Verification
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              Students report broken lifts or blocked ramps in seconds. Campus administrators review
              and verify reports in an audit queue, automatically invalidating outdated routes and
              protecting travelers from hazards.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-brand-warning">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>Verified dynamic rerouting &amp; safety controls</span>
            </div>
          </div>
        </div>
      </section>

      {/* Real-World Deployment Roadmap Section */}
      <section aria-labelledby="deployment-heading" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-semibold text-blue-300">
              <Building2 className="w-4 h-4" aria-hidden="true" />
              <span>Campus Deployment Roadmap</span>
            </div>
            <h2 id="deployment-heading" className="text-2xl sm:text-3xl font-extrabold text-white">
              Target Campus: Lovely Professional University (LPU)
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              The ACCESSWAY AI routing engine, database schema, and accessibility protocols are fully built and validated. Real-world navigation will activate as authorized physical infrastructure data is ingested through our three-step onboarding pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-3">
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded border border-blue-800">
                Phase 1: Authorization
              </span>
              <h3 className="text-base font-bold text-white">Architectural Blueprint Ingestion</h3>
              <p className="text-xs text-slate-300">
                Securing official administrative permission and importing authorized CAD/BIM floor plans, building footprints, and indoor corridor layouts.
              </p>
              <div className="pt-2 text-xs text-amber-400 font-medium">
                Pending Institutional Authorization
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-3">
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded border border-blue-800">
                Phase 2: Field Survey
              </span>
              <h3 className="text-base font-bold text-white">Accessibility Ground-Truth Audit</h3>
              <p className="text-xs text-slate-300">
                Physical ground survey verifying door clear widths (&gt;80cm), ramp slopes (&lt;8.33%), elevator door clearances, tactile paving, and acoustic landmarks.
              </p>
              <div className="pt-2 text-xs text-blue-400 font-medium">
                Survey Standards Established
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-3">
              <span className="text-xs font-mono font-bold text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded border border-blue-800">
                Phase 3: Activation
              </span>
              <h3 className="text-base font-bold text-white">Verified Graph Deployment</h3>
              <p className="text-xs text-slate-300">
                Deploying surveyed nodes and edges to the canonical PostgreSQL graph engine with automated GeoJSON generation and real-time incident tracking.
              </p>
              <div className="pt-2 text-xs text-emerald-400 font-medium">
                Routing Engine Production-Ready
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/navigate"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-action text-white text-sm font-bold shadow hover:bg-blue-600 transition-colors"
            >
              <MapPin className="w-4 h-4" aria-hidden="true" />
              <span>View Route Planner Interface</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
