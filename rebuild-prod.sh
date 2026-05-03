#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Grove - Rebuild Prod Environment${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# Build compose file arguments (conditionally include .local.yaml if it exists)
COMPOSE_FILES="-f compose-prod.yaml"
if [ -f "compose-prod.local.yaml" ]; then
    COMPOSE_FILES="$COMPOSE_FILES -f compose-prod.local.yaml"
    echo "Using local Traefik configuration (compose-prod.local.yaml)"
fi

# Stop current prod containers
echo -e "${YELLOW}[1/4] Stopping prod environment...${NC}"
COMPOSE_PROJECT_NAME=grove-prod docker compose $COMPOSE_FILES down
echo -e "${GREEN}✓ Stopped${NC}"
echo ""

# Build production image
echo -e "${YELLOW}[2/4] Building production image...${NC}"
echo "This will take a few minutes (frontend build + backend)..."
COMPOSE_PROJECT_NAME=grove-prod docker compose $COMPOSE_FILES build app
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Production build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo ""

# Start prod environment
echo -e "${YELLOW}[3/4] Starting prod environment...${NC}"
COMPOSE_PROJECT_NAME=grove-prod docker compose $COMPOSE_FILES up -d
echo -e "${GREEN}✓ Prod environment started${NC}"
echo ""

# Health check
echo -e "${YELLOW}[4/4] Running health checks...${NC}"
sleep 5
if COMPOSE_PROJECT_NAME=grove-prod docker compose $COMPOSE_FILES ps | grep -q "grove-prod"; then
    echo -e "${GREEN}✓ Production app is running${NC}"
    echo ""
    echo -e "${BLUE}Environment Details:${NC}"
    echo "  Name: grove-prod"
    echo "  Database: budget-prod (isolated from dev)"
    echo "  Mode: Production build (locally built image)"
    echo "  Access:"
    echo "    - Direct: http://localhost:8002"
    echo "    - Traefik: (if configured in compose-prod.local.yaml)"
    echo ""
    echo "To view logs: docker compose $COMPOSE_FILES logs -f app"
    echo "To stop: docker compose $COMPOSE_FILES down"
else
    echo -e "${RED}✗ Production app failed to start${NC}"
    echo "Check logs: docker compose $COMPOSE_FILES logs app"
    exit 1
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Prod environment ready!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
