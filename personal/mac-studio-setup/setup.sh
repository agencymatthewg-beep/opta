#!/bin/bash
#
# Mac Studio M3 Ultra (256GB) - Initial Setup Script
# Run this on first boot after transferring to the Mac Studio
#
# Usage: chmod +x setup.sh && ./setup.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# ============================================================================
# PHASE 1: System Verification
# ============================================================================
print_header "PHASE 1: System Verification"

echo "Checking hardware..."
MEMORY=$(system_profiler SPHardwareDataType | grep "Memory:" | awk '{print $2}')
CHIP=$(system_profiler SPHardwareDataType | grep "Chip:" | awk '{print $2, $3, $4}')

echo "  Chip: $CHIP"
echo "  Memory: ${MEMORY}GB"

if [[ "$MEMORY" != "256" ]]; then
    print_warning "Expected 256GB RAM, found ${MEMORY}GB"
fi

print_step "Hardware verified"

# ============================================================================
# PHASE 2: System Configuration
# ============================================================================
print_header "PHASE 2: System Configuration"

# Enable SSH for headless access
echo "Enabling Remote Login (SSH)..."
sudo systemsetup -setremotelogin on 2>/dev/null || print_warning "SSH may already be enabled"
print_step "SSH enabled"

# Set computer name
read -p "Set computer name (default: mac-studio): " COMPUTER_NAME
COMPUTER_NAME=${COMPUTER_NAME:-mac-studio}
sudo scutil --set ComputerName "$COMPUTER_NAME"
sudo scutil --set HostName "$COMPUTER_NAME"
sudo scutil --set LocalHostName "$COMPUTER_NAME"
print_step "Computer name set to: $COMPUTER_NAME"

# Configure GPU memory limit for large models
print_header "CRITICAL: GPU Memory Configuration"
echo "For running Llama 3.1 405B, we need to increase the GPU wired memory limit."
echo "This allows the GPU to address ~240GB of the 256GB unified memory."
echo ""
echo "Command: sudo sysctl iogpu.wired_limit_mb=245760"
echo ""
read -p "Apply this setting now? (y/n): " APPLY_SYSCTL

if [[ "$APPLY_SYSCTL" == "y" ]]; then
    sudo sysctl iogpu.wired_limit_mb=245760
    print_step "GPU memory limit set to 240GB"

    # Make it persistent (requires creating a launch daemon)
    echo ""
    print_warning "Note: This setting resets on reboot."
    echo "Creating launch daemon for persistence..."

    sudo tee /Library/LaunchDaemons/com.local.gpu-memory-limit.plist > /dev/null << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.local.gpu-memory-limit</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/sbin/sysctl</string>
        <string>iogpu.wired_limit_mb=245760</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF

    sudo launchctl load /Library/LaunchDaemons/com.local.gpu-memory-limit.plist 2>/dev/null || true
    print_step "Launch daemon created for persistent GPU memory setting"
else
    print_warning "Skipped - you'll need to run this manually before loading large models"
fi

# ============================================================================
# PHASE 3: Install Homebrew
# ============================================================================
print_header "PHASE 3: Homebrew Installation"

if command -v brew &> /dev/null; then
    print_step "Homebrew already installed"
else
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add to PATH for Apple Silicon
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
    print_step "Homebrew installed"
fi

# ============================================================================
# PHASE 4: Install Core Tools
# ============================================================================
print_header "PHASE 4: Core Tools Installation"

echo "Installing essential tools..."
brew install --quiet \
    git \
    wget \
    htop \
    tmux \
    neovim \
    jq \
    tree

print_step "Core CLI tools installed"

# Install GUI apps
echo "Installing GUI applications..."
brew install --cask --quiet \
    lm-studio \
    iterm2

print_step "LM Studio installed"
print_step "iTerm2 installed"

# TG Pro (thermal management) - manual install recommended
print_warning "TG Pro: Download manually from https://www.tunabellysoftware.com/tgpro/"
echo "  (Required for custom fan curves during sustained AI workloads)"

# ============================================================================
# PHASE 5: Install Ollama
# ============================================================================
print_header "PHASE 5: Ollama Installation"

if command -v ollama &> /dev/null; then
    print_step "Ollama already installed"
else
    echo "Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
    print_step "Ollama installed"
fi

# Start Ollama service
echo "Starting Ollama service..."
ollama serve &>/dev/null &
sleep 3
print_step "Ollama service started"

# ============================================================================
# PHASE 6: Install Miniforge (Python Environment)
# ============================================================================
print_header "PHASE 6: Python Environment (Miniforge)"

if command -v conda &> /dev/null; then
    print_step "Conda already installed"
else
    echo "Installing Miniforge for Apple Silicon..."
    wget -q https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-MacOSX-arm64.sh -O miniforge.sh
    bash miniforge.sh -b -p $HOME/miniforge3
    rm miniforge.sh

    # Initialize conda
    $HOME/miniforge3/bin/conda init zsh
    source ~/.zshrc
    print_step "Miniforge installed"
fi

# Create MLX environment
echo "Creating MLX environment..."
conda create -n mlx python=3.11 -y 2>/dev/null || true
print_step "MLX conda environment created"

# ============================================================================
# PHASE 7: Install MLX Framework
# ============================================================================
print_header "PHASE 7: MLX Framework"

