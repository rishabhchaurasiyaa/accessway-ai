import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

/**
 * CANONICAL FRONTEND API CONFIGURATION
 * Single canonical environment variable: VITE_API_BASE_URL
 * Local development default: http://127.0.0.1:8000
 *
 * All API client requests are dispatched with the /api/v1 prefix.
 * Backend secrets, service-role keys, and database passwords must NEVER be placed here.
 */
const RAW_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'http://127.0.0.1:8000';

const cleanBaseUrl = RAW_BASE_URL.replace(/\/+$/, '');
export const API_BASE_URL = cleanBaseUrl.endsWith('/api/v1')
  ? cleanBaseUrl
  : `${cleanBaseUrl}/api/v1`;

export interface ApiError {
  message: string;
  statusCode: number;
  errorCode?: string | number | null;
  details?: unknown;
  path?: string;
}

export interface HealthStatusResponse {
  status: string;
  version: string;
  app_name: string;
  environment: string;
  database_status: 'connected' | 'disconnected' | 'configured' | 'not_configured' | string;
  database_error?: string | null;
  synthetic_demo_mode: boolean;
  details?: Record<string, string>;
}

export interface GraphVersionResponse {
  graph_version: number;
  updated_at: string;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Preserves standard Authorization: Bearer <token>
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Standard request pass-through preserving caller-specified headers
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Uniform error handling & normalization
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: { message?: string; code?: string | number; details?: unknown; path?: string }; detail?: unknown }>) => {
    let message = 'An unexpected error occurred';
    let statusCode = 500;
    let details: unknown = null;
    let errorCode: string | number | null = null;
    let path: string | undefined = undefined;

    if (error.response) {
      statusCode = error.response.status || 500;
      const data = error.response.data;

      if (data?.error) {
        message = data.error.message || message;
        errorCode = data.error.code ?? null;
        details = data.error.details ?? null;
        path = data.error.path;
      } else if (data?.detail) {
        if (typeof data.detail === 'string') {
          message = data.detail;
        } else if (Array.isArray(data.detail)) {
          // FastAPI / Pydantic RequestValidationError array
          message = data.detail.map((d: { msg?: string }) => d.msg || 'Validation error').join('; ');
          details = data.detail;
        } else {
          message = JSON.stringify(data.detail);
        }
      } else if (typeof data === 'string') {
        message = data;
      }
    } else if (error.request) {
      message = `Network error: Unable to reach the backend server at ${API_BASE_URL}. Ensure the FastAPI service is running.`;
      statusCode = 0;
    } else if (error.message) {
      message = error.message;
    }

    const customError: ApiError = {
      message,
      statusCode,
      errorCode,
      details,
      path,
    };

    return Promise.reject(customError);
  }
);

/**
 * Health Check API
 * Accurately retrieves backend service health and database connectivity state.
 */
export const checkHealth = async (): Promise<HealthStatusResponse> => {
  const response = await apiClient.get<HealthStatusResponse>('/health');
  return response.data;
};

/**
 * Graph Version API
 * Retrieves current campus graph state version for cache invalidation.
 */
export const getGraphVersion = async (): Promise<GraphVersionResponse> => {
  const response = await apiClient.get<GraphVersionResponse>('/graph/version');
  return response.data;
};
