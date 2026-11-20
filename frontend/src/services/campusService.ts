import { apiClient } from './api';
import { CampusBuilding, CampusNode, CampusMapGeoJson } from '@/types/campus';
import { validateCampusMapGeoJson } from './geoJsonValidator';

/**
 * CampusService provides verified, production-grade access to campus infrastructure
 * endpoints via the unified FastAPI client.
 *
 * All methods query the live backend service. No synthetic or demo fallback data
 * is embedded in production service calls.
 */
export const CampusService = {
  /**
   * Asynchronously fetches active campus buildings from GET /api/v1/buildings
   */
  fetchBuildings: async (): Promise<CampusBuilding[]> => {
    const response = await apiClient.get<CampusBuilding[]>('/buildings');
    return response.data;
  },

  /**
   * Asynchronously fetches active nodes for a given building from GET /api/v1/buildings/{id}/nodes
   */
  fetchBuildingNodes: async (buildingId: string): Promise<CampusNode[]> => {
    const response = await apiClient.get<CampusNode[]>(`/buildings/${buildingId}/nodes`);
    return response.data;
  },

  /**
   * Asynchronously fetches and validates campus map GeoJSON from GET /api/v1/map/geojson
   */
  fetchMapGeoJson: async (): Promise<CampusMapGeoJson> => {
    const response = await apiClient.get<unknown>('/map/geojson');
    const result = validateCampusMapGeoJson(response.data);
    if (!result.isValid) {
      throw new Error(result.error || 'Invalid GeoJSON payload returned by server');
    }
    return result.data!;
  }
};
