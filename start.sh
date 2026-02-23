#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_ok()   { echo -e "${GREEN}    [OK] $1${NC}"; }
print_warn() { echo -e "${YELLOW}    [WARN] $1${NC}"; }
print_err()  { echo -e "${RED}    [ERROR] $1${NC}"; }

APP_DIR=$(pwd)

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BANKYKIT - Bank & Sacco Management System${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# ── Load .env ────────────────────────────────────────────────
if [ ! -f .env ]; then
    print_err ".env file not found. Run ./install.sh first."
    exit 1
fi
set -a
source .env
set +a

# ── Check DATABASE_URL ───────────────────────────────────────
if [ -z "$DATABASE_URL" ]; then
    print_err "DATABASE_URL is not set in .env"
    echo ""
    echo "  Run ./install.sh to set it up automatically, or edit .env manually:"
    echo "    nano .env"
    echo ""
    echo "  Example:"
    echo "    DATABASE_URL=postgresql://localhost:5432/bankykit"
    exit 1
fi

# ── Find Python in venv ──────────────────────────────────────
PYTHON_CMD=""
for _py in venv/bin/python3.13 venv/bin/python3.12 venv/bin/python3.11 venv/bin/python3 venv/bin/python venv/Scripts/python.exe; do
    if [ -f "$_py" ]; then
        PYTHON_CMD="$_py"
        break
    fi
done
if [ -z "$PYTHON_CMD" ]; then
    PYTHON_CMD=$(command -v python3 2>/dev/null || command -v python 2>/dev/null)
    print_warn "venv not found — using system Python ($PYTHON_CMD). Run ./install.sh if this is unexpected."
fi

# ── Start with PM2 (production) or directly (development) ───
ECO_FILE=""
[ -f ecosystem.config.cjs ] && ECO_FILE="ecosystem.config.cjs"
[ -z "$ECO_FILE" ] && [ -f ecosystem.config.js ] && ECO_FILE="ecosystem.config.js"

if command -v pm2 >/dev/null 2>&1 && [ -n "$ECO_FILE" ]; then
    echo -e "${GREEN}  Starting BANKYKIT with PM2 (production mode)...${NC}"
    echo ""
    pm2 start "$ECO_FILE"
    echo ""
    print_ok "BANKYKIT is running"
    echo ""
    echo "  View logs:    pm2 logs"
    echo "  Status:       pm2 status"
    echo "  Stop:         pm2 stop all"
    echo ""
    echo "  Open:         http://localhost:${PORT:-5000}"
    echo ""
else
    echo -e "${GREEN}  Starting BANKYKIT (development mode)...${NC}"
    echo ""

    # Resolve PYTHON_CMD to absolute path
    case "$PYTHON_CMD" in
        /*) ABS_PYTHON="$PYTHON_CMD" ;;
        *)  ABS_PYTHON="$APP_DIR/$PYTHON_CMD" ;;
    esac

    # Find a free port for uvicorn starting at 8000
    find_free_port() {
        local port=$1
        while ! "$ABS_PYTHON" -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',$port)); s.close()" 2>/dev/null; do
            port=$((port + 1))
        done
        echo $port
    }
    API_PORT=$(find_free_port 8000)
    export API_PORT

    # Backend
    echo "  Starting API server on port $API_PORT..."
    cd python_backend && "$ABS_PYTHON" -m uvicorn main:app --host 0.0.0.0 --port "$API_PORT" --reload &
    BACKEND_PID=$!
    cd "$APP_DIR"

    # Scheduler
    echo "  Starting scheduler..."
    cd python_backend && "$ABS_PYTHON" scheduler.py &
    SCHEDULER_PID=$!
    cd "$APP_DIR"

    # Frontend
    echo "  Starting frontend on port ${PORT:-5000}..."
    npx vite --host 0.0.0.0 --port "${PORT:-5000}" &
    FRONTEND_PID=$!

    echo ""
    echo -e "${BLUE}  ================================================================${NC}"
    echo -e "${GREEN}  BANKYKIT is running!${NC}"
    echo -e "${BLUE}  ================================================================${NC}"
    echo ""
    echo "  App: http://localhost:${PORT:-5000}"
    echo "  API: http://localhost:$API_PORT"
    echo ""
    echo "  Press Ctrl+C to stop"
    echo ""

    trap "kill $BACKEND_PID $SCHEDULER_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
    wait
fi
