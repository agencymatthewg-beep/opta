#!/bin/bash
#===============================================================================
# OPTA NEXUS PRE-INSTALL SCRIPT
# Run this BEFORE install.sh on a fresh Mac Studio
#
# This script installs:
#   - Homebrew and core dependencies
#   - llama.cpp with Metal acceleration
#   - LiteLLM proxy for Claude routing
#   - MCP server dependencies
#   - Directory structure
#   - Startup/stop scripts
#
# Usage: ./pre-install.sh [--skip-models]
#   --skip-models    Skip downloading AI models (do manually later)
#===============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
MODELS_DIR="/Users/Shared/Models"
LLAMA_CPP_DIR="$HOME/llama.cpp"
SKIP_MODELS=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --skip-models)
            SKIP_MODELS=true
            shift
            ;;
    esac
done

#-------------------------------------------------------------------------------
# Helper Functions
#-------------------------------------------------------------------------------

print_header() {
    echo ""
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

#-------------------------------------------------------------------------------
# System Check
#-------------------------------------------------------------------------------

print_header "OPTA NEXUS PRE-INSTALL"

echo ""
echo "System Information:"
echo "  Machine: $(sysctl -n hw.model 2>/dev/null || echo 'Unknown')"
echo "  Chip: $(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo 'Apple Silicon')"
echo "  Memory: $(( $(sysctl -n hw.memsize) / 1073741824 )) GB"
echo "  macOS: $(sw_vers -productVersion)"
echo ""

# Check for Apple Silicon
if [[ $(uname -m) != "arm64" ]]; then
    print_error "This script is designed for Apple Silicon Macs"
    exit 1
fi

#-------------------------------------------------------------------------------
# 1. Install Homebrew
#-------------------------------------------------------------------------------

print_header "1/8 - HOMEBREW"

if check_command brew; then
    print_success "Homebrew already installed"
    brew update
else
    print_step "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add to PATH for Apple Silicon
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"

    print_success "Homebrew installed"
fi

#-------------------------------------------------------------------------------
# 2. Install Core Dependencies
#-------------------------------------------------------------------------------

print_header "2/8 - CORE DEPENDENCIES"

BREW_PACKAGES="screen cmake python3 pipx node git wget"

for pkg in $BREW_PACKAGES; do
    if brew list "$pkg" &>/dev/null; then
        print_success "$pkg already installed"
    else
        print_step "Installing $pkg..."
        brew install "$pkg"
        print_success "$pkg installed"
    fi
done

# Ensure pipx path is set up
pipx ensurepath &>/dev/null || true

#-------------------------------------------------------------------------------
# 3. Install LiteLLM
#-------------------------------------------------------------------------------

print_header "3/8 - LITELLM PROXY"

if check_command litellm; then
    print_success "LiteLLM already installed"
else
    print_step "Installing LiteLLM via pipx..."
    pipx install litellm
    print_success "LiteLLM installed"
fi

#-------------------------------------------------------------------------------
# 4. Build llama.cpp
#-------------------------------------------------------------------------------

print_header "4/8 - LLAMA.CPP (Metal Accelerated)"

if [[ -f "$HOME/llama-server" ]]; then
    print_success "llama-server already exists at ~/llama-server"
    read -p "Rebuild? (y/N): " rebuild
    if [[ "$rebuild" != "y" && "$rebuild" != "Y" ]]; then
        print_step "Skipping llama.cpp build"
    else
        rm -rf "$LLAMA_CPP_DIR"
    fi
fi

if [[ ! -f "$HOME/llama-server" ]]; then
    print_step "Cloning llama.cpp..."
    cd "$HOME"
    git clone https://github.com/ggerganov/llama.cpp.git

    print_step "Building with Metal acceleration..."
    cd "$LLAMA_CPP_DIR"
    cmake -B build -DGGML_METAL=ON
    cmake --build build --config Release -j$(sysctl -n hw.ncpu)

    print_step "Copying llama-server to home directory..."
    cp build/bin/llama-server "$HOME/llama-server"

    print_success "llama.cpp built successfully"
fi

#-------------------------------------------------------------------------------
# 5. Create Directory Structure
#-------------------------------------------------------------------------------

print_header "5/8 - DIRECTORY STRUCTURE"

# Models directory
if [[ ! -d "$MODELS_DIR" ]]; then
    print_step "Creating $MODELS_DIR..."
    sudo mkdir -p "$MODELS_DIR"
    sudo chown $(whoami) "$MODELS_DIR"
    print_success "Models directory created"
else
    print_success "Models directory exists"
fi

# Project directories
DIRS=(
    "$HOME/Projects"
    "$HOME/Shared/Ideas/generated"
    "$HOME/Shared/Ideas/research"
    "$HOME/Shared/Ideas/brainstorm"
    "$HOME/Shared/Assets"
    "$HOME/Shared/Scratch"
)

for dir in "${DIRS[@]}"; do
    if [[ ! -d "$dir" ]]; then
        mkdir -p "$dir"
        print_success "Created $dir"
    fi
done

print_success "Directory structure ready"

#-------------------------------------------------------------------------------
# 6. Download AI Models
#-------------------------------------------------------------------------------

print_header "6/8 - AI MODELS"

DEEPSEEK_MODEL="$MODELS_DIR/DeepSeek-R1-Distill-Llama-70B-Q8_0.gguf"
LLAMA_DRAFT="$MODELS_DIR/Llama-3.2-3B-Instruct-Q4_K_M.gguf"

if $SKIP_MODELS; then
    print_warning "Skipping model downloads (--skip-models flag)"
    echo ""
    echo "Download manually later:"
    echo "  cd $MODELS_DIR"
    echo "  wget https://huggingface.co/bartowski/DeepSeek-R1-Distill-Llama-70B-GGUF/resolve/main/DeepSeek-R1-Distill-Llama-70B-Q8_0.gguf"
    echo "  wget https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
else
    cd "$MODELS_DIR"

    # DeepSeek-70B (~78GB)
    if [[ -f "$DEEPSEEK_MODEL" ]]; then
        print_success "DeepSeek-70B model exists"
    else
        print_step "Downloading DeepSeek-R1-Distill-Llama-70B-Q8 (~78GB)..."
        print_warning "This will take a while. You can Ctrl+C and use --skip-models to do this later."
        wget -c "https://huggingface.co/bartowski/DeepSeek-R1-Distill-Llama-70B-GGUF/resolve/main/DeepSeek-R1-Distill-Llama-70B-Q8_0.gguf"
        print_success "DeepSeek-70B downloaded"
    fi

    # Llama-3B Draft (~2GB)
    if [[ -f "$LLAMA_DRAFT" ]]; then
        print_success "Llama-3B draft model exists"
    else
        print_step "Downloading Llama-3.2-3B-Instruct (~2GB)..."
        wget -c "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
        print_success "Llama-3B downloaded"
    fi
fi

#-------------------------------------------------------------------------------
# 7. Create Configuration Files
#-------------------------------------------------------------------------------

print_header "7/8 - CONFIGURATION FILES"

# LiteLLM config
print_step "Creating LiteLLM config..."
cat > "$HOME/config.yaml" << 'EOF'
model_list:
  - model_name: claude-3-5-sonnet-20241022
    litellm_params:
      model: openai/deepseek-r1-distill-llama-70b
      api_base: "http://localhost:8080/v1"
      api_key: "sk-local"
      stop: ["<|EOT|>", "<|end_of_sentence|>"]

  - model_name: claude-3-opus-20240229
    litellm_params:
      model: openai/deepseek-r1-distill-llama-70b
      api_base: "http://localhost:8080/v1"
      api_key: "sk-local"
      stop: ["<|EOT|>", "<|end_of_sentence|>"]

  - model_name: claude-3-haiku-20240307
    litellm_params:
      model: openai/deepseek-r1-distill-llama-70b
      api_base: "http://localhost:8080/v1"
      api_key: "sk-local"
      stop: ["<|EOT|>", "<|end_of_sentence|>"]
EOF
print_success "Created ~/config.yaml"

# Startup script
print_step "Creating startup script..."
cat > "$HOME/start_opta_server.sh" << 'EOF'
#!/bin/bash
#===============================================================================
# OPTA NEXUS STARTUP SCRIPT
# Starts RAM Disk, AI Engine, and LiteLLM Proxy
#===============================================================================

echo "Starting Opta Nexus..."

# 1. Create 64GB RAM Disk for builds
if [ ! -d "/Volumes/OptaBuilds" ]; then
    echo "Creating 64GB RAM Disk..."
    diskutil erasevolume HFS+ 'OptaBuilds' `hdiutil attach -nomount ram://134217728`
    echo "✓ RAM Disk mounted at /Volumes/OptaBuilds"
else
    echo "✓ RAM Disk already mounted"
fi

# 2. Launch AI Engine
if screen -list | grep -q "ai-engine"; then
    echo "✓ AI Engine already running"
else
    echo "Starting AI Engine (DeepSeek-70B + Speculative Decoding)..."
    screen -dmS ai-engine ~/llama-server \
        -m /Users/Shared/Models/DeepSeek-R1-Distill-Llama-70B-Q8_0.gguf \
        -md /Users/Shared/Models/Llama-3.2-3B-Instruct-Q4_K_M.gguf \
        -c 131072 \
        -np 4 \
        -cb \
        -ngl 99 \
        -ctk q4_0 \
        -ctv q4_0 \
        --host 0.0.0.0 --port 8080
    echo "✓ AI Engine started (Port 8080)"
fi

# Wait for AI Engine to initialize
echo "Waiting for AI Engine to initialize..."
sleep 10

# 3. Launch LiteLLM Proxy
if screen -list | grep -q "proxy"; then
    echo "✓ LiteLLM Proxy already running"
else
    echo "Starting LiteLLM Proxy..."
    screen -dmS proxy litellm --config ~/config.yaml --host 0.0.0.0 --port 4000
    echo "✓ LiteLLM Proxy started (Port 4000)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OPTA NEXUS ONLINE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AI Engine:    http://localhost:8080"
echo "  LiteLLM:      http://localhost:4000"
echo "  RAM Disk:     /Volumes/OptaBuilds"
echo ""
echo "  View logs:    screen -r ai-engine"
echo "                screen -r proxy"
echo "  Detach:       Ctrl+A then D"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
EOF
chmod +x "$HOME/start_opta_server.sh"
print_success "Created ~/start_opta_server.sh"

# Stop script
print_step "Creating stop script..."
cat > "$HOME/stop_opta_server.sh" << 'EOF'
#!/bin/bash
#===============================================================================
# OPTA NEXUS SHUTDOWN SCRIPT
#===============================================================================

echo "Stopping Opta Nexus..."

# Stop AI Engine
if screen -list | grep -q "ai-engine"; then
    screen -S ai-engine -X quit
    echo "✓ AI Engine stopped"
else
    echo "  AI Engine not running"
fi

# Stop LiteLLM Proxy
if screen -list | grep -q "proxy"; then
    screen -S proxy -X quit
    echo "✓ LiteLLM Proxy stopped"
else
    echo "  LiteLLM Proxy not running"
fi

# Unmount RAM Disk (optional - keeps data until restart anyway)
read -p "Unmount RAM Disk? (y/N): " unmount
if [[ "$unmount" == "y" || "$unmount" == "Y" ]]; then
    if [ -d "/Volumes/OptaBuilds" ]; then
        diskutil unmount /Volumes/OptaBuilds
        echo "✓ RAM Disk unmounted"
    fi
fi

echo ""
echo "Opta Nexus Offline."
EOF
chmod +x "$HOME/stop_opta_server.sh"
print_success "Created ~/stop_opta_server.sh"

# Status script
print_step "Creating status script..."
cat > "$HOME/opta_status.sh" << 'EOF'
#!/bin/bash
#===============================================================================
# OPTA NEXUS STATUS CHECK
#===============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OPTA NEXUS STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# AI Engine
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "  AI Engine:    ✓ Running (Port 8080)"
else
    echo "  AI Engine:    ✗ Not responding"
fi

# LiteLLM Proxy
if curl -s http://localhost:4000/health > /dev/null 2>&1; then
    echo "  LiteLLM:      ✓ Running (Port 4000)"
else
    echo "  LiteLLM:      ✗ Not responding"
fi

# RAM Disk
if [ -d "/Volumes/OptaBuilds" ]; then
    USED=$(df -h /Volumes/OptaBuilds | tail -1 | awk '{print $3}')
    AVAIL=$(df -h /Volumes/OptaBuilds | tail -1 | awk '{print $4}')
    echo "  RAM Disk:     ✓ Mounted ($USED used, $AVAIL free)"
else
    echo "  RAM Disk:     ✗ Not mounted"
fi

# Screen sessions
echo ""
echo "  Screen Sessions:"
screen -ls 2>/dev/null | grep -E "(ai-engine|proxy)" | sed 's/^/    /'

# IP Address
echo ""
echo "  Local IP:     $(ipconfig getifaddr en0 2>/dev/null || echo 'Not connected')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
EOF
chmod +x "$HOME/opta_status.sh"
print_success "Created ~/opta_status.sh"

#-------------------------------------------------------------------------------
# 8. Install MCP Server Dependencies
#-------------------------------------------------------------------------------

print_header "8/8 - MCP SERVER DEPENDENCIES"

# Playwright
print_step "Installing Playwright MCP server..."
npm install -g @anthropic/mcp-server-playwright 2>/dev/null || print_warning "Playwright MCP install failed (may need manual install)"

print_step "Installing Playwright browsers..."
npx playwright install chromium 2>/dev/null || print_warning "Playwright browser install failed (may need manual install)"

# Python packages for Google services
print_step "Installing Python packages for Google MCP servers..."
pip3 install --quiet google-auth google-auth-oauthlib google-api-python-client 2>/dev/null || true

print_success "MCP dependencies installed"

#-------------------------------------------------------------------------------
# Setup Environment Variables
#-------------------------------------------------------------------------------

print_header "ENVIRONMENT SETUP"

# Check if already configured
if grep -q "OPTA NEXUS" ~/.zshrc 2>/dev/null; then
    print_warning "Environment variables already in ~/.zshrc"
else
    print_step "Adding environment variables to ~/.zshrc..."
    cat >> ~/.zshrc << 'EOF'

#===============================================================================
# OPTA NEXUS CONFIGURATION
#===============================================================================
export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_API_KEY="sk-local-opta"
export PATH="$HOME/.local/bin:$PATH"

# Opta aliases
alias opta-start='~/start_opta_server.sh'
alias opta-stop='~/stop_opta_server.sh'
alias opta-status='~/opta_status.sh'
alias opta-ai='screen -r ai-engine'
alias opta-proxy='screen -r proxy'
EOF
    print_success "Environment variables added"
fi

#-------------------------------------------------------------------------------
# Enable SSH
#-------------------------------------------------------------------------------

print_header "SSH ACCESS"

if systemsetup -getremotelogin 2>/dev/null | grep -q "On"; then
    print_success "SSH already enabled"
else
    print_step "Enabling SSH (requires admin password)..."
    sudo systemsetup -setremotelogin on
    print_success "SSH enabled"
fi

LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "Unknown")
echo ""
echo "  Connect from other machines:"
echo "    ssh $(whoami)@$LOCAL_IP"

#-------------------------------------------------------------------------------
# Complete
#-------------------------------------------------------------------------------

print_header "PRE-INSTALL COMPLETE"

echo ""
echo "Summary:"
echo "  ✓ Homebrew and dependencies installed"
echo "  ✓ llama.cpp built with Metal acceleration"
echo "  ✓ LiteLLM proxy installed"
echo "  ✓ Directory structure created"
if $SKIP_MODELS; then
echo "  ⚠ AI models skipped (download manually)"
else
echo "  ✓ AI models downloaded"
fi
echo "  ✓ Configuration files created"
echo "  ✓ MCP server dependencies installed"
echo "  ✓ SSH enabled"
echo ""
echo "Next steps:"
echo "  1. Run: source ~/.zshrc"
echo "  2. Run: ./install.sh          (Claude Code configuration)"
echo "  3. Run: opta-start            (Start the LLM server)"
echo "  4. Run: opta-status           (Verify everything works)"
echo ""
echo "From your MacBook:"
echo "  export ANTHROPIC_BASE_URL=\"http://$LOCAL_IP:4000\""
echo "  export ANTHROPIC_API_KEY=\"sk-local-opta\""
echo ""
print_success "Ready for install.sh"
