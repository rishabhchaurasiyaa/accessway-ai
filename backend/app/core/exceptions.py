from fastapi import HTTPException, status


class InvalidRouteRequestError(HTTPException):
    def __init__(self, detail: str = "INVALID_ROUTE_REQUEST: Missing or malformed route coordinates."):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class NodeNotFoundError(HTTPException):
    def __init__(self, detail: str = "NODE_NOT_FOUND: Selected origin or destination node does not exist."):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class GraphChangedError(HTTPException):
    def __init__(self, detail: str = "GRAPH_CHANGED: Campus graph version changed during route calculation. Please retry."):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class NoVerifiedRouteError(HTTPException):
    def __init__(self, detail: str = "NO_VERIFIED_ROUTE: No eligible verified path exists between the selected nodes."):
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)
