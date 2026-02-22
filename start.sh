#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  BANKY - Bank & Sacco Management System${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

if [ ! -f .env ]; then
    echo -e "${RED}  ✗ .env file not found. Run ./install.sh first.${NC}"
    exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
    echo -e "${RED}  ✗ PM2 is not installed. Install it with:${NC}"
    echo "      sudo npm install -g pm2"
    exit 1
fi

if [ ! -f ecosystem.config.js ]; then
    echo -e "${RED}  ✗ ecosystem.config.js not found.${NC}"
    exit 1
fi

echo -e "${GREEN}  Starting BANKY with PM2...${NC}"
echo ""

pm2 start ecosystem.config.js

echo ""
echo -e "${GREEN}  BANKY is running!${NC}"
echo ""
echo "  View logs:    pm2 logs"
echo "  Status:       pm2 status"
echo "  Stop:         pm2 stop all"
echo ""
echo "  Open:         http://localhost:5000"
echo ""
