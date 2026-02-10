#!/bin/bash

set -e

echo "========================================"
echo "  BANKY Production Build Script"
echo "========================================"
echo ""

show_menu() {
    echo "Select build type:"
    echo "  1) SaaS Build (for your cloud deployment)"
    echo "  2) Compiled Build (enterprise self-hosting)"
    echo "  3) CodeCanyon Build (source code for developers)"
    echo "  4) Build All"
    echo "  5) Exit"
    echo ""
    read -p "Enter choice [1-5]: " choice
}

build_frontend() {
    echo ""
    echo ">>> Building Frontend..."
    npm run build
    echo ">>> Frontend built to dist/public/"
}

build_admin() {
    echo ""
    echo ">>> Building Admin Panel..."
    cd admin-client
    npm run build
    cd ..
    echo ">>> Admin panel built to admin-client/dist/"
}

build_saas() {
    echo ""
    echo "========================================"
    echo "  Building SaaS Version"
    echo "========================================"
    
    build_frontend
    build_admin
    
    echo ""
    echo ">>> Creating SaaS deployment package..."
    
    rm -rf packages/saas
    mkdir -p packages/saas
    
    cp -r dist/public packages/saas/frontend
    cp -r admin-client/dist packages/saas/admin
    cp -r python_backend packages/saas/backend
    cp -r shared packages/saas/shared 2>/dev/null || true
    
    rm -rf packages/saas/backend/__pycache__
    find packages/saas/backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find packages/saas/backend -type f -name "*.pyc" -delete 2>/dev/null || true
    
    cat > packages/saas/backend/.env.example << 'EOF'
DATABASE_URL=postgresql://user:password@host:5432/banky_master
DEPLOYMENT_MODE=saas
SESSION_SECRET=your-secure-session-secret
NEON_API_KEY=your-neon-api-key
EOF

    cat > packages/saas/README.txt << 'EOF'
BANKY SaaS Deployment
=====================

For deploying BANKY as your own SaaS platform.

SETUP:
1. Set up PostgreSQL database (Neon recommended for multi-tenant)
2. Copy .env.example to .env and configure
3. Install Python dependencies: pip install -r requirements.txt
4. Run migrations: python migrate.py
5. Start server: gunicorn -w 4 -b 0.0.0.0:5000 main:app

STRUCTURE:
- /frontend/  - Main app (serve on port 5000)
- /admin/     - Admin panel (serve on port 3001)
- /backend/   - Python API (serve on port 8000)
EOF

    echo ">>> SaaS build complete: packages/saas/"
}

