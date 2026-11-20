import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CampusService } from '@/services/campusService';
import { getGraphVersion } from '@/services/api';
import { calculateRoute, GraphChangedConflictError } from '@/services/routingService';
import { CampusBuilding, CampusNode, CampusEdge, CampusMapGeoJson } from '@/types/campus';
import { RouteCalculateResponse } from '@/types/navigation';
import { RouteComparisonCards } from '@/components/navigation/RouteComparisonCards';
import { CampusMap } from '@/components/navigation/CampusMap';
import { DirectionsPanel } from '@/components/navigation/DirectionsPanel';
import {
  Compass,
  RotateCcw,
  AlertCircle,
  Loader2,
  Building2,
  RefreshCw,
  MapPin
} from 'lucide-react';

export const NavigationPage: React.FC = () => {
  // Buildings state
  const [buildings, setBuildings] = useState<CampusBuilding[]>([]);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState<boolean>(true);
  const [buildingError, setBuildingError] = useState<string | null>(null);
  const [selectedBuildingCode, setSelectedBuildingCode] = useState<string>('');
  const [selectedFloor, setSelectedFloor] = useState<string>('Ground');

  // Nodes & Edges state
  const [nodes, setNodes] = useState<CampusNode[]>([]);
  const [isLoadingNodes, setIsLoadingNodes] = useState<boolean>(false);
  const [nodeError, setNodeError] = useState<string | null>(null);
  const [edges, setEdges] = useState<CampusEdge[]>([]);

  // Waypoints selection
  const [originNodeId, setOriginNodeId] = useState<string>('');
  const [destinationNodeId, setDestinationNodeId] = useState<string>('');

  // GeoJSON Map state
  const [geoJsonData, setGeoJsonData] = useState<CampusMapGeoJson | null>(null);
  const [isLoadingGeoJson, setIsLoadingGeoJson] = useState<boolean>(true);
  const [geoJsonError, setGeoJsonError] = useState<string | null>(null);

  // Routing state
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGraphConflict, setIsGraphConflict] = useState<boolean>(false);
  const [calculation, setCalculation] = useState<RouteCalculateResponse | null>(null);
  const [activeMode, setActiveMode] = useState<'fastest' | 'step_free'>('step_free');

  // Graph Version Freshness Tracking
  const [latestGraphVersion, setLatestGraphVersion] = useState<number | null>(null);
  const [isRouteStale, setIsRouteStale] = useState<boolean>(false);

  // Race condition protection for fast building switches and freshness checks
  const nodeRequestIdRef = useRef<number>(0);
  const freshnessRequestIdRef = useRef<number>(0);
  const isCheckingFreshnessRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  // 1. Fetch Buildings from live backend
  const loadBuildings = useCallback(async () => {
    setIsLoadingBuildings(true);
    setBuildingError(null);
    setEdges([]);

    try {
      const fetched = await CampusService.fetchBuildings();
      if (!isMountedRef.current) return;
      setBuildings(fetched);
      if (fetched.length > 0) {
        setSelectedBuildingCode((prev) =>
          fetched.some((b) => b.building_code === prev) ? prev : fetched[0].building_code
        );
      } else {
        setSelectedBuildingCode('');
        setNodes([]);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const msg =
        err instanceof Error ? err.message : 'Buildings endpoint unavailable. Ensure backend is running.';
      setBuildingError(msg);
      setBuildings([]);
      setSelectedBuildingCode('');
      setNodes([]);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingBuildings(false);
      }
    }
  }, []);

  // 2. Fetch Nodes for Selected Building from live backend
  const loadNodesForBuilding = useCallback(
    async (buildingCode: string) => {
      if (!buildingCode) {
        setNodes([]);
        setOriginNodeId('');
        setDestinationNodeId('');
        return;
      }

      const currentBuilding = buildings.find((b) => b.building_code === buildingCode);
      if (!currentBuilding?.id) {
        setNodes([]);
        return;
      }

      const reqId = ++nodeRequestIdRef.current;
      setIsLoadingNodes(true);
      setNodeError(null);

      try {
        const fetchedNodes = await CampusService.fetchBuildingNodes(currentBuilding.id);
        if (!isMountedRef.current || reqId !== nodeRequestIdRef.current) return;

        setNodes(fetchedNodes);

        // Pick initial distinct origin and destination from active nodes
        const activeNodes = fetchedNodes.filter((n) => n.is_active);
        if (activeNodes.length > 0) {
          const first = activeNodes[0].id;
          const second = activeNodes.length > 1 ? activeNodes[1].id : activeNodes[0].id;
          setOriginNodeId(first);
          setDestinationNodeId(second);
        } else {
          setOriginNodeId('');
          setDestinationNodeId('');
        }
      } catch (err: unknown) {
        if (!isMountedRef.current || reqId !== nodeRequestIdRef.current) return;
        const msg =
          err instanceof Error
            ? err.message
            : `Node endpoint unavailable for building ${buildingCode}.`;
        setNodeError(msg);
        setNodes([]);
        setOriginNodeId('');
        setDestinationNodeId('');
      } finally {
        if (isMountedRef.current && reqId === nodeRequestIdRef.current) {
          setIsLoadingNodes(false);
        }
      }
    },
    [buildings]
  );

  // 3. Fetch Map GeoJSON Layer from live backend
  const loadMapGeoJson = useCallback(async () => {
    setIsLoadingGeoJson(true);
    setGeoJsonError(null);

    try {
      const data = await CampusService.fetchMapGeoJson();
      if (!isMountedRef.current) return;
      setGeoJsonData(data);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : 'Map GeoJSON endpoint unavailable. Ensure backend is running.';
      setGeoJsonError(msg);
      setGeoJsonData(null);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingGeoJson(false);
      }
    }
  }, []);

  // Initialize and load buildings & map GeoJSON on mount
  useEffect(() => {
    isMountedRef.current = true;
    loadBuildings();
    loadMapGeoJson();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadBuildings, loadMapGeoJson]);

  // Refresh nodes whenever selected building changes or buildings list updates
  useEffect(() => {
    if (selectedBuildingCode) {
      loadNodesForBuilding(selectedBuildingCode);
    }
  }, [selectedBuildingCode, loadNodesForBuilding]);

  // Perform route calculation via live backend
  const handleCalculateRoute = async () => {
    if (!originNodeId || !destinationNodeId) {
      setErrorMessage('Please select both an origin and a destination.');
      setIsGraphConflict(false);
      return;
    }

    if (originNodeId === destinationNodeId) {
      setErrorMessage('Origin and destination cannot be the same node.');
      setIsGraphConflict(false);
      return;
    }

    setIsLoadingRoute(true);
    setErrorMessage(null);
    setIsGraphConflict(false);

    try {
      const result = await calculateRoute({
        start_node_id: originNodeId,
        destination_node_id: destinationNodeId,
        profiles: {
          fastest: true,
          step_free: true,
          visual_guidance: true,
          require_verified_paths: true
        }
      });

      setCalculation(result);
      setLatestGraphVersion(result.graph_version);
      setIsRouteStale(false);
      setIsGraphConflict(false);

      if (result.routes.step_free?.available) {
        setActiveMode('step_free');
      } else if (result.routes.fastest?.available) {
        setActiveMode('fastest');
      }
    } catch (err: unknown) {
      // Invalidate stale route results immediately on error
      setCalculation(null);
      setIsRouteStale(false);

      if (
        err instanceof GraphChangedConflictError ||
        (err as any)?.response?.status === 409 ||
        (err as any)?.code === 'ERR_GRAPH_CHANGED'
      ) {
        setIsGraphConflict(true);
        setErrorMessage('Route information changed. Recalculate before continuing.');
        // Refresh GeoJSON map data in background so the client receives updated graph
        loadMapGeoJson();
        // Sync latest graph version in background
        getGraphVersion()
          .then((res) => {
            if (isMountedRef.current) setLatestGraphVersion(res.graph_version);
          })
          .catch(() => {});
      } else {
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to calculate route. Please try another pair of waypoints.';
        setErrorMessage(msg);
      }
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Freshness check: validates whether server graph version has incremented
  const checkFreshness = useCallback(async () => {
    if (!calculation || isCheckingFreshnessRef.current) {
      return;
    }

    isCheckingFreshnessRef.current = true;
    const reqId = ++freshnessRequestIdRef.current;

    try {
      const data = await getGraphVersion();
      if (!isMountedRef.current || reqId !== freshnessRequestIdRef.current) return;

      setLatestGraphVersion(data.graph_version);

      if (calculation && data.graph_version !== calculation.graph_version) {
        setIsRouteStale(true);
      } else {
        setIsRouteStale(false);
      }
    } catch {
      // Graceful error handling: network or endpoint transient failure
    } finally {
      isCheckingFreshnessRef.current = false;
    }
  }, [calculation]);

  // Active navigation session freshness tracking and cleanup
  useEffect(() => {
    if (!calculation) return;

    // Check immediately upon active calculation
    checkFreshness();

    // Periodic freshness polling every 30s
    const intervalId = setInterval(() => {
      checkFreshness();
    }, 30000);

    // Refresh when user returns to tab/window
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkFreshness();
      }
    };

    const handleFocus = () => {
      checkFreshness();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [calculation, checkFreshness]);

  const handleReset = () => {
    setErrorMessage(null);
    setIsGraphConflict(false);
    setIsRouteStale(false);
    setLatestGraphVersion(null);
    setCalculation(null);
    setSelectedFloor('Ground');
    if (buildings.length > 0) {
      setSelectedBuildingCode(buildings[0].building_code);
    }
  };

  const handleOriginChange = (newOriginId: string) => {
    if (newOriginId === destinationNodeId) {
      setErrorMessage('Origin and destination cannot be the same node.');
      return;
    }
    setErrorMessage(null);
    setIsGraphConflict(false);
    setIsRouteStale(false);
    setOriginNodeId(newOriginId);
  };

  const handleDestinationChange = (newDestId: string) => {
    if (newDestId === originNodeId) {
      setErrorMessage('Origin and destination cannot be the same node.');
      return;
    }
    setErrorMessage(null);
    setIsGraphConflict(false);
    setIsRouteStale(false);
    setDestinationNodeId(newDestId);
  };

  const activeRoute =
    activeMode === 'fastest' ? calculation?.routes.fastest : calculation?.routes.step_free;

  const currentBuilding = buildings.find((b) => b.building_code === selectedBuildingCode);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-brand-border">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-action bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
            <Compass className="w-4 h-4 text-brand-action" aria-hidden="true" />
            <span>Interactive Navigation Hub</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-brand-navy mt-1 tracking-tight">
            Campus Route Planner
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Compare fastest paths with certified step-free wheelchair routes and spoken landmarks.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-action"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Origin, Destination & Building Selection Form */}
      <section
        aria-labelledby="route-controls-heading"
        className="bg-brand-surface border border-brand-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-6"
      >
        <div className="flex items-center justify-between">
          <h2 id="route-controls-heading" className="text-base font-bold text-brand-navy flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-action" aria-hidden="true" />
            <span>Select Campus Waypoints</span>
          </h2>
          <span className="text-[11px] font-semibold text-slate-500">
            Verified Infrastructure Only
          </span>
        </div>

        {/* 1. Buildings Endpoint Error / Empty States */}
        {isLoadingBuildings ? (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
            <Loader2 className="w-6 h-6 text-brand-action animate-spin mx-auto" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-600">Loading campus buildings from backend...</p>
          </div>
        ) : buildingError ? (
          <div role="alert" className="p-4 bg-red-50 border-2 border-red-300 rounded-xl text-xs text-brand-danger space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Buildings Endpoint Unavailable</span>
            </div>
            <p className="text-slate-700">{buildingError}</p>
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadBuildings()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-danger text-white rounded-lg text-xs font-bold hover:bg-red-800 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Connection</span>
              </button>
            </div>
          </div>
        ) : buildings.length === 0 ? (
          <div role="status" className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 mx-auto">
              <MapPin className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold text-slate-700 max-w-md mx-auto leading-relaxed">
              No verified campus locations are currently available. Navigation will become available when authorized campus infrastructure data has been added and verified.
            </p>
          </div>
        ) : (
          /* Dynamic Form Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Building Focus Selector */}
            <div>
              <label
                htmlFor="building-select"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Building View
              </label>
              <div className="relative">
                <select
                  id="building-select"
                  value={selectedBuildingCode}
                  onChange={(e) => {
                    setSelectedBuildingCode(e.target.value);
                    setSelectedFloor('Ground');
                  }}
                  className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-brand-navy focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 focus:outline-none"
                >
                  {buildings.map((b) => (
                    <option key={b.id} value={b.building_code}>
                      {b.building_code} — {b.name.split('(')[0].trim()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Floor Level Selector */}
            <div>
              <label
                htmlFor="floor-select"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Floor Level
              </label>
              <select
                id="floor-select"
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-brand-navy focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 focus:outline-none"
              >
                <option value="all">All Floors</option>
                {currentBuilding?.floors && currentBuilding.floors.length > 0 ? (
                  currentBuilding.floors.map((f) => (
                    <option key={f.floor_label} value={f.floor_label}>
                      {f.name} ({f.floor_label})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Ground">Ground Floor</option>
                    <option value="Floor 1">Floor 1 (First Floor)</option>
                  </>
                )}
              </select>
            </div>

            {/* Origin Node Selector */}
            <div>
              <label
                htmlFor="origin-select"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between"
              >
                <span>Start Location (Origin)</span>
                {isLoadingNodes && <Loader2 className="w-3 h-3 text-brand-action animate-spin" />}
              </label>
              <select
                id="origin-select"
                value={originNodeId}
                onChange={(e) => handleOriginChange(e.target.value)}
                disabled={isLoadingNodes || nodes.length === 0}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-brand-navy focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 focus:outline-none truncate disabled:bg-slate-100 disabled:text-slate-400"
              >
                {nodes.length === 0 ? (
                  <option value="">{isLoadingNodes ? 'Loading nodes...' : 'No nodes available'}</option>
                ) : (
                  nodes.map((node) => {
                    const isSelectedAsDest = node.id === destinationNodeId;
                    const isInactive = !node.is_active;
                    return (
                      <option
                        key={node.id}
                        value={node.id}
                        disabled={isInactive || isSelectedAsDest}
                      >
                        {node.floor_label ? `[${node.floor_label}] ` : '[Ground] '}
                        {node.name} ({node.node_type})
                        {node.operational_status !== 'available' ? ` [${node.operational_status}]` : ''}
                        {isSelectedAsDest ? ' (Selected as Destination)' : ''}
                        {isInactive ? ' (Inactive)' : ''}
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            {/* Destination Node Selector */}
            <div>
              <label
                htmlFor="destination-select"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between"
              >
                <span>Destination Goal</span>
                {isLoadingNodes && <Loader2 className="w-3 h-3 text-brand-action animate-spin" />}
              </label>
              <select
                id="destination-select"
                value={destinationNodeId}
                onChange={(e) => handleDestinationChange(e.target.value)}
                disabled={isLoadingNodes || nodes.length === 0}
                className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-brand-navy focus:border-brand-action focus:ring-2 focus:ring-brand-action/20 focus:outline-none truncate disabled:bg-slate-100 disabled:text-slate-400"
              >
                {nodes.length === 0 ? (
                  <option value="">{isLoadingNodes ? 'Loading nodes...' : 'No nodes available'}</option>
                ) : (
                  nodes.map((node) => {
                    const isSelectedAsOrigin = node.id === originNodeId;
                    const isInactive = !node.is_active;
                    return (
                      <option
                        key={node.id}
                        value={node.id}
                        disabled={isInactive || isSelectedAsOrigin}
                      >
                        {node.floor_label ? `[${node.floor_label}] ` : '[Ground] '}
                        {node.name} ({node.node_type})
                        {node.operational_status !== 'available' ? ` [${node.operational_status}]` : ''}
                        {isSelectedAsOrigin ? ' (Selected as Origin)' : ''}
                        {isInactive ? ' (Inactive)' : ''}
                      </option>
                    );
                  })
                )}
              </select>
            </div>
          </div>
        )}

        {/* 2. Node Endpoint Error / Empty States */}
        {nodeError && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-brand-danger flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span><strong>Node endpoint error:</strong> {nodeError}</span>
            </div>
            <button
              type="button"
              onClick={() => loadNodesForBuilding(selectedBuildingCode)}
              className="px-2.5 py-1 bg-white border border-red-300 rounded text-brand-danger font-bold hover:bg-red-100 text-[11px]"
            >
              Retry Nodes
            </button>
          </div>
        )}

        {!isLoadingNodes && !nodeError && buildings.length > 0 && nodes.length === 0 && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
            No selectable waypoints found for this building.
          </div>
        )}

        {/* Validation / Calculation Error Alert */}
        {errorMessage && !isGraphConflict && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-brand-danger font-medium flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Concurrency Conflict or Stale Route Alert (HTTP 409 or Graph Version Changed) */}
        {(isGraphConflict || isRouteStale) && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-xs font-bold text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" aria-hidden="true" />
              <div>
                <span className="block text-sm font-black text-amber-950">
                  Route information changed. Recalculate before continuing.
                </span>
                <span className="text-amber-800 font-normal">
                  {calculation?.graph_version !== undefined && latestGraphVersion
                    ? `Route calculated with Graph v${calculation.graph_version}, but the server is now on Graph v${latestGraphVersion}. Recalculate now to generate an up-to-date route.`
                    : 'The campus accessibility graph was updated on the server. Recalculate now to generate an up-to-date route.'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCalculateRoute}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Recalculate Now</span>
            </button>
          </div>
        )}

        {/* Calculate Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleCalculateRoute}
            disabled={isLoadingRoute || !originNodeId || !destinationNodeId || originNodeId === destinationNodeId || buildings.length === 0}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 min-h-[44px] rounded-xl bg-brand-action text-white font-bold text-sm shadow hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Compass className={`w-4 h-4 ${isLoadingRoute ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isLoadingRoute ? 'Calculating...' : 'Calculate Routes'}</span>
          </button>
        </div>
      </section>

      {/* Route Comparison Cards */}
      <RouteComparisonCards
        calculation={calculation}
        activeMode={activeMode}
        onSelectMode={(mode) => setActiveMode(mode)}
        isLoading={isLoadingRoute}
        isStale={isRouteStale}
        latestGraphVersion={latestGraphVersion}
        onRecalculate={handleCalculateRoute}
      />

      {/* Map & Turn-by-Turn Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive Map (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <CampusMap
            buildings={buildings}
            nodes={nodes}
            edges={edges}
            selectedBuildingCode={selectedBuildingCode}
            selectedFloor={selectedFloor}
            onSelectFloor={(floor) => setSelectedFloor(floor)}
            originNodeId={originNodeId}
            destinationNodeId={destinationNodeId}
            fastestRoute={calculation?.routes.fastest}
            stepFreeRoute={calculation?.routes.step_free}
            activeMode={activeMode}
            onSelectNode={(nodeId) => {
              if (!originNodeId || originNodeId === nodeId) {
                setOriginNodeId(nodeId);
              } else {
                setDestinationNodeId(nodeId);
              }
            }}
            geoJson={geoJsonData}
            isLoadingGeoJson={isLoadingGeoJson}
            geoJsonError={geoJsonError}
            onRetryGeoJson={() => loadMapGeoJson()}
            isRouteStale={isRouteStale}
          />
        </div>

        {/* Turn-by-Turn Directions (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <DirectionsPanel
            route={activeRoute ?? null}
            modeName={activeMode === 'step_free' ? 'Step-Free' : 'Fastest'}
            isStale={isRouteStale}
            onRecalculate={handleCalculateRoute}
            routeGraphVersion={calculation?.graph_version}
            latestGraphVersion={latestGraphVersion}
          />
        </div>
      </div>
    </div>
  );
};
