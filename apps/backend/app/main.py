from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import the central API router
from app.routers.api_router import api_router


from app.scheduler import start_scheduler

def create_app() -> FastAPI:

    app = FastAPI(title="CEO Dashboard API")

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://www.zackywacky.net",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            # Add your production frontend domain here:
            # "https://your-production-frontend-domain.com",
        ],
        allow_origin_regex=r"https://zw-frontend-[a-zA-Z0-9\-]+-eng-autolabkitcs-projects\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

      # Include the main API router
    # All routes defined in api_router (like /journal-entries) will be available
    app.include_router(api_router)

    # Add root endpoint for basic health check (optional)
    @app.get("/")
    async def root():
        return {"message": "CEO Dashboard API is running"}

    
    # Start the scheduler using FastAPI lifespan event handler
    from contextlib import asynccontextmanager
    @asynccontextmanager
    async def lifespan(app):
        start_scheduler()
        yield
    app.router.lifespan_context = lifespan

    return app

# Create the app instance (used by uvicorn locally, hypercorn in production)
app = create_app()
    