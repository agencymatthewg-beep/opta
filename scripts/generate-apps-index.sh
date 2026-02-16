#!/bin/bash
# Generate APPS-INDEX.md from all APP.md YAML frontmatter
# Usage: bash ~/Synced/Opta/scripts/generate-apps-index.sh

OPTA_ROOT="$HOME/Synced/Opta"
OUTPUT="$OPTA_ROOT/APPS-INDEX.md"
DATE=$(date +%Y-%m-%d)

cat > "$OUTPUT" << 'HEADER'
# Opta Ecosystem — Apps Index

*Auto-generated from APP.md frontmatter. Do not edit manually.*

HEADER

echo "*Last generated: $DATE*" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "| App | Type | Platform | Language | Status | OPIS | Port | Depends On |" >> "$OUTPUT"
echo "|-----|------|----------|----------|--------|------|------|------------|" >> "$OUTPUT"

# Find all APP.md files and extract frontmatter
find "$OPTA_ROOT/1-Apps" -name "APP.md" -maxdepth 2 2>/dev/null | sort | while read -r appmd; do
    dir=$(dirname "$appmd")
    project=$(basename "$dir")
    
    # Extract YAML frontmatter (between --- markers)
    frontmatter=$(awk '/^---$/{if(n++)exit;next}n' "$appmd" 2>/dev/null)
    app=$(echo "$frontmatter" | awk -F': ' '/^app:/{print $2}')
    type=$(echo "$frontmatter" | awk -F': ' '/^type:/{print $2}')
    platform=$(echo "$frontmatter" | awk -F': ' '/^platform:/{print $2}' | tr -d '[]')
    language=$(echo "$frontmatter" | awk -F': ' '/^language:/{print $2}')
    status=$(echo "$frontmatter" | awk -F': ' '/^status:/{print $2}')
    port=$(echo "$frontmatter" | awk -F': ' '/^port:/{print $2}')
    depends=$(echo "$frontmatter" | awk -F': ' '/^depends_on:/{print $2}' | tr -d '[]')
    
    # Default values
    [ -z "$app" ] && app="$project"
    [ -z "$type" ] && type="—"
    [ -z "$platform" ] && platform="—"
    [ -z "$language" ] && language="—"
    [ -z "$status" ] && status="—"
    [ -z "$port" ] && port="—"
    [ -z "$depends" ] && depends="—"
    
    echo "| $app | $type | $platform | $language | $status | ✅ | $port | $depends |" >> "$OUTPUT"
done

# Add projects without APP.md
echo "" >> "$OUTPUT"
echo "## Projects Without OPIS" >> "$OUTPUT"
echo "" >> "$OUTPUT"

find "$OPTA_ROOT/1-Apps" -maxdepth 1 -type d | sort | while read -r dir; do
    project=$(basename "$dir")
    [ "$project" = "1-Apps" ] && continue
    if [ ! -f "$dir/APP.md" ]; then
        echo "- ⬜ \`$project\`" >> "$OUTPUT"
    fi
done

echo "" >> "$OUTPUT"
echo "---" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "*Run \`bash ~/Synced/Opta/scripts/generate-apps-index.sh\` to regenerate.*" >> "$OUTPUT"

echo "✅ Generated $OUTPUT"
