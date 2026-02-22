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
REQUIRED_PYTHON="3.11.9"

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

# ── Python: find 3.11+, or use pyenv to install it ──────────
PYTHON_CMD=""

# First pass: check if a suitable version is already on the system
for _candidate in python3.13 python3.12 python3.11 python3 python; do
    if command -v "$_candidate" >/dev/null 2>&1; then
        _major=$("$_candidate" -c "import sys; print(sys.version_info.major)" 2>/dev/null || echo 0)
        _minor=$("$_candidate" -c "import sys; print(sys.version_info.minor)" 2>/dev/null || echo 0)
        if [ "$_major" -ge 3 ] && [ "$_minor" -ge 11 ]; then
            PYTHON_CMD="$_candidate"
            print_ok "$("$_candidate" --version) (using $_candidate)"
            break
        fi
    fi
done

# Second pass: use pyenv to install the required version
if [ -z "$PYTHON_CMD" ]; then
    print_warn "No Python 3.11+ found on system — using pyenv to install Python ${REQUIRED_PYTHON}"

    # Load pyenv into this session if it's already installed
    export PYENV_ROOT="${PYENV_ROOT:-$HOME/.pyenv}"
    export PATH="$PYENV_ROOT/bin:$PATH"

    if ! command -v pyenv >/dev/null 2>&1; then
        echo "    Installing pyenv..."
        if command -v curl >/dev/null 2>&1; then
            curl -fsSL https://pyenv.run | bash
        elif command -v wget >/dev/null 2>&1; then
            wget -qO- https://pyenv.run | bash
        else
            print_err "Neither curl nor wget found — cannot install pyenv"
            print_err "Please install Python 3.11+ manually and re-run this script"
            exit 1
        fi
        print_ok "pyenv installed"
    else
        print_skip "pyenv already installed ($(pyenv --version))"
    fi

    eval "$(pyenv init -)"

    if pyenv versions --bare | grep -q "^${REQUIRED_PYTHON}$"; then
        print_skip "Python ${REQUIRED_PYTHON} already installed in pyenv"
    else
        echo "    Installing Python ${REQUIRED_PYTHON} via pyenv (this may take a few minutes)..."
        pyenv install "$REQUIRED_PYTHON"
        print_ok "Python ${REQUIRED_PYTHON} installed"
    fi

    pyenv local "$REQUIRED_PYTHON"
    PYTHON_CMD="$PYENV_ROOT/versions/${REQUIRED_PYTHON}/bin/python3"
    print_ok "Using Python $($PYTHON_CMD --version) from pyenv"
fi

if [ -z "$PYTHON_CMD" ]; then
    MISSING="${MISSING} Python3"
    print_err "Python 3 not found and pyenv install failed"
fi

if [ -n "$MISSING" ]; then
    echo ""
    print_err "Missing required software:${MISSING}"
    echo ""
    if [ "$PLATFORM" = "mac" ]; then
        echo "  Install with Homebrew:"
        echo "    brew install node"
    elif [ "$PLATFORM" = "windows" ]; then
        echo "  Download and install:"
        echo "    Node.js: https://nodejs.org"
    else
        echo "  Install on Ubuntu/Debian:"
        echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "    sudo apt install -y nodejs"
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

VENV_PYTHON=""
if [ -f "venv/bin/python3" ]; then
    VENV_PYTHON="venv/bin/python3"
elif [ -f "venv/Scripts/python.exe" ]; then
    VENV_PYTHON="venv/Scripts/python.exe"
fi

if [ -d "venv" ] && [ -n "$VENV_PYTHON" ]; then
    _venv_major=$("$VENV_PYTHON" -c "import sys; print(sys.version_info.major)" 2>/dev/null || echo 0)
    _venv_minor=$("$VENV_PYTHON" -c "import sys; print(sys.version_info.minor)" 2>/dev/null || echo 0)
    if [ "$_venv_major" -ge 3 ] && [ "$_venv_minor" -ge 11 ]; then
        print_skip "Virtual environment already exists ($("$VENV_PYTHON" --version))"
    else
        print_warn "Existing venv uses Python $("$VENV_PYTHON" --version 2>&1) — recreating with $($PYTHON_CMD --version)"
        rm -rf venv
        $PYTHON_CMD -m venv venv
        print_ok "Virtual environment recreated ($($PYTHON_CMD --version))"
    fi
else
    $PYTHON_CMD -m venv venv
    print_ok "Python virtual environment created ($($PYTHON_CMD --version))"
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
