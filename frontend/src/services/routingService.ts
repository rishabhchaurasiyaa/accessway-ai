import axios from 'axios';
import { apiClient, getGraphVersion } from './api';
import {
  RouteCalculateRequest,
  RouteCalculateResponse,
  GraphVersionResponse
} from '@/types/navigation';

/**
 * Error raised when HTTP 409 Conflict is returned due to concurrent graph changes.
 */
export class GraphChangedConflictError extends Error {
  readonly isConflict = true;
  constructor(message = 'Route information changed. Recalculate before continuing.') {
    super(message);
    this.name = 'GraphChangedConflictError';
  }
}

/**
 * Calculates navigation routes using the live FastAPI backend POST /api/v1/routes/calculate.
 * Connects exclusively to the verified backend routing engine. Never falls back to client-side
 * or synthetic routing.
 */
export const calculateRoute = async (
  request: RouteCalculateRequest
): Promise<RouteCalculateResponse> => {
  try {
    // SECURITY: Never include user_id or X-User-ID in request payload
    const payload = {
      start_node_id: request.start_node_id,
      destination_node_id: request.destination_node_id,
      profiles: {
        fastest: request.profiles?.fastest ?? true,
        step_free: request.profiles?.step_free ?? true,
        visual_guidance: request.profiles?.visual_guidance ?? true,
        require_verified_paths: request.profiles?.require_verified_paths ?? true
      }
    };

    const response = await apiClient.post<RouteCalculateResponse>('/routes/calculate', payload);
    if (response.data && response.data.routes) {
      return response.data;
    }
    throw new Error('Invalid backend route response: missing routes object');
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      // Concurrency conflict: campus graph version changed during route calculation
      if (err.response?.status === 409) {
        throw new GraphChangedConflictError('Route information changed. Recalculate before continuing.');
      }
      // Backend validation or business error detail
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        throw new Error(detail);
      }
      if (err.code === 'ERR_NETWORK' || !err.response) {
        throw new Error('Backend routing service unavailable. Ensure backend server is running.');
      }
    }
    throw err;
  }
};

/**
 * Graph Version Freshness Tracking
 * Fetches current graph version from FastAPI backend GET /api/v1/graph/version.
 */
export const fetchGraphVersion = async (): Promise<GraphVersionResponse> => {
  return getGraphVersion();
};

/**
 * Compares calculated route graph version with the latest server graph version.
 * Returns true if route is fresh, false if stale.
 */
export const isRouteFresh = (routeGraphVersion: number, latestGraphVersion: number): boolean => {
  return routeGraphVersion === latestGraphVersion;
};
