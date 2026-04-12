from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from scheduler import start_scheduler
from cache import get_traffic_data, get_bus_data
import os

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield


app = FastAPI(title="Ankara Traffic Pulse API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:5173")],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/v1/traffic/live")
async def traffic_live():
    return get_traffic_data()


@app.get("/api/v1/buses/live")
async def buses_live():
    return get_bus_data()


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
