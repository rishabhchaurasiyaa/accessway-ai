import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  CampusBuilding,
  CampusNode,
  CampusEdge,
  CampusMapGeoJson
} from '@/types/campus';
import { isVerifiedStepFreePathway } from '@/services/geoJsonValidator';
import { RouteResult } from '@/types/navigation';
import {
  Layers,
  Info,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export interface CampusMapProps {
  buildings: CampusBuilding[];
  nodes?: CampusNode[];
  edges?: CampusEdge[];
  selectedBuildingCode?: string;
  selectedFloor: string;
  onSelectFloor: (floor: string) => void;
  originNodeId?: string;
  destinationNodeId?: string;
  fastestRoute?: RouteResult | null;
  stepFreeRoute?: RouteResult | null;
  activeMode: 'fastest' | 'step_free';
  onSelectNode?: (nodeId: string) => void;
  // Step 4 GeoJSON props
  geoJson?: CampusMapGeoJson | null;
  isLoadingGeoJson?: boolean;
  geoJsonError?: string | null;
  onRetryGeoJson?: () => void;
  isRouteStale?: boolean;
}

// Center of the simulated campus: 31.2464, 75.7030
const CAMPUS_CENTER: [number, number] = [31.2464, 75.7030];

// Custom DivIcons for crisp SVG rendering without missing asset warnings
const createNodeIcon = (
  type: string,
  isOrigin: boolean,
  isDestination: boolean,
  isHighlighted: boolean
) => {
  let bgColor = '#12233F';
  let borderColor = '#FFFFFF';
  let innerHtml = '';

  if (isOrigin) {
    bgColor = '#217A57';
    borderColor = '#FFFFFF';
    innerHtml = '<div style="width:10px;height:10px;background:#FFF;border-radius:50%;margin:auto;"></div>';
  } else if (isDestination) {
    bgColor = '#A33A3A';
    borderColor = '#FFFFFF';
    innerHtml = '<div style="width:10px;height:10px;background:#FFF;border-radius:2px;margin:auto;"></div>';
  } else if (isHighlighted) {
    bgColor = '#2764C5';
    borderColor = '#60A5FA';
  } else {
    switch (type) {
      case 'lift':
        bgColor = '#14A6A6';
        break;
      case 'ramp':
        bgColor = '#217A57';
        break;
      case 'landmark':
        bgColor = '#A76712';
        break;
      case 'entrance':
        bgColor = '#2764C5';
        break;
      default:
        bgColor = '#475569';
    }
  }

  const size = isOrigin || isDestination ? 28 : isHighlighted ? 24 : 18;

  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${bgColor};
      border: 3px solid ${borderColor};
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;
    ">${innerHtml}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

/**
 * Controller to smoothly fit map bounds to valid GeoJSON features or fly to a building
 */
const MapBoundsController: React.FC<{
  geoJson: CampusMapGeoJson | null;
  selectedBuildingCentroid?: [number, number] | null;
  selectedBuildingCode?: string;
  activeRouteSegments?: [number, number][][];
}> = ({ geoJson, selectedBuildingCentroid, selectedBuildingCode, activeRouteSegments = [] }) => {
  const map = useMap();
  const prevBuildingRef = useRef<string | undefined>(selectedBuildingCode);

  useEffect(() => {
    // If active route segments are present, prioritize framing the calculated route
    if (activeRouteSegments.length > 0) {
      const allRoutePts = activeRouteSegments.flat();
      const routeBounds = L.latLngBounds(allRoutePts);
      if (routeBounds.isValid()) {
        map.fitBounds(routeBounds, { padding: [40, 40], maxZoom: 18, duration: 0.8 });
        return;
      }
    }

    // If the building selection changed specifically, fly to that building's centroid
    if (selectedBuildingCode !== prevBuildingRef.current) {
      prevBuildingRef.current = selectedBuildingCode;
      if (selectedBuildingCentroid) {
        map.flyTo(selectedBuildingCentroid, 18, { duration: 0.8 });
        return;
      }
    }

    // Otherwise, fit bounds to the valid loaded GeoJSON features
    if (geoJson && geoJson.features && geoJson.features.length > 0) {
      try {
        const geoLayer = L.geoJSON(geoJson as any);
        const bounds = geoLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [35, 35], maxZoom: 18, duration: 0.8 });
          return;
        }
      } catch {
        // Safe fallback
      }
    }

    if (selectedBuildingCentroid) {
      map.flyTo(selectedBuildingCentroid, 18, { duration: 0.8 });
    }
  }, [geoJson, selectedBuildingCentroid, selectedBuildingCode, activeRouteSegments, map]);

  return null;
};

