# Frequently Asked Questions

## General

### What is Opta?
Opta is an AI-powered PC optimization tool that helps you get the best performance from your gaming setup. Unlike other tools, Opta explains what it's doing and learns your preferences over time.

### Is Opta free?
Yes, Opta is free and open source. Some cloud AI features may have usage limits.

### What platforms are supported?
Windows 10+, macOS 10.13+, and Linux (Ubuntu 20.04+, Debian 11+, Fedora 35+).

## Features

### Do I need to uninstall other optimization tools?
No. Opta will detect them and warn about potential conflicts, but you decide what to keep. We recommend disabling overlapping features rather than uninstalling.

### What games does Opta support?
Opta auto-detects games from Steam, Epic Games, and GOG Galaxy. You can also manually add any game.

### Does Opta work with AMD GPUs?
Yes. GPU telemetry works with both NVIDIA and AMD GPUs, though some features may be more complete on NVIDIA due to driver support.

## Privacy

### Does Opta send data to the cloud?
By default, no. All preferences and history are stored locally. The local LLM handles queries on your machine.

Cloud AI is opt-in and only used for complex questions. When used, context is anonymized (no personal info, file paths, or usernames sent).

### Can I see what data Opta stores?
Yes. Go to Settings > Privacy > View Stored Data. You can view, export, or delete everything.

### How do I delete my data?
Settings > Privacy > Delete All Data. This removes all preferences, history, and learned patterns.

## Troubleshooting

### Opta isn't detecting my GPU
1. Ensure GPU drivers are up to date
2. For NVIDIA: nvidia-smi should work from command line
3. For AMD: ROCm or amdgpu drivers required on Linux
4. Opta will still work with basic telemetry if GPU detection fails

### Game detection missed a game
Click "Add Game" and browse to the game executable. Opta will create a profile.

### Local AI isn't working
The local LLM requires Ollama:
1. Install Ollama from ollama.ai
2. Run: `ollama pull llama3:8b`
3. Restart Opta

### Optimization made things worse
Don't worry! Every change is reversible:
1. Go to the game's optimization history
2. Click "Rollback" on the problematic change
3. Settings will be restored to before

## Technical

### What does "Stealth Mode" do?
Stealth Mode identifies and terminates non-essential background processes to free up resources for gaming. It uses a safe list to protect system-critical processes.

### How is the Opta Score calculated?
The score is weighted across three dimensions:
- Performance (40%): FPS potential, stability, load times
- Experience (35%): Visual quality, thermal efficiency, responsiveness
- Competitive (25%): Input lag, network latency, background interference

Each dimension has sub-scores based on hardware specs, applied optimizations, and benchmark results.

### Where are config files stored?
- **Windows**: `%APPDATA%\com.opta.optimizer`
- **macOS**: `~/Library/Application Support/com.opta.optimizer`
- **Linux**: `~/.config/com.opta.optimizer`

Data files (profiles, history) are in `~/.opta/` on all platforms.
