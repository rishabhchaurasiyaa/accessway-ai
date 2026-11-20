/**
 * ACCESSWAY AI — Demonstration & Automated Test Fixtures
 * 
 * IMPORTANT: This module is strictly for automated test suites and benchmarks.
 * It is isolated in the test directory and MUST NEVER be imported by production
 * application pages or services.
 */

import { CampusBuilding, CampusNode, CampusEdge, CampusMapGeoJson, CampusMapFeature } from '@/types/campus';
import { AccessibilityReport } from '@/types/incident';

export const DEMO_BUILDINGS: CampusBuilding[] = [
  {
    id: 'b1000000-0000-0000-0000-000000000001',
    building_code: 'BLDG-A',
    name: 'Campus Academic Complex A (Synthetic Placeholder)',
    description: 'Main academic lecture halls and administrative offices. Test fixture only.',
    centroid_lat: 31.2460,
    centroid_lng: 75.7020,
    floors: [
      { floor_label: 'Ground', floor_number: 0, name: 'Ground Floor' },
      { floor_label: 'Floor 1', floor_number: 1, name: 'First Floor' }
    ],
    is_active: true
  },
  {
    id: 'b2000000-0000-0000-0000-000000000002',
    building_code: 'BLDG-B',
    name: 'Science & Technology Complex B (Synthetic Placeholder)',
    description: 'Laboratories and computing centers. Test fixture only.',
    centroid_lat: 31.2472,
    centroid_lng: 75.7035,
    floors: [
      { floor_label: 'Ground', floor_number: 0, name: 'Ground Floor' },
      { floor_label: 'Floor 1', floor_number: 1, name: 'First Floor' }
    ],
    is_active: true
  },
  {
    id: 'b3000000-0000-0000-0000-000000000003',
    building_code: 'BLDG-C',
    name: 'Central Student Center C (Synthetic Placeholder)',
    description: 'Student library and accessibility resource hub. Test fixture only.',
    centroid_lat: 31.2455,
    centroid_lng: 75.7048,
    floors: [
      { floor_label: 'Ground', floor_number: 0, name: 'Ground Floor' }
    ],
    is_active: true
  }
];