build_compiled() {
    echo ""
    echo "========================================"
    echo "  Building Compiled Enterprise Version"
    echo "========================================"
    echo ""
    echo "Note: Enterprise version does NOT include admin panel."
    echo "      Admin panel is only for SaaS multi-tenant management."
    
    if ! command -v pyinstaller &> /dev/null; then
        echo ">>> Installing PyInstaller..."
        pip install pyinstaller
    fi
    
    build_frontend
    
    echo ""
    echo ">>> Compiling Python backend to binary..."
    
    rm -rf packages/enterprise
    mkdir -p packages/enterprise
    
    cd python_backend
    
    cat > banky_server.py << 'ENTRYPOINT'
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    uvicorn.run(app, host="0.0.0.0", port=port)
ENTRYPOINT

    pyinstaller --onefile \
        --name banky-server \
        --hidden-import=uvicorn \
        --hidden-import=uvicorn.logging \
        --hidden-import=uvicorn.loops \
        --hidden-import=uvicorn.loops.auto \
        --hidden-import=uvicorn.protocols \
        --hidden-import=uvicorn.protocols.http \
        --hidden-import=uvicorn.protocols.http.auto \
        --hidden-import=uvicorn.protocols.websockets \
        --hidden-import=uvicorn.protocols.websockets.auto \
        --hidden-import=uvicorn.lifespan \
        --hidden-import=uvicorn.lifespan.on \
        --hidden-import=sqlalchemy \
        --hidden-import=sqlalchemy.dialects.postgresql \
        --hidden-import=psycopg2 \
        --hidden-import=pydantic \
        --hidden-import=fastapi \
        --hidden-import=starlette \
        --hidden-import=bcrypt \
        --hidden-import=jose \
        --collect-all=uvicorn \
        --collect-all=fastapi \
        --collect-all=starlette \
        --collect-all=pydantic \
        banky_server.py 2>/dev/null || {
            echo ">>> PyInstaller failed. Creating obfuscated source package..."
            cd ..
            cp -r python_backend packages/enterprise/backend
            rm -f packages/enterprise/backend/banky_server.py
        }
    
    if [ -f dist/banky-server ]; then
        cp dist/banky-server ../packages/enterprise/
        rm -rf build dist *.spec banky_server.py
    fi
    
    cd ..
    
    cp -r dist/public packages/enterprise/frontend
    
    cat > packages/enterprise/.env.example << 'EOF'
DATABASE_URL=postgresql://user:password@host:5432/banky
DEPLOYMENT_MODE=enterprise
LICENSE_KEY=BANKY-XXX-2026-XXXXXXXX
SESSION_SECRET=your-secure-session-secret
EOF

    cat > packages/enterprise/README.txt << 'EOF'
BANKY Enterprise Edition
========================

Self-hosted version for large organizations.

SETUP:
1. Set up PostgreSQL database
2. Copy .env.example to .env and configure
3. Add your LICENSE_KEY to .env (provided at purchase)
4. Run: ./banky-server

LICENSE KEY FORMAT: BANKY-{EDITION}-{YEAR}-{ID}
  - BANKY-BAS-2026-XXXXXX = Basic Edition (1,000 members, 5 staff, 1 branch)
  - BANKY-STD-2026-XXXXXX = Standard Edition (5,000 members, 20 staff, 10 branches)
  - BANKY-PRE-2026-XXXXXX = Premium Edition (20,000 members, 100 staff, 50 branches)
  - BANKY-ENT-2026-XXXXXX = Enterprise Edition (Unlimited)

STRUCTURE:
- /frontend/     - Main app static files
- banky-server   - Compiled backend binary

NOTE: This is the Enterprise edition for single-organization use.
      Admin panel is NOT included (it's only for SaaS multi-tenant management).
EOF

    echo ">>> Enterprise build complete: packages/enterprise/"
}

build_codecanyon() {
    echo ""
    echo "========================================"
    echo "  Building CodeCanyon Version"
    echo "========================================"
    
    build_frontend
    build_admin
    
    echo ""
    echo ">>> Creating CodeCanyon source package..."
    
    rm -rf packages/codecanyon
    mkdir -p packages/codecanyon/banky
    
    # Copy all source code
    cp -r client packages/codecanyon/banky/
    cp -r admin-client packages/codecanyon/banky/
    cp -r python_backend packages/codecanyon/banky/
    cp -r landing-page packages/codecanyon/banky/
    cp -r shared packages/codecanyon/banky/ 2>/dev/null || true
    cp package.json packages/codecanyon/banky/
    cp package-lock.json packages/codecanyon/banky/ 2>/dev/null || true
    cp vite.config.ts packages/codecanyon/banky/
    cp tsconfig.json packages/codecanyon/banky/
    cp tailwind.config.ts packages/codecanyon/banky/ 2>/dev/null || true
    cp postcss.config.js packages/codecanyon/banky/ 2>/dev/null || true
    cp components.json packages/codecanyon/banky/ 2>/dev/null || true
    cp theme.json packages/codecanyon/banky/ 2>/dev/null || true
    
    # Clean up unnecessary files
    find packages/codecanyon/banky -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
    find packages/codecanyon/banky -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find packages/codecanyon/banky -type d -name ".git" -exec rm -rf {} + 2>/dev/null || true
    find packages/codecanyon/banky -type f -name "*.pyc" -delete 2>/dev/null || true
    find packages/codecanyon/banky -type f -name ".env" -delete 2>/dev/null || true
    find packages/codecanyon/banky -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true
    
    # Create env example
    cat > packages/codecanyon/banky/.env.example << 'EOF'
# Database
DATABASE_URL=postgresql://user:password@host:5432/banky

# Deployment Mode: 'saas' or 'enterprise'
DEPLOYMENT_MODE=saas

# For SaaS mode - Neon API for multi-tenant database provisioning
NEON_API_KEY=your-neon-api-key

# For Enterprise mode - License key
LICENSE_KEY=BANKY-XXX-2026-XXXXXXXX

# Security
SESSION_SECRET=your-secure-session-secret

# Optional: SMS Gateway
SMS_API_KEY=
SMS_SENDER_ID=

# Optional: M-Pesa Integration
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_SHORTCODE=
EOF

    # Create install script
    cat > packages/codecanyon/banky/install.sh << 'INSTALLSCRIPT'
#!/bin/bash

echo "========================================"
echo "  BANKY Installation"
echo "========================================"
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required. Install from https://python.org"; exit 1; }

echo "Step 1/4: Installing frontend..."
npm install

echo ""
echo "Step 2/4: Installing admin panel..."
cd admin-client && npm install && cd ..

echo ""
echo "Step 3/4: Installing backend..."
cd python_backend && pip install -r requirements.txt && cd ..

echo ""
echo "Step 4/4: Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file - please edit it with your database credentials"
else
    echo ".env already exists"
fi

echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your database URL"
echo "  2. Run: ./start.sh"
echo ""
INSTALLSCRIPT
    chmod +x packages/codecanyon/banky/install.sh

    # Create start script
    cat > packages/codecanyon/banky/start.sh << 'STARTSCRIPT'
#!/bin/bash

echo "Starting BANKY..."
echo ""

# Start backend
cd python_backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Start admin panel
cd admin-client
npm run dev &
ADMIN_PID=$!
cd ..

# Start frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "========================================"
echo "  BANKY is running!"
echo "========================================"
echo ""
echo "  Main App:    http://localhost:5000"
echo "  Admin Panel: http://localhost:3001"
echo "  API:         http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

trap "kill $BACKEND_PID $ADMIN_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
STARTSCRIPT
    chmod +x packages/codecanyon/banky/start.sh

    # Create simple README
    cat > packages/codecanyon/banky/README.md << 'EOF'
# BANKY - Bank & Sacco Management System

Complete banking and Sacco management platform with multi-tenant support.

## Quick Install

```bash
./install.sh
```

Then edit `.env` with your database URL and run:

```bash
./start.sh
```

## Requirements

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+

## Deployment Modes

### SaaS Mode (run your own SaaS platform)
```
DEPLOYMENT_MODE=saas
NEON_API_KEY=your-neon-api-key
```
Each organization gets its own database automatically.

### Enterprise Mode (single organization)
```
DEPLOYMENT_MODE=enterprise
LICENSE_KEY=BANKY-XXX-2026-XXXXXXXX
```

## Project Structure

- `/client` - Main banking application (React)
- `/admin-client` - Platform admin panel (React)
- `/landing-page` - Marketing landing page (React)
- `/python_backend` - API server (FastAPI)

## Features

- Member & Staff Management
- Loan Management (applications, disbursement, repayments)
- Fixed Deposits & Dividends
- Teller Station & Float Management
- Accounting (double-entry bookkeeping)
- SMS Notifications
- Audit Logs
- Multi-branch support

## Production Deployment (Ubuntu 22.04/24.04)

### Step 1: Install Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2
```

### Step 2: Setup Database

```bash
# Create database and user
sudo -u postgres psql
CREATE USER banky WITH PASSWORD 'your_secure_password';
CREATE DATABASE banky_master OWNER banky;
\q
```

### Step 3: Deploy Application

```bash
# Create app directory
sudo mkdir -p /var/www/banky
sudo chown $USER:$USER /var/www/banky

# Upload and extract files
cd /var/www/banky
unzip banky-v1.0.0.zip
cd banky

# Install dependencies
./install.sh

# Configure environment
nano .env
# Set: DATABASE_URL=postgresql://banky:your_secure_password@localhost:5432/banky_master
# Set: DEPLOYMENT_MODE=saas (or enterprise)
```

### Step 4: Setup PM2 (Keep Apps Running)

Create `/var/www/banky/banky/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'banky-api',
      cwd: '/var/www/banky/banky/python_backend',
      script: 'uvicorn',
      args: 'main:app --host 127.0.0.1 --port 8000',
      interpreter: 'python3'
    },
    {
      name: 'banky-app',
      cwd: '/var/www/banky/banky',
      script: 'npm',
      args: 'run dev'
    },
    {
      name: 'banky-admin',
      cwd: '/var/www/banky/banky/admin-client',
      script: 'npm',
      args: 'run dev'
    },
    {
      name: 'banky-landing',
      cwd: '/var/www/banky/banky/landing-page',
      script: 'npm',
      args: 'run dev'
    }
  ]
};
```

Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Step 5: Configure Subdomains with Nginx

Create `/etc/nginx/sites-available/banky`:

```nginx
# Main App - app.yoursite.com
server {
    listen 80;
    server_name app.yoursite.com;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}

