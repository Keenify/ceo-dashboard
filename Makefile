.PHONY: dev-frontend dev-backend install-frontend install-backend install dev-env

# Frontend
dev-frontend:
	cd apps/frontend && yarn dev

install-frontend:
	cd apps/frontend && yarn install

# Backend
dev-backend:
	cd apps/backend && uvicorn app.main:app --reload --port 8001

install-backend:
	pip3 install -r apps/backend/requirements.txt

# Install all
install: install-frontend install-backend

# Create env files from examples (skips if already exists)
dev-env:
	@if [ ! -f apps/frontend/.env.local ]; then \
		cp apps/frontend/.env.local.example apps/frontend/.env.local; \
		echo "Created apps/frontend/.env.local — fill in your values"; \
	else \
		echo "apps/frontend/.env.local already exists, skipping"; \
	fi
	@if [ ! -f apps/backend/.env ]; then \
		cp apps/backend/.env.example apps/backend/.env; \
		echo "Created apps/backend/.env — fill in your values"; \
	else \
		echo "apps/backend/.env already exists, skipping"; \
	fi

# Run both concurrently
dev:
	@(cd apps/frontend && yarn dev) & (cd apps/backend && uvicorn app.main:app --reload --port 8001) & wait