export const DEMO_NODES: CampusNode[] = [
  {
    id: 'n0000000-0000-0000-0000-000000000001',
    building_id: null,
    node_code: 'NODE-OUTDOOR-PLAZA',
    name: 'Central Plaza Fountain',
    node_type: 'landmark',
    floor_label: null,
    latitude: 31.2465,
    longitude: 75.7028,
    operational_status: 'available',
    landmark_description: '[Test Fixture] Central circular stone water fountain placeholder',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'n0000000-0000-0000-0000-000000000002',
    building_id: null,
    node_code: 'NODE-OUTDOOR-NORTH-JCT',
    name: 'North Walkway Junction',
    node_type: 'junction',
    floor_label: null,
    latitude: 31.2469,
    longitude: 75.7031,
    operational_status: 'available',
    landmark_description: '[Test Fixture] North paved walkway junction placeholder',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'n0000000-0000-0000-0000-000000000003',
    building_id: null,
    node_code: 'NODE-OUTDOOR-SOUTH-JCT',
    name: 'South Garden Crossing',
    node_type: 'junction',
    floor_label: null,
    latitude: 31.2457,
    longitude: 75.7038,
    operational_status: 'available',
    landmark_description: '[Test Fixture] South walkway intersection placeholder',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'na000000-0000-0000-0000-000000000001',
    building_id: 'b1000000-0000-0000-0000-000000000001',
    node_code: 'NODE-BLDGA-ENTRANCE-MAIN',
    name: 'Building A Main West Entrance',
    node_type: 'entrance',
    floor_label: 'Ground',
    latitude: 31.2461,
    longitude: 75.7018,
    operational_status: 'available',
    landmark_description: '[Test Fixture] Main entrance threshold placeholder with automated double doors',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'na000000-0000-0000-0000-000000000002',
    building_id: 'b1000000-0000-0000-0000-000000000001',
    node_code: 'NODE-BLDGA-FOYER',
    name: 'Building A Ground Foyer & Info Desk',
    node_type: 'landmark',
    floor_label: 'Ground',
    latitude: 31.2460,
    longitude: 75.7020,
    operational_status: 'available',
    landmark_description: '[Test Fixture] Information desk with tactile reception bell',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'na000000-0000-0000-0000-000000000003',
    building_id: 'b1000000-0000-0000-0000-000000000001',
    node_code: 'NODE-BLDGA-ELEVATOR-G',
    name: 'Building A Ground Elevator Bank',
    node_type: 'lift',
    floor_label: 'Ground',
    latitude: 31.2459,
    longitude: 75.7021,
    operational_status: 'available',
    landmark_description: '[Test Fixture] Braille elevator hall call station with audible floor chimes',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'na000000-0000-0000-0000-000000000004',
    building_id: 'b1000000-0000-0000-0000-000000000001',
    node_code: 'NODE-BLDGA-STAIRS-G',
    name: 'Building A Central Staircase (Ground)',
    node_type: 'junction',
    floor_label: 'Ground',
    latitude: 31.2458,
    longitude: 75.7019,
    operational_status: 'available',
    landmark_description: '[Test Fixture] Concrete staircase with dual continuous metal handrails',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'na000000-0000-0000-0000-000000000005',
    building_id: 'b1000000-0000-0000-0000-000000000001',
    node_code: 'NODE-BLDGA-RAMP-EAST',
    name: 'Building A East Access Ramp',
    node_type: 'ramp',
    floor_label: 'Ground',
    latitude: 31.2462,
    longitude: 75.7023,
    operational_status: 'available',
    landmark_description: '[Test Fixture] 1:12 ADA-compliant ramp with textured yellow safety landing',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'na000000-0000-0000-0000-000000000006',
    building_id: 'b1000000-0000-0000-0000-000000000001',
    node_code: 'NODE-BLDGA-ELEVATOR-1',
    name: 'Building A Floor 1 Elevator Bank',
    node_type: 'lift',
    floor_label: 'Floor 1',
    latitude: 31.2459,
    longitude: 75.7021,
    operational_status: 'available',
    landmark_description: '[Test Fixture] Floor 1 elevator lobby adjacent to Accessible Restroom',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'na000000-0000-0000-0000-000000000007',
    building_id: 'b1000000-0000-0000-0000-000000000001',
    node_code: 'NODE-BLDGA-STAIRS-1',
    name: 'Building A Central Staircase (Floor 1)',
    node_type: 'junction',
    floor_label: 'Floor 1',
    latitude: 31.2458,
    longitude: 75.7019,
    operational_status: 'available',
    landmark_description: '[Test Fixture] Staircase landing with high-contrast yellow tactile step treads',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'na000000-0000-0000-0000-000000000008',
    building_id: 'b1000000-0000-0000-0000-000000000001',
    node_code: 'NODE-BLDGA-LECTURE-101',
    name: 'Lecture Hall A-101 (Accessible Seating)',
    node_type: 'destination',
    floor_label: 'Floor 1',
    latitude: 31.2463,
    longitude: 75.7022,
    operational_status: 'available',
    landmark_description: '[Test Fixture] Tiered lecture hall with level wheelchair gallery entrance at back',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'nb000000-0000-0000-0000-000000000001',
    building_id: 'b2000000-0000-0000-0000-000000000002',
    node_code: 'NODE-BLDGB-ENTRANCE-WEST',
    name: 'Building B West Entrance',
    node_type: 'entrance',
    floor_label: 'Ground',
    latitude: 31.2470,
    longitude: 75.7032,
    operational_status: 'available',
    landmark_description: '[Test Fixture] Power-assist accessible push-button door with blue disability glyph',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'nb000000-0000-0000-0000-000000000002',
    building_id: 'b2000000-0000-0000-0000-000000000002',
    node_code: 'NODE-BLDGB-LIFT-G',
    name: 'Building B North Lift (Ground)',
    node_type: 'lift',
    floor_label: 'Ground',
    latitude: 31.2473,
    longitude: 75.7036,
    operational_status: 'available',
    landmark_description: '[Test Fixture] Voice-announcing high-capacity stretcher elevator',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'nc000000-0000-0000-0000-000000000001',
    building_id: 'b3000000-0000-0000-0000-000000000003',
    node_code: 'NODE-BLDGC-ENTRANCE-NORTH',
    name: 'Building C North Accessible Entrance',
    node_type: 'entrance',
    floor_label: 'Ground',
    latitude: 31.2458,
    longitude: 75.7045,
    operational_status: 'available',
    landmark_description: '[Test Fixture] Zero-threshold automatic sliding glass doors',
    verification_status: 'verified',
    is_active: true
  },
  {
    id: 'nc000000-0000-0000-0000-000000000002',
    building_id: 'b3000000-0000-0000-0000-000000000003',
    node_code: 'NODE-BLDGC-LIBRARY-HUB',
    name: 'Building C Accessible Library Hub',
    node_type: 'landmark',
    floor_label: 'Ground',
    latitude: 31.2454,
    longitude: 75.7049,
    operational_status: 'available',
    landmark_description: '[Test Fixture] Assistive technology workstation hub with height-adjustable desks',
    verification_status: 'verified',
    is_active: true
  }
];

