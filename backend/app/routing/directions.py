from dataclasses import dataclass
from typing import Dict, List, Optional
from app.routing.dijkstra import DijkstraEdge
from app.routing.graph_builder import RoutingNode


@dataclass
class DirectionStep:
    step: int
    instruction: str
    landmark: Optional[str]
    speech_text: str

    def to_dict(self) -> dict:
        return {
            "step": self.step,
            "instruction": self.instruction,
            "landmark": self.landmark,
            "speech_text": self.speech_text,
        }


class DirectionGenerator:
    """
    Generates sensory-grounded landmark directions from a path of nodes and edges.
    Formatted for both on-screen display and TalkBack / VoiceOver spoken narration.
    """

    @staticmethod
    def generate_steps(
        path_node_ids: List[str],
        path_edges: List[DijkstraEdge],
        nodes_map: Dict[str, RoutingNode],
        mode: str = "fastest",
    ) -> List[DirectionStep]:
        if not path_node_ids:
            return []

        # Handle zero-length route (start == destination)
        if len(path_node_ids) == 1:
            node = nodes_map.get(path_node_ids[0])
            node_name = node.name if node else "your selected location"
            return [
                DirectionStep(
                    step=1,
                    instruction=f"You are already at your destination: {node_name}.",
                    landmark=node.landmark_description if node and node.landmark_description else None,
                    speech_text=f"You are already at {node_name}.",
                )
            ]

        steps: List[DirectionStep] = []
        step_number = 1

        origin_node = nodes_map.get(path_node_ids[0])
        origin_name = origin_node.name if origin_node else "Start Location"
        origin_floor = f" on {origin_node.floor_label}" if origin_node and origin_node.floor_label else ""

        # Step 1: Departure instruction
        landmark_cue = origin_node.landmark_description if origin_node and origin_node.landmark_description else None
        if landmark_cue:
            start_instr = f"Start at {origin_name}{origin_floor}. Landmark cue: {landmark_cue}."
            speech_start = f"Starting at {origin_name}{origin_floor}. Notice {landmark_cue}."
        else:
            start_instr = f"Start at {origin_name}{origin_floor}."
            speech_start = f"Starting at {origin_name}{origin_floor}."

        steps.append(
            DirectionStep(
                step=step_number,
                instruction=start_instr,
                landmark=landmark_cue,
                speech_text=speech_start,
            )
        )
        step_number += 1

        # Intermediate edges traversal
        for edge in path_edges:
            target_node = nodes_map.get(edge.to_node_id)
            target_name = target_node.name if target_node else "the next waypoint"
            target_floor = f" ({target_node.floor_label})" if target_node and target_node.floor_label else ""
            target_landmark = target_node.landmark_description if target_node and target_node.landmark_description else None

            # Determine specific instruction based on edge path_type
            if edge.path_type == "lift":
                instr = f"Take the verified lift to {target_name}{target_floor}."
                if edge.data and edge.data.get("landmark_instruction"):
                    instr = f"{instr} {edge.data['landmark_instruction']}"
                speech = f"Take the elevator to {target_name}{target_floor}."

            elif edge.path_type == "stairs":
                instr = f"Take the stairs ({int(edge.distance_m)}m) to {target_name}{target_floor}."
                if edge.data and edge.data.get("landmark_instruction"):
                    instr = f"{instr} {edge.data['landmark_instruction']}"
                speech = f"Ascend or descend the stairs to {target_name}."

            elif edge.path_type == "ramp":
                instr = f"Proceed along the access ramp for {int(edge.distance_m)} meters towards {target_name}."
                if edge.data and edge.data.get("landmark_instruction"):
                    instr = f"{instr} {edge.data['landmark_instruction']}"
                speech = f"Follow the ramp for {int(edge.distance_m)} meters towards {target_name}."

            else:
                # Walkway / corridor / crossing
                if edge.data and edge.data.get("landmark_instruction"):
                    instr = edge.data["landmark_instruction"]
                    speech = edge.data["landmark_instruction"]
                else:
                    instr = f"Continue straight along the {edge.path_type} for {int(edge.distance_m)} meters towards {target_name}."
                    speech = f"Continue along the {edge.path_type} for {int(edge.distance_m)} meters towards {target_name}."

            steps.append(
                DirectionStep(
                    step=step_number,
                    instruction=instr,
                    landmark=target_landmark,
                    speech_text=speech,
                )
            )
            step_number += 1

        # Final Arrival Step
        dest_node = nodes_map.get(path_node_ids[-1])
        dest_name = dest_node.name if dest_node else "Destination"
        dest_floor = f" on {dest_node.floor_label}" if dest_node and dest_node.floor_label else ""
        dest_landmark = dest_node.landmark_description if dest_node and dest_node.landmark_description else None

        arrival_instr = f"Arrive at your destination: {dest_name}{dest_floor}."
        if dest_landmark:
            arrival_instr = f"{arrival_instr} Landmark: {dest_landmark}."
            arrival_speech = f"You have arrived at {dest_name}{dest_floor}. Notice {dest_landmark}."
        else:
            arrival_speech = f"You have arrived at {dest_name}{dest_floor}."

        steps.append(
            DirectionStep(
                step=step_number,
                instruction=arrival_instr,
                landmark=dest_landmark,
                speech_text=arrival_speech,
            )
        )

        return steps