echo "Installing MLX and related packages..."
source $HOME/miniforge3/bin/activate mlx 2>/dev/null || conda activate mlx

pip install --quiet \
    mlx \
    mlx-lm \
    huggingface_hub \
    transformers

print_step "MLX framework installed"

# ============================================================================
# PHASE 8: Install Syncthing
# ============================================================================
print_header "PHASE 8: Syncthing (File Sync)"

if command -v syncthing &> /dev/null; then
    print_step "Syncthing already installed"
else
    brew install syncthing
    print_step "Syncthing installed"
fi

# Create syncthing LaunchAgent
mkdir -p ~/Library/LaunchAgents
brew services start syncthing 2>/dev/null || true
print_step "Syncthing service configured"

echo ""
echo "Syncthing Web UI: http://localhost:8384"
echo "Configure sync folders:"
echo "  - Projects/Code -> Sync with MacBook"
echo "  - Documents -> Sync with all devices"

# ============================================================================
# PHASE 9: Download Models
# ============================================================================
print_header "PHASE 9: Model Downloads"

echo ""
echo "Available models to download:"
echo "  1. qwen2.5:72b      (~40GB) - Fast daily driver"
echo "  2. llama3.3:70b     (~40GB) - High quality general use"
echo "  3. deepseek-coder-v2:236b (~140GB) - 128k context coding"
echo "  4. llama3.1:405b    (~190GB) - Maximum intelligence (Q3)"
echo ""
print_warning "Large models (405B) require the GPU memory limit set in Phase 2"
echo ""

read -p "Download qwen2.5:72b now? (recommended daily driver) (y/n): " DOWNLOAD_QWEN
if [[ "$DOWNLOAD_QWEN" == "y" ]]; then
    echo "Downloading Qwen 2.5 72B (this will take a while)..."
    ollama pull qwen2.5:72b
    print_step "Qwen 2.5 72B downloaded"
fi

read -p "Download llama3.3:70b now? (y/n): " DOWNLOAD_LLAMA70
if [[ "$DOWNLOAD_LLAMA70" == "y" ]]; then
    echo "Downloading Llama 3.3 70B..."
    ollama pull llama3.3:70b
    print_step "Llama 3.3 70B downloaded"
fi

echo ""
print_warning "For larger models (405B), use LM Studio or download GGUF files manually"
echo "  Recommended source: https://huggingface.co/bartowski"

# ============================================================================
# PHASE 10: Create Helper Scripts
# ============================================================================
print_header "PHASE 10: Helper Scripts"

mkdir -p ~/bin

# Create model switcher script
cat > ~/bin/ai << 'EOF'
#!/bin/bash
# Quick AI chat launcher
MODEL=${1:-qwen2.5:72b}
ollama run $MODEL
EOF
chmod +x ~/bin/ai

# Create memory check script
cat > ~/bin/check-ai-memory << 'EOF'
#!/bin/bash
# Check memory usage for AI workloads
echo "=== Memory Status ==="
memory_pressure
echo ""
echo "=== GPU Memory Limit ==="
sysctl iogpu.wired_limit_mb
echo ""
echo "=== Ollama Models ==="
ollama list
EOF
chmod +x ~/bin/check-ai-memory

# Create thermal check script
cat > ~/bin/check-thermals << 'EOF'
#!/bin/bash
# Check thermal status
echo "=== Thermal State ==="
pmset -g therm
echo ""
echo "=== Fan Status ==="
# Note: TG Pro required for detailed fan info
echo "Install TG Pro for detailed thermal management"
EOF
chmod +x ~/bin/check-thermals

# Add bin to PATH
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc

print_step "Helper scripts created in ~/bin"
echo "  - ai [model]        : Quick chat with a model"
echo "  - check-ai-memory   : Check memory status for AI"
echo "  - check-thermals    : Check thermal state"

# ============================================================================
# PHASE 11: SSH Key Setup
# ============================================================================
print_header "PHASE 11: SSH Key Setup"

if [[ ! -f ~/.ssh/id_ed25519 ]]; then
    echo "Generating SSH key..."
    ssh-keygen -t ed25519 -C "mac-studio" -f ~/.ssh/id_ed25519 -N ""
    print_step "SSH key generated"
else
    print_step "SSH key already exists"
fi

echo ""
echo "Your public key (add to MacBook's ~/.ssh/authorized_keys):"
echo ""
cat ~/.ssh/id_ed25519.pub
echo ""

# ============================================================================
# COMPLETE
# ============================================================================
print_header "SETUP COMPLETE"

echo ""
echo "Next steps:"
echo ""
echo "  1. Configure Syncthing at http://localhost:8384"
echo "     Add your MacBook as a device and sync Projects/Code"
echo ""
echo "  2. Download TG Pro for thermal management"
echo "     https://www.tunabellysoftware.com/tgpro/"
echo ""
echo "  3. Add this machine to your MacBook's SSH config:"
echo "     Host mac-studio"
echo "         HostName $COMPUTER_NAME.local"
echo "         User $(whoami)"
echo ""
echo "  4. Test Ollama: ai qwen2.5:72b"
echo ""
echo "  5. For 405B models, open LM Studio and load:"
echo "     bartowski/Llama-3.1-405B-Instruct-GGUF (Q3_K_S)"
echo ""
print_step "Mac Studio is ready as your AI Brain!"