export const DEMO_EDGES: CampusEdge[] = [
  {
    id: 'ea000001-0000-0000-0000-000000000001',
    from_node_id: 'na000000-0000-0000-0000-000000000001',
    to_node_id: 'na000000-0000-0000-0000-000000000002',
    distance_m: 15.0,
    estimated_seconds: 12,
    path_type: 'corridor',
    stairs_count: 0,
    slope_percent: 0.0,
    clear_width_cm: 220.0,
    wheelchair_accessible: true,
    tactile_guidance: true,
    verification_status: 'verified',
    operational_status: 'available',
    landmark_instruction: 'Pass through the West Entrance doors and proceed straight ahead 15 meters to the Information Desk.'
  },
  {
    id: 'ea000001-0000-0000-0000-000000000002',
    from_node_id: 'na000000-0000-0000-0000-000000000002',
    to_node_id: 'na000000-0000-0000-0000-000000000001',
    distance_m: 15.0,
    estimated_seconds: 12,
    path_type: 'corridor',
    stairs_count: 0,
    slope_percent: 0.0,
    clear_width_cm: 220.0,
    wheelchair_accessible: true,
    tactile_guidance: true,
    verification_status: 'verified',
    operational_status: 'available',
    landmark_instruction: 'From the Information Desk, walk 15 meters west to exit through the Main West Entrance.'
  },
  {
    id: 'ea000002-0000-0000-0000-000000000001',
    from_node_id: 'na000000-0000-0000-0000-000000000002',
    to_node_id: 'na000000-0000-0000-0000-000000000003',
    distance_m: 10.0,
    estimated_seconds: 8,
    path_type: 'corridor',
    stairs_count: 0,
    slope_percent: 0.0,
    clear_width_cm: 200.0,
    wheelchair_accessible: true,
    tactile_guidance: true,
    verification_status: 'verified',
    operational_status: 'available',
    landmark_instruction: 'From the Information Desk, turn slight right and follow the tactile path 10 meters to the Ground Elevator Bank.'
  },
  {
    id: 'ea000003-0000-0000-0000-000000000001',
    from_node_id: 'na000000-0000-0000-0000-000000000003',
    to_node_id: 'na000000-0000-0000-0000-000000000006',
    distance_m: 4.5,
    estimated_seconds: 18,
    path_type: 'lift',
    stairs_count: 0,
    slope_percent: 0.0,
    clear_width_cm: 140.0,
    wheelchair_accessible: true,
    tactile_guidance: true,
    verification_status: 'verified',
    operational_status: 'available',
    landmark_instruction: 'Enter Elevator, press Floor 1. Audible chime will sound upon arrival at Floor 1.'
  },
  {
    id: 'ea000004-0000-0000-0000-000000000001',
    from_node_id: 'na000000-0000-0000-0000-000000000006',
    to_node_id: 'na000000-0000-0000-0000-000000000008',
    distance_m: 22.0,
    estimated_seconds: 18,
    path_type: 'corridor',
    stairs_count: 0,
    slope_percent: 0.0,
    clear_width_cm: 200.0,
    wheelchair_accessible: true,
    tactile_guidance: true,
    verification_status: 'verified',
    operational_status: 'available',
    landmark_instruction: 'Exit elevator on Floor 1, follow tactile corridor 22 meters north to Lecture Hall A-101.'
  },
  {
    id: 'ea000005-0000-0000-0000-000000000001',
    from_node_id: 'na000000-0000-0000-0000-000000000002',
    to_node_id: 'na000000-0000-0000-0000-000000000004',
    distance_m: 8.0,
    estimated_seconds: 6,
    path_type: 'corridor',
    stairs_count: 0,
    slope_percent: 0.0,
    clear_width_cm: 180.0,
    wheelchair_accessible: true,
    tactile_guidance: true,
    verification_status: 'verified',
    operational_status: 'available',
    landmark_instruction: 'Walk 8 meters from Info Desk to the base of the Central Staircase.'
  },
  {
    id: 'ea000006-0000-0000-0000-000000000001',
    from_node_id: 'na000000-0000-0000-0000-000000000004',
    to_node_id: 'na000000-0000-0000-0000-000000000007',
    distance_m: 6.0,
    estimated_seconds: 14,
    path_type: 'stairs',
    stairs_count: 18,
    slope_percent: 32.0,
    clear_width_cm: 160.0,
    wheelchair_accessible: false,
    tactile_guidance: true,
    verification_status: 'verified',
    operational_status: 'available',
    landmark_instruction: 'Ascend Central Staircase (18 steps with dual handrails) to Floor 1 landing.'
  },
  {
    id: 'ea000007-0000-0000-0000-000000000001',
    from_node_id: 'na000000-0000-0000-0000-000000000007',
    to_node_id: 'na000000-0000-0000-0000-000000000008',
    distance_m: 18.0,
    estimated_seconds: 14,
    path_type: 'corridor',
    stairs_count: 0,
    slope_percent: 0.0,
    clear_width_cm: 180.0,
    wheelchair_accessible: true,
    tactile_guidance: false,
    verification_status: 'verified',
    operational_status: 'available',
    landmark_instruction: 'From stair landing, turn right and walk 18 meters to Lecture Hall A-101.'
  }
];