export const CampusMap: React.FC<CampusMapProps> = ({
  buildings,
  nodes = [],
  edges: _edges = [],
  selectedBuildingCode,
  selectedFloor,
  onSelectFloor,
  originNodeId,
  destinationNodeId,
  fastestRoute,
  stepFreeRoute,
  activeMode,
  onSelectNode,
  geoJson = null,
  isLoadingGeoJson = false,
  geoJsonError = null,
  onRetryGeoJson,
  isRouteStale = false
}) => {
  // Determine active building
  const activeBuilding = useMemo(() => {
    return buildings.find((b) => b.building_code === selectedBuildingCode);
  }, [buildings, selectedBuildingCode]);

  // Center calculation
  const mapCenter: [number, number] = useMemo(() => {
    if (activeBuilding && activeBuilding.centroid_lat && activeBuilding.centroid_lng) {
      return [activeBuilding.centroid_lat, activeBuilding.centroid_lng];
    }
    return CAMPUS_CENTER;
  }, [activeBuilding]);

  // Lookup map for coordinates (supports both GeoJSON and fallback props)
  const nodeCoords = useMemo(() => {
    const map = new Map<string, [number, number]>();
    if (geoJson && geoJson.features) {
      for (const feat of geoJson.features) {
        if (feat.geometry.type === 'Point' && feat.id) {
          const [lng, lat] = feat.geometry.coordinates;
          map.set(feat.id, [lat, lng]);
        }
      }
    }
    // Fallback to nodes prop if not found in GeoJSON
    for (const node of nodes) {
      if (node.latitude && node.longitude && !map.has(node.id)) {
        map.set(node.id, [node.latitude, node.longitude]);
      }
    }
    return map;
  }, [geoJson, nodes]);

  // Calculated route polyline segments (connects verified adjacent waypoints without artificial gaps)
  const activeRouteSegments = useMemo(() => {
    const targetRoute = activeMode === 'fastest' ? fastestRoute : stepFreeRoute;
    if (!targetRoute || !targetRoute.available || !targetRoute.node_ids) return [];

    const segments: [number, number][][] = [];
    const nodeIds = targetRoute.node_ids;

    for (let i = 0; i < nodeIds.length - 1; i++) {
      const p1 = nodeCoords.get(nodeIds[i]);
      const p2 = nodeCoords.get(nodeIds[i + 1]);
      if (p1 && p2) {
        segments.push([p1, p2]);
      }
    }
    return segments;
  }, [activeMode, fastestRoute, stepFreeRoute, nodeCoords]);

  // Feature stats for accessible text alternative
  const featureStats = useMemo(() => {
    if (!geoJson || !geoJson.features) return null;
    let points = 0;
    let lifts = 0;
    let ramps = 0;
    let paths = 0;
    let stepFreePaths = 0;

    for (const f of geoJson.features) {
      if (f.geometry.type === 'Point') {
        points++;
        if (f.properties?.node_type === 'lift') lifts++;
        if (f.properties?.node_type === 'ramp') ramps++;
      } else if (f.geometry.type === 'LineString') {
        paths++;
        if (isVerifiedStepFreePathway(f.properties)) {
          stepFreePaths++;
        }
      }
    }
    return { points, lifts, ramps, paths, stepFreePaths };
  }, [geoJson]);

  // GeoJSON style handler
  const getFeatureStyle = (feature: any) => {
    if (feature?.geometry?.type === 'LineString') {
      const props = feature.properties || {};
      const isStepFree = isVerifiedStepFreePathway(props);
      const isStairs = props.path_type === 'stairs' || (typeof props.stairs_count === 'number' && props.stairs_count > 0);

      if (isStepFree) {
        return {
          color: '#14A6A6',
          weight: 4,
          opacity: 0.85
        };
      }
      if (isStairs) {
        return {
          color: '#94A3B8',
          weight: 3,
          dashArray: '4, 4',
          opacity: 0.7
        };
      }
      return {
        color: '#64748B',
        weight: 3,
        opacity: 0.7
      };
    }

    if (feature?.geometry?.type === 'Polygon') {
      return {
        color: '#12233F',
        weight: 2,
        fillColor: '#93C5FD',
        fillOpacity: 0.25
      };
    }

    return {};
  };

  // Floor filter for GeoJSON features
  const filterFeatureByFloor = (feature: any) => {
    if (selectedFloor === 'all') return true;
    if (feature?.geometry?.type === 'Point') {
      const label = feature.properties?.floor_label;
      if (!label) return true; // outdoor nodes visible on all floors
      return label === selectedFloor;
    }
    return true;
  };

  // Convert GeoJSON Point to Leaflet Marker
  const handlePointToLayer = (feature: any, latlng: L.LatLng) => {
    const isOrigin = feature.id === originNodeId;
    const isDestination = feature.id === destinationNodeId;
    const isHighlighted = (activeMode === 'fastest'
      ? fastestRoute?.node_ids?.includes(feature.id)
      : stepFreeRoute?.node_ids?.includes(feature.id)) ?? false;

    const icon = createNodeIcon(
      feature.properties?.node_type || 'default',
      isOrigin,
      isDestination,
      isHighlighted
    );

    const marker = L.marker(latlng, {
      icon,
      keyboard: true,
      title: feature.properties?.name || feature.properties?.node_code || 'Campus Node'
    });

    marker.on('click', () => {
      if (onSelectNode && feature.id) {
        onSelectNode(feature.id);
      }
    });

    return marker;
  };

  // Bind accessible popups
  const handleEachFeature = (feature: any, layer: L.Layer) => {
    const props = feature.properties || {};

    if (feature.geometry?.type === 'Point') {
      const statusBadge =
        props.operational_status && props.operational_status !== 'available'
          ? `<span style="display:inline-block;padding:1px 6px;background:#FEE2E2;color:#991B1B;border-radius:4px;font-size:10px;font-weight:bold;margin-left:4px;">[${props.operational_status}]</span>`
          : '';

      const popupHtml = `
        <div style="font-family:sans-serif;font-size:12px;color:#1E293B;min-width:180px;line-height:1.4;">
          <div style="font-family:monospace;font-size:10px;font-weight:bold;color:#64748B;text-transform:uppercase;">
            ${props.node_code || 'NODE'}
          </div>
          <div style="font-size:13px;font-weight:bold;color:#12233F;margin:2px 0;">
            ${props.name || 'Campus Location'}
          </div>
          <div style="font-size:11px;color:#475569;margin-bottom:4px;">
            Type: <strong style="text-transform:capitalize;">${props.node_type || 'waypoint'}</strong>
            • Floor: <strong>${props.floor_label || 'Outdoor'}</strong>
            ${statusBadge}
          </div>
          ${
            props.landmark_description
              ? `<div style="font-size:11px;font-style:italic;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:4px;padding:4px 6px;margin-top:4px;color:#334155;">
                   &ldquo;${props.landmark_description}&rdquo;
                 </div>`
              : ''
          }
        </div>
      `;
      layer.bindPopup(popupHtml, { maxWidth: 280 });
    } else if (feature.geometry?.type === 'LineString') {
      const isStepFree = isVerifiedStepFreePathway(props);
      const accessibilityLabel = isStepFree
        ? '<span style="color:#14A6A6;font-weight:bold;">Verified Step-Free Segment</span>'
        : '<span style="color:#A76712;font-weight:bold;">Not Step-Free / Unverified</span>';

      const popupHtml = `
        <div style="font-family:sans-serif;font-size:12px;color:#1E293B;min-width:200px;line-height:1.4;">
          <div style="font-size:13px;font-weight:bold;color:#12233F;margin-bottom:2px;">
            Pathway Segment (${props.path_type || 'corridor'})
          </div>
          <div style="font-size:11px;color:#475569;">
            Distance: <strong>${props.distance_m != null ? `${props.distance_m} m` : 'N/A'}</strong>
            • Est: <strong>${props.estimated_seconds != null ? `${props.estimated_seconds} s` : 'N/A'}</strong>
          </div>
          <div style="font-size:11px;margin-top:4px;">
            Accessibility: ${accessibilityLabel}
          </div>
          <div style="font-size:11px;color:#475569;margin-top:2px;">
            Status: <strong>${props.operational_status || 'unknown'}</strong> • Verification: <strong>${props.verification_status || 'unverified'}</strong>
          </div>
          ${
            props.stairs_count != null
              ? `<div style="font-size:11px;color:${props.stairs_count > 0 ? '#A33A3A' : '#14A6A6'};">Stairs Count: <strong>${props.stairs_count}</strong></div>`
              : '<div style="font-size:11px;color:#A76712;">Stairs Count: <em>Unknown (Non-step-free)</em></div>'
          }
          <div style="font-size:10px;color:#64748B;font-style:italic;margin-top:4px;border-top:1px solid #E2E8F0;padding-top:2px;">
            * Segment verification only; does not guarantee complete route accessibility.
          </div>
        </div>
      `;
      layer.bindPopup(popupHtml, { maxWidth: 280 });
    } else if (feature.geometry?.type === 'Polygon') {
      const popupHtml = `
        <div style="font-family:sans-serif;font-size:12px;color:#1E293B;min-width:180px;">
          <div style="font-size:13px;font-weight:bold;color:#12233F;">
            ${props.name || props.building_code || 'Campus Building'}
          </div>
          <div style="font-size:11px;color:#64748B;margin-top:2px;">
            ${props.description || 'Campus Facility Polygon'}
          </div>
        </div>
      `;
      layer.bindPopup(popupHtml, { maxWidth: 280 });
    }
  };

  const hasGeoJsonFeatures = Boolean(geoJson && geoJson.features && geoJson.features.length > 0);

  return (
    <div className="bg-brand-surface border border-brand-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* Map Control Toolbar */}
      <div className="p-3 sm:p-4 border-b border-brand-border bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-brand-navy shrink-0" aria-hidden="true" />
          <span className="text-sm font-bold text-brand-navy">
            {activeBuilding ? activeBuilding.name : 'Campus Overview'}
          </span>
        </div>

        {/* Floor Switcher */}
        <div className="flex items-center gap-1.5 bg-white border border-brand-border rounded-xl p-1 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 px-2">Floor:</span>
          <button
            type="button"
            onClick={() => onSelectFloor('all')}
            className={`px-3 py-2 min-h-[44px] text-xs font-bold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action ${
              selectedFloor === 'all'
                ? 'bg-brand-navy text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onSelectFloor('Ground')}
            className={`px-3 py-2 min-h-[44px] text-xs font-bold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action ${
              selectedFloor === 'Ground'
                ? 'bg-brand-action text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Ground
          </button>
          <button
            type="button"
            onClick={() => onSelectFloor('Floor 1')}
            className={`px-3 py-2 min-h-[44px] text-xs font-bold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action ${
              selectedFloor === 'Floor 1'
                ? 'bg-brand-teal text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Floor 1
          </button>
        </div>
      </div>

      {/* Screen reader text alternative for interactive map */}
      <div className="sr-only" aria-live="polite">
        Interactive campus map for {activeBuilding ? activeBuilding.name : 'campus facilities'}.
        Floor: {selectedFloor}.
        {featureStats
          ? ` Showing ${featureStats.points} waypoints (${featureStats.lifts} lifts, ${featureStats.ramps} ramps) and ${featureStats.paths} pathway segments.`
          : ''}
        {activeRouteSegments.length > 0
          ? ` Active ${activeMode} route displayed with ${activeRouteSegments.length} connected pathway segments.`
          : ' No active route polyline on map.'}
      </div>

      {/* Map Viewport with Explicit States */}
      <div className="h-[460px] w-full relative">
        {/* State 1: Loading Map */}
        {isLoadingGeoJson ? (
          <div
            role="status"
            aria-busy="true"
            className="h-full w-full bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-3"
          >
            <Loader2 className="w-8 h-8 text-brand-action animate-spin" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-brand-navy">Loading Campus Map Layers...</p>
              <p className="text-xs text-slate-500">Fetching dynamic GeoJSON from FastAPI backend</p>
            </div>
          </div>
        ) : geoJsonError ? (
          /* State 2: Backend Request Failure or Invalid GeoJSON */
          <div
            role="alert"
            className="h-full w-full bg-red-50/60 flex flex-col items-center justify-center p-6 text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-brand-danger">
              <AlertCircle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-sm font-bold text-brand-danger">Map Backend Unavailable</h3>
              <p className="text-xs text-slate-700">{geoJsonError}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {onRetryGeoJson && (
                <button
                  type="button"
                  onClick={onRetryGeoJson}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-brand-danger text-white rounded-xl text-xs font-bold hover:bg-red-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Retry Map Loading</span>
                </button>
              )}
            </div>
          </div>
        ) : geoJson && geoJson.features.length === 0 ? (
          /* State 3: Empty Map Data */
          <div
            role="status"
            className="h-full w-full bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
              <Layers className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-sm font-bold text-brand-navy">Campus Mapping & Navigation Not Available</h3>
              <p className="text-xs text-slate-500">
                Verified infrastructure data for Lovely Professional University (LPU) has not yet been ingested. Campus mapping and navigation will become available once physical survey data and authorized architectural blueprints are integrated.
              </p>
            </div>
            {onRetryGeoJson && (
              <button
                type="button"
                onClick={onRetryGeoJson}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Retry Map Loading</span>
              </button>
            )}
          </div>
        ) : (
          /* State 4: Map Successfully Loaded with Features */
          <>
            <MapContainer
              center={mapCenter}
              zoom={17}
              scrollWheelZoom={false}
              className="h-full w-full z-10"
              attributionControl={false}
            >
              {/* Automatic GeoJSON Bounds Controller */}
              <MapBoundsController
                geoJson={geoJson}
                selectedBuildingCentroid={
                  activeBuilding?.centroid_lat && activeBuilding?.centroid_lng
                    ? [activeBuilding.centroid_lat, activeBuilding.centroid_lng]
                    : null
                }
                selectedBuildingCode={selectedBuildingCode}
                activeRouteSegments={activeRouteSegments}
              />

              {/* Clean High-Contrast Base Tiles */}
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />

              {/* Render dynamic GeoJSON features */}
              {hasGeoJsonFeatures && (
                <GeoJSON
                  key={`geojson-${geoJson?.graph_version ?? 1}-${geoJson?.features.length ?? 0}-${selectedFloor}`}
                  data={geoJson as any}
                  filter={filterFeatureByFloor}
                  style={getFeatureStyle}
                  pointToLayer={handlePointToLayer}
                  onEachFeature={handleEachFeature}
                />
              )}

              {/* Highlighted active calculated route polyline segments */}
              {activeRouteSegments.map((segment, idx) => (
                <Polyline
                  key={`active-route-seg-${activeMode}-${idx}`}
                  positions={segment}
                  pathOptions={{
                    color: activeMode === 'fastest' ? '#2764C5' : '#14A6A6',
                    weight: 6,
                    opacity: 0.95
                  }}
                />
              ))}
            </MapContainer>

            {/* Campus Map Indicator */}
            <div className="absolute bottom-2 right-2 z-20 pointer-events-none px-2.5 py-1 rounded-md text-[10px] font-bold shadow-sm border bg-white/95 text-slate-700 border-slate-300">
              Campus Map — Verified Infrastructure Only
            </div>
          </>
        )}
      </div>

      {/* Accessible Map Legend & Status Details */}
      <div
        role="region"
        aria-label="Map Legend and Accessibility Notes"
        className="p-3 sm:p-4 bg-slate-50 border-t border-brand-border text-xs text-slate-700 space-y-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-brand-navy">
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Campus Map Legend</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Verified Infrastructure
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-brand-success border-2 border-white shadow-xs"></span>
            <span>Origin Point</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-sm bg-brand-danger border-2 border-white shadow-xs"></span>
            <span>Destination</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-brand-teal"></span>
            <span>Elevator (Lift)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-brand-warning"></span>
            <span>Physical Landmark</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-5 h-1 rounded bg-brand-teal"></span>
            <span>Verified Step-Free Segment (0 stairs, verified & available)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-5 h-1 border-t-2 border-dashed border-slate-400"></span>
            <span>Stairs / Unverified / Blocked</span>
          </div>

          {activeRouteSegments.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-1.5 rounded ${
                isRouteStale ? 'bg-amber-500' : activeMode === 'fastest' ? 'bg-brand-action' : 'bg-brand-teal'
              }`}></span>
              <span className={`font-bold ${isRouteStale ? 'text-amber-800' : 'text-brand-navy'}`}>
                Active Route ({activeRouteSegments.length} segments){isRouteStale ? ' [Stale - Recalculate]' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Feature summary for accessibility */}
        {featureStats && (
          <div className="pt-1 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200">
            <span>Waypoints: <strong>{featureStats.points}</strong></span>
            <span>Lifts: <strong>{featureStats.lifts}</strong></span>
            <span>Ramps: <strong>{featureStats.ramps}</strong></span>
            <span>Pathways: <strong>{featureStats.paths}</strong> ({featureStats.stepFreePaths} verified step-free segments)</span>
            <span className="text-slate-400">|</span>
            <span className="italic">Individual segment verification does not guarantee full route step-free status</span>
          </div>
        )}
      </div>
    </div>
  );
};
