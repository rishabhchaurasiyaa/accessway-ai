import React, { useState, useEffect } from 'react';
import { ReportingService } from '@/services/reportingService';
import { getGraphVersion, ApiError } from '@/services/api';
import { AccessibilityReport } from '@/types/incident';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Check,
  RotateCcw,
  AlertTriangle,
  Lock,
  Unlock,
  Key,
  LogOut,
  GitBranch
} from 'lucide-react';

export const AdminPage: React.FC = () => {
  // Session & Authentication State
  const [adminToken, setAdminToken] = useState<string>('');
  const [isTokenVerified, setIsTokenVerified] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Reports Queue State
  const [reports, setReports] = useState<AccessibilityReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending_review' | 'verified' | 'rejected'>('all');

  // Moderation Action State
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Confirmation Modal / Dialog State
  const [confirmingAction, setConfirmingAction] = useState<{
    report: AccessibilityReport;
    action: 'verify' | 'reject';
  } | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');

  // Graph Freshness State
  const [campusGraphVersion, setCampusGraphVersion] = useState<number | null>(null);

  // Fetch initial graph version
  const fetchCurrentGraphVersion = async () => {
    try {
      const data = await getGraphVersion();
      setCampusGraphVersion(data.graph_version);
    } catch {
      // Non-blocking for graph version display
    }
  };

  useEffect(() => {
    fetchCurrentGraphVersion();
  }, []);

  // Authenticate Admin Access with Backend GET /api/v1/admin/reports
  const handleAuthenticate = async (tokenToUse?: string) => {
    const token = (tokenToUse !== undefined ? tokenToUse : adminToken).trim();
    if (!token) {
      setAuthError('Authentication required: Please enter an administrator JWT access token.');
      setIsTokenVerified(false);
      setReports([]);
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);
    setActionError(null);
    setActionSuccess(null);

    try {
      const liveReports = await ReportingService.fetchAdminReports(token, selectedFilter);
      setReports(liveReports);
      setIsTokenVerified(true);
      setActionSuccess('Administrator token verified successfully. Report queue loaded from live backend.');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setIsTokenVerified(false);
      setReports([]);
      if (apiErr.statusCode === 401) {
        setAuthError('Authentication failed: Invalid or expired administrator JWT token (HTTP 401).');
      } else if (apiErr.statusCode === 403) {
        setAuthError('Forbidden: This token lacks administrator privileges (HTTP 403).');
      } else {
        setAuthError(apiErr.message || 'Failed to authenticate with backend reports endpoint.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Logout / Clear session
  const handleLogout = () => {
    setAdminToken('');
    setIsTokenVerified(false);
    setReports([]);
    setAuthError(null);
    setActionError(null);
    setActionSuccess(null);
  };

  // Refresh reports using active admin credentials
  const refreshReports = async () => {
    if (!adminToken.trim()) {
      setActionError('Authentication required: Admin token is missing.');
      return;
    }

    setIsLoadingReports(true);
    setActionError(null);
    try {
      const refreshed = await ReportingService.fetchAdminReports(adminToken, selectedFilter);
      setReports(refreshed);
      setActionSuccess('Queue refreshed from live database.');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.statusCode === 401) {
        setIsTokenVerified(false);
        setActionError('Session expired. Please re-enter your administrator token.');
      } else {
        setActionError(apiErr.message || 'Failed to refresh reports from backend.');
      }
    } finally {
      setIsLoadingReports(false);
    }
  };

  // Re-fetch when filter changes if authenticated
  useEffect(() => {
    if (isTokenVerified && adminToken.trim()) {
      refreshReports();
    }
  }, [selectedFilter]);

  // Open confirmation dialog before mutating report
  const handleInitiateModeration = (report: AccessibilityReport, action: 'verify' | 'reject') => {
    setConfirmingAction({ report, action });
    setResolutionNote(
      action === 'verify'
        ? 'Barrier verified on site by facilities staff. Asset updated in routing graph.'
        : 'Inspection complete. No physical barrier found; report dismissed.'
    );
  };

  // Execute confirmed moderation action
  const handleExecuteModeration = async () => {
    if (!confirmingAction) return;

    const { report, action } = confirmingAction;
    setIsProcessing(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      if (!adminToken.trim()) {
        throw new Error('Authentication required: Admin token is missing.');
      }

      const updated = await ReportingService.moderateReport(
        report.id,
        action,
        resolutionNote,
        adminToken
      );

      // Update report in current state with authoritative server data
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

      // Increment and refresh campus graph version immediately
      await fetchCurrentGraphVersion();

      setActionSuccess(
        `Report ${report.id} successfully ${action === 'verify' ? 'verified' : 'rejected'}. Target asset operational status updated and graph version incremented. Active navigation sessions will prompt users to recalculate routes.`
      );
      setConfirmingAction(null);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.statusCode === 401) {
        setIsTokenVerified(false);
        setActionError('Moderation rejected: Authentication token expired or invalid (HTTP 401).');
      } else if (apiErr.statusCode === 403) {
        setActionError('Moderation rejected: Administrator privileges required (HTTP 403).');
      } else if (apiErr.statusCode === 404) {
        setActionError(`Report ${report.id} was not found on the backend (HTTP 404). It may have been removed.`);
        await refreshReports();
      } else {
        setActionError(apiErr.message || `Failed to ${action} report on backend.`);
      }
      setConfirmingAction(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Metrics calculation
  const totalCount = reports.length;
  const pendingCount = reports.filter((r) => r.status === 'pending_review').length;
  const verifiedCount = reports.filter((r) => r.status === 'verified').length;
  const rejectedCount = reports.filter((r) => r.status === 'rejected').length;

  const filteredReports = reports.filter((r) => {
    if (selectedFilter === 'all') return true;
    return r.status === selectedFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
            <ShieldAlert className="w-4 h-4 text-purple-600" aria-hidden="true" />
            <span>Campus Facilities Security Portal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-brand-navy mt-1 tracking-tight">
            Accessibility Review &amp; Dispatch
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Authoritative moderation for user-submitted barriers, broken lifts, and dynamic routing updates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Graph State Indicator */}
          {campusGraphVersion !== null && (
            <div className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800">
              <GitBranch className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <span>Graph v{campusGraphVersion}</span>
            </div>
          )}

          {/* Refresh Queue Button */}
          <button
            type="button"
            onClick={refreshReports}
            disabled={isProcessing || isLoadingReports || !isTokenVerified}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-white border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action"
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${isLoadingReports || isProcessing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Administrator Authentication Panel */}
      <section
        aria-labelledby="auth-panel-heading"
        className={`border-2 rounded-2xl p-5 sm:p-6 transition-all shadow-sm ${
          isTokenVerified
            ? 'bg-emerald-50/40 border-emerald-300'
            : 'bg-brand-surface border-brand-border'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isTokenVerified
                  ? 'bg-emerald-100 text-brand-success'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isTokenVerified ? (
                <Unlock className="w-5 h-5 text-emerald-700" aria-hidden="true" />
              ) : (
                <Lock className="w-5 h-5 text-slate-600" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2 id="auth-panel-heading" className="text-sm font-bold text-brand-navy flex items-center gap-2">
                <span>Administrator Authentication</span>
                {isTokenVerified && (
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                    Active Session Verified
                  </span>
                )}
              </h2>
              <p className="text-xs text-brand-muted mt-0.5">
                {isTokenVerified
                  ? 'Authenticated. Authorized to verify hazards, dismiss reports, and increment campus graph versions.'
                  : 'Enter a valid administrator JWT token to access and moderate the live campus report queue.'}
              </p>
            </div>
          </div>

          {/* Token Input & Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {!isTokenVerified ? (
              <>
                <div className="relative min-w-[280px] sm:min-w-[340px]">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    value={adminToken}
                    onChange={(e) => setAdminToken(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAuthenticate();
                      }
                    }}
                    placeholder="Enter admin JWT Bearer token..."
                    className="w-full h-11 pl-9 pr-3 bg-white border border-slate-300 rounded-xl text-xs font-mono text-brand-navy focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 focus:outline-none"
                    aria-label="Administrator JWT Token"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAuthenticate()}
                  disabled={isAuthenticating || !adminToken.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 min-h-[44px] rounded-xl bg-purple-700 text-white font-bold text-xs hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                >
                  {isAuthenticating ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Verify Access</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Disconnect Session</span>
              </button>
            )}
          </div>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div
            role="alert"
            className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-brand-danger font-medium flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{authError}</span>
          </div>
        )}
      </section>

      {/* Action Feedback Messages */}
      {actionSuccess && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-xs font-semibold text-emerald-950 flex items-start gap-2.5 shadow-xs"
        >
          <CheckCircle2 className="w-5 h-5 text-brand-success shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="block font-bold">Action Confirmed</span>
            <span>{actionSuccess}</span>
          </div>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl text-xs font-semibold text-brand-danger flex items-start gap-2.5 shadow-xs"
        >
          <AlertTriangle className="w-5 h-5 text-brand-danger shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="block font-bold">Action Failed</span>
            <span>{actionError}</span>
          </div>
        </div>
      )}

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Reports</span>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-brand-navy mt-2">{totalCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Logged accessibility incidents</p>
        </div>

        <div className="bg-brand-surface border border-amber-300 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-600" aria-hidden="true" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-950 mt-2">{pendingCount}</div>
          <p className="text-[11px] text-amber-800 mt-1">Awaiting physical verification</p>
        </div>

        <div className="bg-brand-surface border border-emerald-300 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Verified Hazards</span>
            <CheckCircle2 className="w-4 h-4 text-brand-success" aria-hidden="true" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-950 mt-2">{verifiedCount}</div>
          <p className="text-[11px] text-emerald-800 mt-1">Excluded from safe routing</p>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dismissed</span>
            <XCircle className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-700 mt-2">{rejectedCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Restored to available service</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-brand-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 mr-1" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-3.5 py-1.5 min-h-[44px] text-xs font-bold rounded-xl transition-colors ${
              selectedFilter === 'all'
                ? 'bg-brand-navy text-white'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Reports ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('pending_review')}
            className={`px-3.5 py-1.5 min-h-[44px] text-xs font-bold rounded-xl transition-colors ${
              selectedFilter === 'pending_review'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-50'
            }`}
          >
            Pending Review ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('verified')}
            className={`px-3.5 py-1.5 min-h-[44px] text-xs font-bold rounded-xl transition-colors ${
              selectedFilter === 'verified'
                ? 'bg-emerald-700 text-white'
                : 'bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            Verified ({verifiedCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('rejected')}
            className={`px-3.5 py-1.5 min-h-[44px] text-xs font-bold rounded-xl transition-colors ${
              selectedFilter === 'rejected'
                ? 'bg-slate-700 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>
      </div>

      {/* Reports Queue List */}
      <section aria-labelledby="queue-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="queue-heading" className="text-base font-bold text-brand-navy">
            Incident Moderation Queue
          </h2>
          {isTokenVerified && (
            <span className="text-xs text-slate-500">Live authoritative database synchronization</span>
          )}
        </div>

        {/* State: Unauthenticated */}
        {!isTokenVerified ? (
          <div className="bg-brand-surface border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center space-y-3">
            <Lock className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
            <h3 className="text-sm font-bold text-brand-navy">Administrator Authentication Required</h3>
            <p className="text-xs text-brand-muted max-w-md mx-auto leading-relaxed">
              To inspect and moderate submitted accessibility reports, authenticate using a valid
              administrator JWT token in the panel above.
            </p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-8 text-center text-slate-500">
            <p className="text-sm font-semibold">No incident reports match the selected status.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => {
              const isPending = report.status === 'pending_review';
              const isVerified = report.status === 'verified';

              return (
                <div
                  key={report.id}
                  className={`bg-brand-surface border-2 rounded-2xl p-5 sm:p-6 shadow-xs transition-all ${
                    isPending
                      ? 'border-amber-300 bg-amber-50/20'
                      : isVerified
                      ? 'border-emerald-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                          {report.id}
                        </span>

                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            isPending
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : isVerified
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-slate-100 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {report.status.replace('_', ' ')}
                        </span>

                        <span className="text-xs font-bold text-brand-action bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 uppercase">
                          {report.issue_type.replace('_', ' ')}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-brand-navy">{report.description}</p>

                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-4 pt-1">
                        <span>
                          Target: <strong className="font-mono text-slate-700">{report.target_id}</strong> (
                          {report.target_type})
                        </span>
                        <span>
                          Reported: {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                          • {new Date(report.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {report.resolution_note && (
                        <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                          <strong>Admin Resolution Note:</strong> {report.resolution_note}
                        </div>
                      )}
                    </div>

                    {/* Moderation Action Buttons (Only for Pending Reports) */}
                    {isPending && (
                      <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                        <button
                          type="button"
                          onClick={() => handleInitiateModeration(report, 'verify')}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1 px-3.5 py-2 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Verify Hazard</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleInitiateModeration(report, 'reject')}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1 px-3.5 py-2 min-h-[44px] bg-white border border-red-300 text-brand-danger hover:bg-red-50 rounded-xl text-xs font-bold transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Dismiss</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Confirmation Modal */}
      {confirmingAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  confirmingAction.action === 'verify'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3 id="confirm-dialog-title" className="text-base font-black text-brand-navy">
                  Confirm {confirmingAction.action === 'verify' ? 'Hazard Verification' : 'Report Dismissal'}
                </h3>
                <p className="text-xs text-slate-600">
                  {confirmingAction.action === 'verify'
                    ? 'Verifying this barrier will immediately exclude the asset from all certified step-free paths and increment the campus graph version.'
                    : 'Dismissing this report restores normal operational availability for the asset and increments the campus graph version.'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
              <p>
                <strong>Report ID:</strong> <span className="font-mono">{confirmingAction.report.id}</span>
              </p>
              <p>
                <strong>Issue:</strong> {confirmingAction.report.issue_type.replace('_', ' ').toUpperCase()}
              </p>
              <p>
                <strong>Description:</strong> {confirmingAction.report.description}
              </p>
            </div>

            <div>
              <label
                htmlFor="resolution-note"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Inspection &amp; Resolution Note <span className="text-brand-danger">*</span>
              </label>
              <textarea
                id="resolution-note"
                rows={3}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Enter audit trail explanation for facilities record..."
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-brand-navy focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmingAction(null)}
                disabled={isProcessing}
                className="px-4 py-2 min-h-[44px] rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteModeration}
                disabled={isProcessing}
                className={`inline-flex items-center gap-1.5 px-5 py-2 min-h-[44px] rounded-xl text-white font-bold text-xs transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 ${
                  confirmingAction.action === 'verify'
                    ? 'bg-emerald-700 hover:bg-emerald-800 focus-visible:ring-emerald-500'
                    : 'bg-brand-danger hover:bg-red-800 focus-visible:ring-red-400'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm {confirmingAction.action === 'verify' ? 'Verification' : 'Dismissal'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
