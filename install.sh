#!/bin/bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "\n${GREEN}>>> $1${NC}"; }
print_ok()   { echo -e "${GREEN}    [OK] $1${NC}"; }
print_skip() { echo -e "${YELLOW}    [SKIP] $1${NC}"; }
print_warn() { echo -e "${YELLOW}    [WARN] $1${NC}"; }
print_err()  { echo -e "${RED}    [ERROR] $1${NC}"; }

APP_DIR=$(pwd)

echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}  BANKY - Bank & Sacco Management System${NC}"
echo -e "${BLUE}  Installer${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# ── Detect platform ──
PLATFORM="linux"
case "$(uname -s)" in
    Darwin*)  PLATFORM="mac" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
esac
echo "  Platform: ${PLATFORM}"

# ══════════════════════════════════════════════════════════════
#  Check prerequisites
# ══════════════════════════════════════════════════════════════
print_step "Step 1/5: Checking prerequisites..."

MISSING=""

if command -v node >/dev/null 2>&1; then
    print_ok "Node.js $(node -v)"
else
    MISSING="${MISSING} Node.js"
    print_err "Node.js not found"
fi

PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
    PY_VER=$(python3 --version 2>&1)
    PY_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")
    PY_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
    if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 11 ]; then
        print_ok "$PY_VER"
    else
        MISSING="${MISSING} Python3.11+"
        print_err "$PY_VER is too old — Python 3.11+ is required"
    fi
elif command -v python >/dev/null 2>&1; then
    PY_VER=$(python --version 2>&1)
    if echo "$PY_VER" | grep -q "Python 3"; then
        PY_MINOR=$(python -c "import sys; print(sys.version_info.minor)")
        PY_MAJOR=$(python -c "import sys; print(sys.version_info.major)")
        if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 11 ]; then
            PYTHON_CMD="python"
            print_ok "$PY_VER"
        else
            MISSING="${MISSING} Python3.11+"
            print_err "$PY_VER is too old — Python 3.11+ is required"
        fi
    else
        MISSING="${MISSING} Python3"
        print_err "Python 3 not found (found Python 2)"
    fi
else
    MISSING="${MISSING} Python3"
    print_err "Python 3 not found"
fi

if [ -n "$MISSING" ]; then
    echo ""
    print_err "Missing or incompatible required software:${MISSING}"
    echo ""
    if [ "$PLATFORM" = "mac" ]; then
        echo "  Install with Homebrew:"
        echo "    brew install node python@3.11"
    elif [ "$PLATFORM" = "windows" ]; then
        echo "  Download and install:"
        echo "    Node.js:  https://nodejs.org"
        echo "    Python 3: https://python.org (check 'Add to PATH')"
        echo "              Make sure to install version 3.11 or newer"
    else
        echo "  Install on Ubuntu/Debian:"
        echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "    sudo apt install -y nodejs python3.11 python3.11-venv python3-pip"
    fi
    echo ""
    echo "  After installing, run this script again."
    exit 1
fi

# ══════════════════════════════════════════════════════════════
#  Environment configuration
# ══════════════════════════════════════════════════════════════
print_step "Step 2/5: Setting up environment..."

if [ -f .env ]; then
    print_skip ".env already exists (your settings are preserved)"
else
    SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "change-me-to-a-random-string-at-least-32-chars")
    cp .env.example .env
    if [ "$PLATFORM" = "mac" ] || [ "$PLATFORM" = "windows" ]; then
        sed -i.bak "s|SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|" .env 2>/dev/null || true
        rm -f .env.bak
    else
        sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|" .env
    fi
    print_ok ".env file created from template"
    echo ""
    print_warn "IMPORTANT: Edit .env and set your DATABASE_URL"
    echo "    Open .env in a text editor and update the database connection string."
    echo ""
    echo "    Example: DATABASE_URL=postgresql://user:password@localhost:5432/banky"
fi

# ══════════════════════════════════════════════════════════════
#  Install Node.js dependencies
# ══════════════════════════════════════════════════════════════
print_step "Step 3/5: Installing frontend dependencies..."

npm install 2>&1 | tail -5
print_ok "Node.js dependencies installed"

# ══════════════════════════════════════════════════════════════
#  Install Python dependencies
# ══════════════════════════════════════════════════════════════
print_step "Step 4/5: Installing Python backend dependencies..."

if [ ! -d "venv" ]; then
    $PYTHON_CMD -m venv venv
    print_ok "Python virtual environment created"
else
    print_skip "Virtual environment already exists"
fi

if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
fi

pip install --upgrade pip -q 2>/dev/null || true

if pip install -r python_backend/requirements.txt 2>&1; then
    print_ok "Python dependencies installed"
else
    echo ""
    print_err "Failed to install Python dependencies"
    echo ""
    echo "  Common causes:"
    echo "    - No internet connection"
    echo "    - Python version incompatible (need 3.11+, found: $($PYTHON_CMD --version))"
    echo "    - pip not available in the virtual environment"
    echo ""
    echo "  Try running manually:"
    echo "    source venv/bin/activate"
    echo "    pip install -r python_backend/requirements.txt"
    deactivate 2>/dev/null || true
    exit 1
fi

deactivate 2>/dev/null || true

# ══════════════════════════════════════════════════════════════
#  Setup directories & build
# ══════════════════════════════════════════════════════════════
print_step "Step 5/5: Building application..."

mkdir -p python_backend/uploads logs backups
npx vite build 2>&1 | tail -3
print_ok "Frontend built successfully"

# ══════════════════════════════════════════════════════════════
#  Done
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}================================================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""
echo "  Before starting, make sure:"
echo "    1. PostgreSQL is running and accessible"
echo "    2. DATABASE_URL in .env points to your database"
echo ""
echo "  To start BANKY:"
echo ""
echo "    ./start.sh"
echo ""
echo "  Then open: http://localhost:5000"
echo ""
echo "  For production deployment (Nginx, PM2, SSL), see the"
echo "  deployment guide in the documentation."
echo ""
echo "  All features are unlocked. No license key needed."
echo ""
