import { apiClient } from './api';
import { AccessibilityReport, CreateReportRequest, ReportCreateResponse } from '@/types/incident';

export const ReportingService = {
  /**
   * Fetches official report queue from GET /api/v1/admin/reports.
   * Requires a valid administrator JWT token passed in Authorization: Bearer <token>.
   * Throws typed API error on failure (401, 403, 500, network); never falls back to local fake data.
   */
  fetchAdminReports: async (
    adminToken: string,
    statusFilter?: string
  ): Promise<AccessibilityReport[]> => {
    if (!adminToken || !adminToken.trim()) {
      throw new Error('Authentication required: Missing admin access token.');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${adminToken.trim()}`
    };

    const params: Record<string, string> = {};
    if (statusFilter && statusFilter !== 'all') {
      params.status = statusFilter;
    }

    const response = await apiClient.get<AccessibilityReport[]>('/admin/reports', {
      headers,
      params
    });

    if (!Array.isArray(response.data)) {
      throw new Error('Invalid response format: Expected an array of reports.');
    }

    return response.data;
  },

  /**
   * Submits a new user-reported accessibility hazard directly to POST /api/v1/reports.
   * Connects exclusively to the live FastAPI backend.
   */
  submitReport: async (
    request: CreateReportRequest
  ): Promise<ReportCreateResponse> => {
    const payload = {
      target_type: request.target_type,
      target_id: request.target_id,
      issue_type: request.issue_type,
      description: request.description,
      photo_url: request.photo_url || null
    };

    const response = await apiClient.post<ReportCreateResponse>('/reports', payload);
    if (!response.data || !response.data.id) {
      throw new Error('Invalid response from report service: Missing report ID.');
    }

    return response.data;
  },

  /**
   * Performs report moderation via PATCH /api/v1/admin/reports/{id}.
   * Requires administrator JWT token passed in Authorization: Bearer <token>.
   * Mutates live database state, recalculates asset operational_status, logs audit entry,
   * and increments campus graph version.
   * Throws on failure; never simulates local success.
   */
  moderateReport: async (
    id: string,
    action: 'verify' | 'reject',
    resolutionNote?: string,
    adminToken?: string
  ): Promise<AccessibilityReport> => {
    if (!adminToken || !adminToken.trim()) {
      throw new Error('Authentication required: Missing admin access token.');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${adminToken.trim()}`
    };

    const payload = {
      action,
      resolution_note: resolutionNote || undefined
    };

    const response = await apiClient.patch<AccessibilityReport>(
      `/admin/reports/${id}`,
      payload,
      { headers }
    );

    if (!response.data || !response.data.id) {
      throw new Error('Invalid server response: missing report data.');
    }

    return response.data;
  },

  /**
   * Convenience helper for verifying a report.
   */
  verifyReport: async (
    id: string,
    note: string,
    adminToken?: string
  ): Promise<AccessibilityReport> => {
    return ReportingService.moderateReport(id, 'verify', note, adminToken);
  },

  /**
   * Convenience helper for rejecting a report.
   */
  rejectReport: async (
    id: string,
    note: string,
    adminToken?: string
  ): Promise<AccessibilityReport> => {
    return ReportingService.moderateReport(id, 'reject', note, adminToken);
  }
};
