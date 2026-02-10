#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Install Claude Context for Mac Studio
# Run this ON the Mac Studio after transferring Studio Food
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Installing Claude Context for Opta Nexus"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Ensure Projects directory exists
mkdir -p ~/Projects/Opta

# Copy CLAUDE.md to project root
cp CLAUDE-STUDIO.md ~/Projects/Opta/CLAUDE.md
echo "✓ Copied CLAUDE.md to ~/Projects/Opta/"

# Also copy to home for reference
cp CLAUDE-STUDIO.md ~/OPTA-NEXUS-CONTEXT.md
echo "✓ Copied reference to ~/OPTA-NEXUS-CONTEXT.md"

# Create .claude directory if it doesn't exist
mkdir -p ~/.claude

# Copy any skills/commands if they exist
if [ -d "claude-code-export/.claude/commands" ]; then
    cp -r claude-code-export/.claude/commands ~/.claude/
    echo "✓ Installed Claude Code skills"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Claude Context Installed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Claude Code will now automatically read:"
echo "  ~/Projects/Opta/CLAUDE.md"
echo ""
echo "This file tells Claude about:"
echo "  • Opta Nexus architecture"
echo "  • Available commands (opta-start, opta-stop, etc.)"
echo "  • Project structure"
echo "  • File locations"
echo "  • Build instructions"
echo ""
