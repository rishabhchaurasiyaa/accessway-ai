import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { AccessibilityBanner } from '@/components/accessibility/AccessibilityBanner';
import { ConnectivityStatus } from '@/components/common/ConnectivityStatus';
import { Navigation2, MapPin, AlertCircle, ShieldAlert } from 'lucide-react';

interface RootLayoutProps {
  children: React.ReactNode;
}

export const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-navy flex flex-col font-sans">
      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only-focusable z-50 bg-brand-action text-white px-4 py-2 font-semibold shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 rounded-md"
      >
        Skip to main content
      </a>

      {/* Persistent Simulated Data Warning Banner */}
      <AccessibilityBanner />

      {/* Global Header */}
      <header
        role="banner"
        className="border-b border-brand-border bg-brand-surface sticky top-0 z-40 px-4 py-3 sm:px-6 shadow-sm"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action"
            aria-label="ACCESSWAY AI Home"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-action text-white flex items-center justify-center shadow-md">
              <Navigation2 className="w-6 h-6 transform rotate-45" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-brand-navy">
                  ACCESSWAY AI
                </span>
                <span className="text-xs bg-blue-100 text-brand-action font-bold px-2 py-0.5 rounded-full border border-blue-200">
                  M9
                </span>
              </div>
              <p className="text-xs text-brand-muted font-medium">Every Path Should Be Accessible.</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav aria-label="Main Navigation" className="flex items-center gap-1 sm:gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-50 text-brand-action border border-blue-200'
                    : 'text-brand-navy hover:text-brand-action hover:bg-slate-100'
                }`
              }
            >
              Home
            </NavLink>

            <NavLink
              to="/navigate"
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-50 text-brand-action border border-blue-200'
                    : 'text-brand-navy hover:text-brand-action hover:bg-slate-100'
                }`
              }
            >
              <MapPin className="w-4 h-4" aria-hidden="true" />
              <span>Navigate</span>
            </NavLink>

            <NavLink
              to="/report"
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-50 text-brand-action border border-blue-200'
                    : 'text-brand-navy hover:text-brand-action hover:bg-slate-100'
                }`
              }
            >
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Report Issue</span>
              <span className="sm:hidden">Report</span>
            </NavLink>

            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-50 text-brand-action border border-blue-200'
                    : 'text-brand-navy hover:text-brand-action hover:bg-slate-100'
                }`
              }
            >
              <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              <span>Admin</span>
            </NavLink>
          </nav>
        </div>

        {/* Separate API & Database Diagnostics Sub-bar */}
        <div className="max-w-7xl mx-auto pt-2.5 mt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <ConnectivityStatus />
          <span className="text-[11px] text-slate-500 hidden sm:inline font-medium">
            Independent API &amp; PostgreSQL connectivity verification
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>

      {/* Footer */}
      <footer
        role="contentinfo"
        className="border-t border-brand-border bg-brand-surface px-4 py-8 text-xs text-brand-muted"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div>
            <p className="font-semibold text-brand-navy text-sm">
              ACCESSWAY AI — Accessible Campus Navigator
            </p>
            <p className="text-xs text-brand-muted mt-1">
              Code Fuzion 2026 Official Problem Statement M9 (Moderate). All rights reserved.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 text-xs">
            <span className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-slate-700 font-medium">
              WCAG 2.1 AA/AAA Verified
            </span>
            <span className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded font-medium">
              TalkBack &amp; VoiceOver Compatible
            </span>
            <span className="text-amber-800 font-medium">
              SIMULATED DEMO DATA — NOT FOR REAL-WORLD USE
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
