# Platform Requirements

This document outlines the system requirements and platform-specific considerations for running Opta.

## Supported Platforms

Opta supports three major desktop operating systems:

| Platform | Status | Notes |
|----------|--------|-------|
| Windows 10/11 | Fully Supported | Primary gaming platform |
| macOS 10.13+ | Fully Supported | Intel and Apple Silicon |
| Linux | Fully Supported | Ubuntu 20.04+, Debian 11+, Fedora 35+ |

---

## Windows

### Minimum Requirements

- **OS:** Windows 10 version 1903 or later, or Windows 11
- **Architecture:** x86_64 (64-bit only)
- **Runtime:** Microsoft Visual C++ Redistributable 2019 or later
- **WebView:** WebView2 Runtime (pre-installed on Windows 10 2004+ and Windows 11)

### Recommended for Full Features

- **NVIDIA GPU:** For GPU telemetry, requires NVIDIA drivers with nvidia-smi
- **Disk Space:** 500MB for application and local data
- **RAM:** 8GB minimum (16GB recommended for local LLM features)
- **Internet:** Required for cloud AI features and updates

### Game Launchers

Opta automatically detects games from:
- Steam (default paths: `C:\Program Files (x86)\Steam`, `C:\Program Files\Steam`)
- Epic Games (default path: `C:\ProgramData\Epic\EpicGamesLauncher`)
- GOG Galaxy (default path: `C:\ProgramData\GOG.com\Galaxy`)

### Known Conflict Tools (Windows)

Opta will detect and warn about:
- NVIDIA GeForce Experience (auto-optimization conflicts)
- Razer Cortex (game booster conflicts)
- MSI Afterburner (GPU settings conflicts)
- HP OMEN Gaming Hub (performance mode conflicts)
- Xbox Game Bar (overlay performance impact)

---

## macOS

### Minimum Requirements

- **OS:** macOS 10.13 High Sierra or later
- **Recommended:** macOS 11 Big Sur or later for full feature set
- **Architecture:** Intel (x86_64) or Apple Silicon (arm64)

### Apple Silicon Notes

- Native arm64 binary provided for M1/M2/M3/M4 chips
- Rosetta 2 not required - runs natively
- Optimized for Apple Silicon performance

### Intel Mac Notes

- Universal binary supports Intel Macs
- Minimum macOS 10.13 for Intel support

### Recommended for Full Features

- **Disk Space:** 500MB for application and local data
- **RAM:** 8GB minimum (16GB recommended for local LLM features)
- **Internet:** Required for cloud AI features and updates

### GPU Telemetry

- GPU name detection via `system_profiler`
- VRAM detection where available
- Note: macOS does not expose real-time GPU utilization metrics via public APIs

### Game Launchers

Opta automatically detects games from:
- Steam (`~/Library/Application Support/Steam`)
- Epic Games (`~/Library/Application Support/Epic/EpicGamesLauncher`)
- GOG Galaxy (`~/Library/Application Support/GOG.com/Galaxy`)

### Known Conflict Tools (macOS)

Opta will detect and warn about:
- CleanMyMac (system optimization conflicts)
- Parallels Toolbox (utility conflicts)
- AppCleaner (minimal conflict risk)

---

## Linux

### Minimum Requirements

- **Distributions:** Ubuntu 20.04+, Debian 11+, Fedora 35+, or equivalent
- **Desktop Environment:** GNOME, KDE, or other GTK3-compatible
- **Libraries:**
  - GTK 3
  - WebKitGTK 4.1+
  - libayatana-appindicator3-dev (for system tray)

### Installing Dependencies

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

**Fedora:**
```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libxdo-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

**Arch Linux:**
```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  libappindicator-gtk3 \
  librsvg
```

### Recommended for Full Features

- **NVIDIA GPU:** For GPU telemetry, requires nvidia-smi (NVIDIA drivers)
- **AMD GPU:** Basic support, CoreCtrl can provide additional features
- **Disk Space:** 500MB for application and local data
- **RAM:** 8GB minimum (16GB recommended for local LLM features)
- **Internet:** Required for cloud AI features and updates

### Game Launchers

Opta automatically detects games from:
- Steam (`~/.steam/steam`, `~/.local/share/Steam`)
- Epic Games (requires Heroic Launcher or Lutris)
- GOG Galaxy (via GOG Galaxy client or Minigalaxy)

### Known Conflict Tools (Linux)

Opta will detect and warn about:
- Feral GameMode (performance optimization conflicts)
- MangoHud (overlay conflicts)
- GOverlay (overlay management conflicts)
- CoreCtrl (AMD GPU settings conflicts)

---

## Common Requirements (All Platforms)

### Local LLM (Ollama)

For local AI features, Opta uses Ollama:

- **Ollama Installation:** [ollama.ai](https://ollama.ai)
- **Recommended Model:** `llama3:8b` (default)
- **RAM Required:** 8GB minimum, 16GB recommended
- **Disk Space:** 4-5GB for model files

To install and run Ollama:
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull the default model
ollama pull llama3:8b

# Start Ollama service
ollama serve
```

### Cloud AI (Optional)

For advanced AI features:
- Claude API key (set as `ANTHROPIC_API_KEY` environment variable)
- Internet connection required

### Performance Recommendations

| Component | Minimum | Recommended | Optimal |
|-----------|---------|-------------|---------|
| RAM | 8GB | 16GB | 32GB+ |
| Storage | 500MB | 2GB | 10GB+ |
| GPU VRAM | 2GB | 4GB | 8GB+ |
| CPU | 4 cores | 8 cores | 16+ cores |

---

## Troubleshooting

### Windows

**WebView2 Not Found:**
If Opta fails to start due to missing WebView2, download it from:
[Microsoft WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

**NVIDIA GPU Not Detected:**
Ensure NVIDIA drivers are installed and `nvidia-smi` is accessible from command line.

### macOS

**App Cannot Be Opened (Unsigned):**
Right-click the app and select "Open" to bypass Gatekeeper, or run:
```bash
xattr -cr /Applications/Opta.app
```

### Linux

**WebKitGTK Not Found:**
Install the required version:
```bash
# Ubuntu/Debian
sudo apt-get install libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel
```

**Tray Icon Not Showing:**
Install the appindicator library:
```bash
# Ubuntu/Debian
sudo apt-get install libayatana-appindicator3-dev

# Fedora
sudo dnf install libappindicator-gtk3-devel
```

---

## Platform-Specific Features

| Feature | Windows | macOS | Linux |
|---------|---------|-------|-------|
| Hardware Telemetry | Full | Full | Full |
| GPU Telemetry | Full (NVIDIA) | Partial | Full (NVIDIA) |
| Process Management | Full | Full | Full |
| Game Detection | Full | Full | Partial |
| Conflict Detection | Full | Full | Full |
| Local LLM (Ollama) | Full | Full | Full |
| Cloud AI (Claude) | Full | Full | Full |
| System Tray | Full | Full | Full |

---

*Last updated: 2026-01-16*
