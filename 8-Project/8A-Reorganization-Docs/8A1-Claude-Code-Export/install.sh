#!/bin/bash
# Claude Code Full Setup - Install Script
# For Mac Studio (Apple Silicon)

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║       Claude Code Full Capability Installation            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    print_step "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
else
    print_success "Homebrew already installed"
fi

# Install Homebrew packages
print_step "Installing Homebrew packages..."
brew install git gh jq ripgrep fd bat eza tree pyenv 2>/dev/null || true
print_success "Homebrew packages installed"

# Install nvm and Node.js
print_step "Installing Node.js via nvm..."
if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 2>/dev/null || true
nvm use 22
nvm alias default 22
print_success "Node.js $(node --version) installed"

# Install Python
print_step "Installing Python via pyenv..."
eval "$(pyenv init -)" 2>/dev/null || true
pyenv install 3.12 2>/dev/null || true
pyenv global 3.12
print_success "Python $(python --version) installed"

# Install Rust
print_step "Installing Rust..."
if ! command -v rustc &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
fi
print_success "Rust installed"

# Install Bun
print_step "Installing Bun..."
if ! command -v bun &> /dev/null; then
    curl -fsSL https://bun.sh/install | bash
fi
print_success "Bun installed"

# Install global npm packages
print_step "Installing npm packages..."
npm install -g vercel netlify-cli wrangler 2>/dev/null || true
print_success "Cloud CLIs installed"

# Install MCP servers
print_step "Installing MCP servers..."
npm install -g @isaacphi/mcp-gdrive 2>/dev/null || true
npm install -g @gongrzhe/server-gmail-autoauth-mcp 2>/dev/null || true
npm install -g @cocal/google-calendar-mcp 2>/dev/null || true
npm install -g @kirbah/mcp-youtube 2>/dev/null || true
npm install -g mcp-gemini-cli 2>/dev/null || true
print_success "MCP servers installed"

# Install Playwright browsers
print_step "Installing Playwright browsers..."
npx playwright install chromium 2>/dev/null || true
print_success "Playwright browsers installed"

# Install Python packages
print_step "Installing Python packages..."
pip install serena-mcp 2>/dev/null || true
print_success "Python packages installed"

# Create Claude config directory
print_step "Setting up Claude Code configuration..."
mkdir -p ~/.claude/commands/gsd
mkdir -p ~/.config/mcp-gdrive

# Copy configuration files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/.mcp.json" ~/.mcp.json 2>/dev/null || true
cp -r "$SCRIPT_DIR/commands/"* ~/.claude/commands/ 2>/dev/null || true
print_success "Configuration files copied"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              Installation Complete!                        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure API keys:"
echo "   Edit ~/.claude/.env and add:"
echo "   - ANTHROPIC_API_KEY"
echo "   - GOOGLE_CLIENT_ID"
echo "   - GOOGLE_CLIENT_SECRET"
echo "   - GEMINI_API_KEY"
echo "   - YOUTUBE_API_KEY"
echo ""
echo "2. Update MCP config paths:"
echo "   Edit ~/.mcp.json and update paths to match your username"
echo ""
echo "3. Authenticate Google services:"
echo "   - Gmail: npx @gongrzhe/server-gmail-autoauth-mcp"
echo "   - Calendar: Follow calendar MCP setup"
echo "   - Drive: Follow drive MCP setup"
echo ""
echo "4. Test Claude Code:"
echo "   cd ~/your-project && claude"
echo ""
print_success "Done! Restart your terminal to apply changes."
