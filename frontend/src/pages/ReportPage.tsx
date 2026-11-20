import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CampusService } from '@/services/campusService';
import { ReportingService } from '@/services/reportingService';
import { CampusBuilding, CampusNode } from '@/types/campus';
import { ReportIssueType, ReportTargetType, ReportCreateResponse } from '@/types/incident';
import {
  AlertTriangle,
  Upload,
  CheckCircle2,
  ShieldCheck,
  Camera,
  Info,
  X,
  Loader2,
  RefreshCw,
  Building2
} from 'lucide-react';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const ReportPage: React.FC = () => {
  // Dynamic Campus Data State
  const [buildings, setBuildings] = useState<CampusBuilding[]>([]);
  const [nodes, setNodes] = useState<CampusNode[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState<boolean>(true);
  const [facilitiesError, setFacilitiesError] = useState<string | null>(null);

  // Form State
  const [buildingCode, setBuildingCode] = useState<string>('');
  const [floorLabel, setFloorLabel] = useState<string>('Ground');
  const [targetType] = useState<ReportTargetType>('node');
  const [targetId, setTargetId] = useState<string>('');
  const [issueType, setIssueType] = useState<ReportIssueType>('broken_lift');
  const [description, setDescription] = useState<string>('');
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedReport, setSubmittedReport] = useState<ReportCreateResponse | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load campus buildings dynamically
  const loadBuildings = useCallback(async () => {
    setIsLoadingFacilities(true);
    setFacilitiesError(null);

    try {
      const fetched = await CampusService.fetchBuildings();
      setBuildings(fetched);
      if (fetched.length > 0) {
        setBuildingCode((prev) =>
          fetched.some((b) => b.building_code === prev) ? prev : fetched[0].building_code
        );
      } else {
        setBuildingCode('');
        setNodes([]);
        setTargetId('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Buildings service unavailable. Ensure backend is running.';
      setFacilitiesError(msg);
      setBuildings([]);
      setNodes([]);
      setTargetId('');
    } finally {
      setIsLoadingFacilities(false);
    }
  }, []);

  // Load nodes for selected building
  const loadNodes = useCallback(
    async (bCode: string) => {
      if (!bCode) {
        setNodes([]);
        setTargetId('');
        return;
      }

      const currentBldg = buildings.find((b) => b.building_code === bCode);
      if (!currentBldg?.id) {
        setNodes([]);
        setTargetId('');
        return;
      }

      try {
        const fetchedNodes = await CampusService.fetchBuildingNodes(currentBldg.id);
        setNodes(fetchedNodes);
        if (fetchedNodes.length > 0) {
          setTargetId(fetchedNodes[0].id);
        } else {
          setTargetId('');
        }
      } catch {
        setNodes([]);
        setTargetId('');
      }
    },
    [buildings]
  );

  useEffect(() => {
    loadBuildings();
  }, [loadBuildings]);

  useEffect(() => {
    if (buildingCode) {
      loadNodes(buildingCode);
    }
  }, [buildingCode, loadNodes]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }

    const file = e.target.files[0];

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setPhotoError('Invalid image type. Only JPEG, PNG, and WebP are supported.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setPhotoError('File size exceeds the 5 MB limit.');
      e.target.value = '';
      return;
    }

    setPhotoName(file.name);
  };

  const handleClearPhoto = () => {
    setPhotoName(null);
    setPhotoError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim() || description.trim().length < 3) {
      setValidationError('Please provide a descriptive explanation (minimum 3 characters).');
      return;
    }

    if (!targetId) {
      setValidationError('Please select a specific location or barrier feature.');
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      const response = await ReportingService.submitReport({
        target_type: targetType,
        target_id: targetId,
        issue_type: issueType,
        description: description.trim(),
        photo_url: null,
        building_code: buildingCode,
        floor_label: floorLabel
      });

      setSubmittedReport(response);
      setIsSubmitted(true);
    } catch (err: unknown) {
      const msg =
        (err as any)?.response?.data?.detail ||
        (err instanceof Error
          ? err.message
          : 'Failed to submit report. Please check backend connectivity and try again.');
      setValidationError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setDescription('');
    setPhotoName(null);
    setPhotoError(null);
    setIsSubmitted(false);
    setSubmittedReport(null);
    setValidationError(null);
  };

  const selectedBuilding = buildings.find((b) => b.building_code === buildingCode);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
        <div className="text-left space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-brand-warning" aria-hidden="true" />
            <span>Campus Accessibility Incident Reporting</span>
          </div>
          <h1 className="text-3xl font-black text-brand-navy tracking-tight">
            Report an Accessibility Barrier
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Submit out-of-service elevators, blocked ramps, or pathway obstructions directly to campus facilities.
          </p>
        </div>
      </div>

      {/* Verification Process Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 sm:p-6 text-sm text-slate-700 flex items-start gap-3.5 shadow-xs">
        <Info className="w-5 h-5 text-brand-action shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-brand-navy">
            Authoritative Review &amp; Routing Protocol
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            All submitted reports enter the database with <strong className="font-semibold text-amber-900">pending_review</strong> status. If a broken lift or blocked ramp is reported, the target asset is immediately set to <strong className="font-semibold text-amber-900">reported_unverified</strong>, automatically rerouting certified step-free paths around the hazard while awaiting administrator inspection.
          </p>
        </div>
      </div>

      {isSubmitted && submittedReport ? (
        /* Confirmed Server Success View */
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-8 sm:p-10 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-brand-success flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-brand-navy">Report Submitted Successfully</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Your server report reference is{' '}
              <strong className="font-mono text-brand-navy text-base">{submittedReport.id}</strong>.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 max-w-lg mx-auto text-left space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Server Report Status</span>
              <span className="text-amber-800 font-bold bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full uppercase text-[11px]">
                {submittedReport.status}
              </span>
            </div>
            <p>
              <strong>Report Reference UUID:</strong> <span className="font-mono text-[11px]">{submittedReport.id}</span>
            </p>
            <p>
              <strong>Facility Location:</strong> {buildingCode || 'N/A'} • Floor: {floorLabel}
            </p>
            <p>
              <strong>Barrier Type:</strong> {issueType.replace('_', ' ').toUpperCase()}
            </p>
            <p>
              <strong>Target Asset UUID:</strong> <span className="font-mono text-[11px]">{targetId}</span>
            </p>
            <p>
              <strong>Campus Graph Version:</strong> <span className="font-bold">v{submittedReport.graph_version}</span>
            </p>
            {photoName && (
              <p className="text-slate-500 italic">
                <strong>Photo Attachment:</strong> {photoName} (Local file validated; cloud upload not configured)
              </p>
            )}
            <p className="text-slate-600 pt-1 border-t border-slate-200">
              <strong>Server Confirmation:</strong> {submittedReport.message}
            </p>
          </div>

          {/* Broken Lift Safety Routing Banner */}
          {issueType === 'broken_lift' && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs text-amber-950 max-w-lg mx-auto text-left flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <strong className="block text-sm font-black text-amber-950">Broken Lift Routing Safety Protocol</strong>
                <span className="block text-amber-900 leading-relaxed">
                  The targeted elevator has been flagged as <code>reported_unverified</code> in the campus database. The Dijkstra routing engine will immediately exclude this lift from all certified step-free paths until a campus facilities administrator inspects and verifies repairs.
                </span>
                <span className="block text-amber-800 text-[11px] font-semibold">
                  Campus Graph Version updated to <strong>v{submittedReport.graph_version}</strong>. Active navigation sessions will prompt route recalculation.
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action"
            >
              Submit Another Report
            </button>
            <Link
              to="/admin"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-brand-action text-white font-bold text-xs shadow hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action"
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span>View Admin Review Queue</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Form View */
        <form
          onSubmit={handleSubmit}
          className="bg-brand-surface border border-brand-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-6"
        >
          {validationError && (
            <div
              role="alert"
              className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-brand-danger flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{validationError}</span>
            </div>
          )}

          {facilitiesError && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-brand-danger flex items-center justify-between gap-2"
            >
              <span><strong>Facilities Error:</strong> {facilitiesError}</span>
              <button
                type="button"
                onClick={() => loadBuildings()}
                className="px-2.5 py-1 bg-white border border-red-300 rounded text-brand-danger font-bold hover:bg-red-100 text-[11px]"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty facilities state */}
          {!isLoadingFacilities && !facilitiesError && buildings.length === 0 && (
            <div role="status" className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="text-xs font-semibold text-slate-600 max-w-md mx-auto leading-relaxed">
                No verified campus facilities are currently available for hazard reporting. Facilities will appear once authorized campus data is provisioned.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Building Selection */}
            <div>
              <label
                htmlFor="rep-building"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Building Facility <span className="text-brand-danger">*</span>
              </label>
              {isLoadingFacilities ? (
                <div className="h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-action" />
                  <span>Loading campus buildings...</span>
                </div>
              ) : (
                <select
                  id="rep-building"
                  value={buildingCode}
                  disabled={buildings.length === 0}
                  onChange={(e) => setBuildingCode(e.target.value)}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-brand-navy focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {buildings.length === 0 ? (
                    <option value="">No buildings available</option>
                  ) : (
                    buildings.map((b) => (
                      <option key={b.id} value={b.building_code}>
                        {b.building_code} — {b.name.split('(')[0].trim()}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            {/* Floor Level */}
            <div>
              <label
                htmlFor="rep-floor"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Floor Level <span className="text-brand-danger">*</span>
              </label>
              <select
                id="rep-floor"
                value={floorLabel}
                disabled={buildings.length === 0}
                onChange={(e) => setFloorLabel(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-brand-navy focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="Ground">Ground Floor</option>
                <option value="Floor 1">Floor 1 (First Floor)</option>
                {selectedBuilding?.floors?.map((f) => (
                  <option key={f.floor_label} value={f.floor_label}>
                    {f.name} ({f.floor_label})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Target Asset / Node */}
            <div>
              <label
                htmlFor="rep-target"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Specific Location / Feature <span className="text-brand-danger">*</span>
              </label>
              <select
                id="rep-target"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                disabled={nodes.length === 0}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-brand-navy focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              >
                {nodes.length === 0 ? (
                  <option value="">No locations available</option>
                ) : (
                  nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.node_type})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Issue Category (Strictly matched to backend schema) */}
            <div>
              <label
                htmlFor="rep-category"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Barrier Type <span className="text-brand-danger">*</span>
              </label>
              <select
                id="rep-category"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as ReportIssueType)}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-brand-navy focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 focus:outline-none"
              >
                <option value="broken_lift">Broken or Inoperable Lift</option>
                <option value="blocked_ramp">Blocked Access Ramp</option>
                <option value="path_obstruction">Walkway or Corridor Obstruction</option>
                <option value="incorrect_data">Inaccurate Accessibility Landmark Data</option>
                <option value="other">Other Barrier</option>
              </select>
            </div>
          </div>

          {/* Broken Lift Safety Notice Callout */}
          {issueType === 'broken_lift' && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-brand-warning shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <strong className="block font-bold">Safety Exclusion Protocol:</strong>
                <span>
                  Submitting a broken lift report will update the asset&apos;s operational status to{' '}
                  <code>reported_unverified</code> in the campus graph. The routing engine will immediately
                  route wheelchair users around this lift until verified by facilities staff.
                </span>
              </div>
            </div>
          )}

          {/* Detailed Description */}
          <div>
            <label
              htmlFor="rep-desc"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Description &amp; Landmark Details <span className="text-brand-danger">*</span>
            </label>
            <textarea
              id="rep-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue, specific obstructions, or sensory indicators (e.g., 'Elevator doors not closing on ground floor')..."
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm text-brand-navy focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 focus:outline-none"
            />
            <p className="text-xs text-brand-muted mt-1">
              Minimum 3 characters, maximum 2000 characters. Be specific to assist verification staff.
            </p>
          </div>

          {/* Photo Upload UI (Validated Local Selection with Cloud Limitation Notice) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Photo Evidence (Optional — Validated Local Selection)
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
              <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" aria-hidden="true" />
              <div className="text-xs text-slate-600 font-medium">
                {photoName ? (
                  <div className="flex items-center justify-center gap-2 text-brand-success font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Attached: {photoName}</span>
                    <button
                      type="button"
                      onClick={handleClearPhoto}
                      className="p-1 hover:bg-slate-200 rounded text-slate-500 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                      aria-label="Remove attached photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <span>Select an image of the physical barrier for verification inspection</span>
                )}
              </div>

              {photoError && (
                <div className="mt-2 text-xs font-bold text-brand-danger flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{photoError}</span>
                </div>
              )}

              {/* Explicit Cloud Photo Limitation Notice */}
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 max-w-lg mx-auto text-left flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <strong className="block font-bold">Photo Upload Notice:</strong>
                  <span>Cloud photo storage is not currently configured on this backend server. Photos are inspected locally (max 5MB, JPG/PNG/WebP), but will not be uploaded to avoid server errors.</span>
                </div>
              </div>

              <label
                htmlFor="file-upload"
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-brand-action"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{photoName ? 'Change Image' : 'Select Photo File'}</span>
              </label>
              <input
                id="file-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="sr-only"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={isSubmitting || isLoadingFacilities || nodes.length === 0 || buildings.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 min-h-[44px] rounded-xl bg-brand-action text-white font-bold text-sm shadow hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
                  <span>Submitting Report...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-300" aria-hidden="true" />
                  <span>Submit Incident Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