export const INITIAL_REPORTS: AccessibilityReport[] = [
  {
    id: 'rep-001',
    target_type: 'edge',
    target_id: 'ea000001-0000-0000-0000-000000000001',
    target_label: 'Building A West Approach Path',
    building_code: 'BLDG-A',
    floor_label: 'Ground',
    issue_type: 'path_obstruction',
    description: 'Temporary landscaping work blocking the path.',
    photo_url: null,
    status: 'pending_review',
    created_at: new Date().toISOString(),
    reporter_user_id: null
  }
];

export function getDemoGeoJson(): CampusMapGeoJson {
  const features: CampusMapFeature[] = [];

  for (const node of DEMO_NODES) {
    if (node.latitude != null && node.longitude != null) {
      features.push({
        type: 'Feature',
        id: node.id,
        geometry: {
          type: 'Point',
          coordinates: [node.longitude, node.latitude]
        },
        properties: {
          node_code: node.node_code,
          name: node.name,
          node_type: node.node_type,
          floor_label: node.floor_label,
          operational_status: node.operational_status,
          verification_status: node.verification_status,
          landmark_description: node.landmark_description
        }
      });
    }
  }

  const coordsMap = new Map<string, [number, number]>();
  for (const node of DEMO_NODES) {
    if (node.latitude != null && node.longitude != null) {
      coordsMap.set(node.id, [node.longitude, node.latitude]);
    }
  }

  for (const edge of DEMO_EDGES) {
    const from = coordsMap.get(edge.from_node_id);
    const to = coordsMap.get(edge.to_node_id);
    if (from && to) {
      features.push({
        type: 'Feature',
        id: edge.id,
        geometry: {
          type: 'LineString',
          coordinates: [from, to]
        },
        properties: {
          from_node_id: edge.from_node_id,
          to_node_id: edge.to_node_id,
          distance_m: edge.distance_m,
          estimated_seconds: edge.estimated_seconds,
          path_type: edge.path_type,
          wheelchair_accessible: edge.wheelchair_accessible,
          stairs_count: edge.stairs_count,
          verification_status: edge.verification_status,
          operational_status: edge.operational_status
        }
      });
    }
  }

  return {
    type: 'FeatureCollection',
    graph_version: 1,
    features
  };
}
