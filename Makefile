.PHONY: dev-frontend dev-backend install-frontend install-backend install

# Frontend
dev-frontend:
	cd apps/frontend && yarn dev

install-frontend:
	cd apps/frontend && yarn install

# Backend
dev-backend:
	cd apps/backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

install-backend:
	cd apps/backend && pip install -r requirements.txt

# Install all
install: install-frontend install-backend

# Run both (requires two terminals or use: make dev-frontend & make dev-backend)
dev:
	@echo "Start frontend: make dev-frontend"
	@echo "Start backend:  make dev-backend"
