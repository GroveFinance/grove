#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Grove - Rebuild Mock Environment${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# Build compose file arguments (conditionally include .local.yaml if it exists)
COMPOSE_FILES="-f compose-mock.yaml"
if [ -f "compose-mock.local.yaml" ]; then
    COMPOSE_FILES="$COMPOSE_FILES -f compose-mock.local.yaml"
    echo "Using local Traefik configuration (compose-mock.local.yaml)"
fi

# Stop current mock containers
echo -e "${YELLOW}[1/2] Stopping mock environment...${NC}"
COMPOSE_PROJECT_NAME=grove-mock docker compose $COMPOSE_FILES down
echo -e "${GREEN}✓ Stopped${NC}"
echo ""

# Start mock environment (no build needed - just node image)
echo -e "${YELLOW}[2/2] Starting mock environment...${NC}"
COMPOSE_PROJECT_NAME=grove-mock docker compose $COMPOSE_FILES up -d
echo -e "${GREEN}✓ Mock environment started${NC}"
echo ""

echo -e "${BLUE}Environment Details:${NC}"
echo "  Name: grove-mock"
echo "  Mode: Frontend with mock API data"
echo "  Access:"
echo "    - Direct: http://localhost:5174"
echo "    - Traefik: (if configured in compose-mock.local.yaml)"
echo ""
echo "To view logs: docker compose $COMPOSE_FILES logs -f"
echo "To stop: docker compose $COMPOSE_FILES down"
echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Mock environment ready!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
