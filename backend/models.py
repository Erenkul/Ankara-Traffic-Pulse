from pydantic import BaseModel
from typing import Optional


class TrafficPoint(BaseModel):
    currentSpeed: int
    freeFlowSpeed: int
    congestionRatio: float
    closed: bool


class TrafficFeature(BaseModel):
    type: str = "Feature"
    geometry: dict
    properties: TrafficPoint


class TrafficCollection(BaseModel):
    type: str = "FeatureCollection"
    features: list[TrafficFeature]


class BusLocation(BaseModel):
    hatNo: str
    enlem: float
    boylam: float
    hiz: Optional[int] = None
    yon: Optional[int] = None
