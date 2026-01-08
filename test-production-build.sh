#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Grove - Production Build Test${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

# Check if dev environment is running
echo -e "${YELLOW}[1/8] Checking development environment...${NC}"
if docker ps | grep -q "grove_db"; then
    echo -e "${GREEN}✓ Dev database is running${NC}"
    DEV_DB_RUNNING=true
else
    echo -e "${YELLOW}⚠ Dev database not running. Starting it...${NC}"
    docker compose up -d db
    sleep 5
    DEV_DB_RUNNING=false
fi
echo ""

# Get current account count from dev DB (for comparison)
echo -e "${YELLOW}[2/8] Getting baseline data from dev database...${NC}"
ACCOUNT_COUNT=$(docker compose exec -T db psql -U ${POSTGRES_USER:-grove} -d ${POSTGRES_DB:-grove} -t -c "SELECT COUNT(*) FROM accounts;" 2>/dev/null | xargs || echo "0")
TRANSACTION_COUNT=$(docker compose exec -T db psql -U ${POSTGRES_USER:-grove} -d ${POSTGRES_DB:-grove} -t -c "SELECT COUNT(*) FROM transactions;" 2>/dev/null | xargs || echo "0")

echo -e "${GREEN}Current database state:${NC}"
echo "  Accounts: $ACCOUNT_COUNT"
echo "  Transactions: $TRANSACTION_COUNT"
echo ""

# Build production image
echo -e "${YELLOW}[3/8] Building production image...${NC}"
echo "This will take a few minutes (frontend build + backend)..."
docker compose -f docker-compose.prod.yaml build app-prod

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Production build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo ""

# Start production container
echo -e "${YELLOW}[4/8] Starting production container...${NC}"
docker compose -f docker-compose.prod.yaml up -d app-prod
sleep 5
echo -e "${GREEN}✓ Production container started${NC}"
echo ""

# Check logs
echo -e "${YELLOW}[5/8] Checking application logs...${NC}"
docker compose -f docker-compose.prod.yaml logs app-prod | tail -20
echo ""

# Test API endpoints
echo -e "${YELLOW}[6/8] Testing API endpoints...${NC}"

# Test 1: Health/docs
echo -n "  Testing API docs... "
if curl -s http://localhost:8001/api/docs | grep -q "Swagger"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo -e "${RED}API docs not responding${NC}"
fi

# Test 2: Accounts endpoint
echo -n "  Testing /api/account/... "
PROD_ACCOUNT_COUNT=$(curl -s http://localhost:8001/api/account/ | jq 'length' 2>/dev/null || echo "0")
if [ "$PROD_ACCOUNT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ ($PROD_ACCOUNT_COUNT accounts)${NC}"
else
    echo -e "${RED}✗ (No accounts found)${NC}"
fi

# Test 3: Transactions endpoint
echo -n "  Testing /api/transaction/... "
PROD_TX_RESPONSE=$(curl -s http://localhost:8001/api/transaction/?limit=1)
if echo "$PROD_TX_RESPONSE" | jq -e '. | length > 0' >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Test 4: Frontend static files
echo -n "  Testing frontend... "
if curl -s http://localhost:8001/ | grep -q "<!DOCTYPE html>"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

echo ""

# Data consistency check
echo -e "${YELLOW}[7/8] Verifying data consistency...${NC}"
if [ "$ACCOUNT_COUNT" -eq "$PROD_ACCOUNT_COUNT" ]; then
    echo -e "${GREEN}✓ Account count matches dev database${NC}"
else
    echo -e "${YELLOW}⚠ Account count mismatch (dev: $ACCOUNT_COUNT, prod: $PROD_ACCOUNT_COUNT)${NC}"
fi
echo ""

# Summary
echo -e "${YELLOW}[8/8] Test Summary${NC}"
echo "═══════════════════════════════════════════"
echo -e "${BLUE}Production Build:${NC}"
echo "  URL: http://localhost:8001"
echo "  API Docs: http://localhost:8001/api/docs"
echo "  Container: grove_prod_test"
echo ""
echo -e "${BLUE}Development Build:${NC}"
echo "  URL: http://localhost:5173 (if running)"
echo "  API: http://localhost:8000"
echo ""
echo -e "${BLUE}Database:${NC}"
echo "  Shared between dev and prod"
echo "  Data preserved across tests"
echo ""
echo "═══════════════════════════════════════════"
echo ""

# Interactive menu
echo -e "${YELLOW}What would you like to do?${NC}"
echo "1) View production logs (live)"
echo "2) Compare dev vs prod responses"
echo "3) Stop production test"
echo "4) Keep running and exit"
echo ""
read -p "Choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "Showing production logs (Ctrl+C to exit)..."
        docker compose -f docker-compose.prod.yaml logs -f app-prod
        ;;
    2)
        echo ""
        echo -e "${BLUE}Dev API (http://localhost:8000):${NC}"
        curl -s http://localhost:8000/api/account/ | jq -r '.[] | "\(.display_name) - \(.balance)"' | head -5
        echo ""
        echo -e "${BLUE}Prod API (http://localhost:8001):${NC}"
        curl -s http://localhost:8001/api/account/ | jq -r '.[] | "\(.display_name) - \(.balance)"' | head -5
        echo ""
        ;;
    3)
        echo ""
        echo "Stopping production test..."
        docker compose -f docker-compose.prod.yaml down
        echo -e "${GREEN}✓ Stopped${NC}"
        ;;
    4)
        echo ""
        echo -e "${GREEN}Production test still running at http://localhost:8001${NC}"
        echo "To stop later: docker compose -f docker-compose.prod.yaml down"
        ;;
    *)
        echo "Invalid choice"
        ;;
esac

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Production build test complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