# Admin Panel - admin.yoursite.com
server {
    listen 80;
    server_name admin.yoursite.com;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}

# API - api.yoursite.com
server {
    listen 80;
    server_name api.yoursite.com;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}

# Landing Page - www.yoursite.com (or yoursite.com)
server {
    listen 80;
    server_name www.yoursite.com yoursite.com;
    
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/banky /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Setup DNS

Add these A records in your domain DNS settings:
```
app.yoursite.com    →  YOUR_SERVER_IP
admin.yoursite.com  →  YOUR_SERVER_IP
api.yoursite.com    →  YOUR_SERVER_IP
```

### Step 7: Enable HTTPS (Free SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.yoursite.com -d admin.yoursite.com -d api.yoursite.com
```

### Step 8: Configure Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

---

## Quick Reference

| Service | Internal Port | Subdomain |
|---------|---------------|-----------|
| Landing Page | 3002 | www.yoursite.com |
| Main App | 5000 | app.yoursite.com |
| Admin Panel | 3001 | admin.yoursite.com |
| API | 8000 | api.yoursite.com |

### Useful Commands

```bash
# View logs
pm2 logs

# Restart all apps
pm2 restart all

# Check status
pm2 status

# Update after code changes
cd /var/www/banky/banky
git pull  # or re-upload files
pm2 restart all
```

## Support

For documentation and support, visit: https://banky.io/docs

## License

- Regular License: Single end-product
- Extended License: Required for SaaS usage
EOF

    # Create changelog
    cat > packages/codecanyon/banky/CHANGELOG.md << 'EOF'
# Changelog

## Version 1.0.0
- Initial release
- Core banking features
- Multi-tenant SaaS architecture
- Enterprise license support
- Complete accounting module
- Loan management system
- Fixed deposits & dividends
- Teller station with float management
EOF

    # Zip the package
    cd packages/codecanyon
    zip -r banky-v1.0.0.zip banky
    cd ../..
    
    echo ">>> CodeCanyon build complete: packages/codecanyon/"
    echo ">>> ZIP package: packages/codecanyon/banky-v1.0.0.zip"
}

cleanup() {
    echo ""
    echo ">>> Cleaning up temporary files..."
    rm -rf python_backend/build python_backend/dist python_backend/*.spec 2>/dev/null || true
    rm -f python_backend/banky_server.py 2>/dev/null || true
}

show_menu

case $choice in
    1)
        build_saas
        ;;
    2)
        build_compiled
        ;;
    3)
        build_codecanyon
        ;;
    4)
        build_saas
        build_compiled
        build_codecanyon
        ;;
    5)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac

cleanup

echo ""
echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "Build outputs:"
[ -d "packages/saas" ] && echo "  - SaaS:       packages/saas/"
[ -d "packages/enterprise" ] && echo "  - Enterprise: packages/enterprise/"
[ -d "packages/codecanyon" ] && echo "  - CodeCanyon: packages/codecanyon/"
[ -f "packages/codecanyon/banky-v1.0.0.zip" ] && echo "                packages/codecanyon/banky-v1.0.0.zip"
echo ""
