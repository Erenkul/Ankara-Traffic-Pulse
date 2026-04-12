from sqlalchemy import Column, Integer, Float, Boolean, DateTime, String
from sqlalchemy.sql import func
from database import Base


class TrafficSnapshot(Base):
    __tablename__ = "traffic_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    district = Column(String(64), nullable=True)
    current_speed = Column(Integer)
    free_flow_speed = Column(Integer)
    congestion_ratio = Column(Float)
    closed = Column(Boolean, default=False)
    recorded_at = Column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
