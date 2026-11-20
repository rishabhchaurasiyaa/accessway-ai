export type ReportTargetType = 'node' | 'edge';

export type ReportIssueType =
  | 'broken_lift'
  | 'blocked_ramp'
  | 'path_obstruction'
  | 'incorrect_data'
  | 'other';

export type ReportStatus = 'pending_review' | 'verified' | 'rejected';

export interface AccessibilityReport {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  target_label?: string;
  building_code?: string;
  floor_label?: string;
  issue_type: ReportIssueType;
  description: string;
  photo_url?: string | null;
  status: ReportStatus;
  reporter_user_id?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  resolution_note?: string | null;
  created_at: string;
}

export interface CreateReportRequest {
  target_type: ReportTargetType;
  target_id: string;
  issue_type: ReportIssueType;
  description: string;
  photo_url?: string | null;
  building_code?: string;
  floor_label?: string;
}

export interface ReportCreateResponse {
  id: string;
  status: ReportStatus | string;
  graph_version: number;
  message: string;
}

export interface ModerateReportRequest {
  action?: 'verify' | 'reject';
  status?: 'verified' | 'rejected';
  resolution_note?: string;
}

