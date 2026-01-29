# /oap - Open All Opta Projects

Opens all Opta projects in their respective IDEs.

## Instructions

When this command is invoked, open all Opta projects:

### Xcode Projects
1. **Opta Mini** (menubar app)
   ```bash
   open /Users/matthewbyrden/Documents/Opta/apps/desktop/opta-mini/OptaMini.xcodeproj
   ```

2. **Opta iOS** (if exists)
   ```bash
   open /Users/matthewbyrden/Documents/Opta/apps/ios/opta/*.xcodeproj 2>/dev/null || true
   ```

### VS Code Projects
3. **Opta Native** (Tauri desktop app)
   ```bash
   code /Users/matthewbyrden/Documents/Opta/apps/desktop/opta-native
   ```

4. **AICompare** (Next.js web app)
   ```bash
   code /Users/matthewbyrden/Documents/Opta/apps/web/AICompare
   ```

## Execution

Run all open commands in parallel to launch quickly:

```bash
open /Users/matthewbyrden/Documents/Opta/apps/desktop/opta-mini/OptaMini.xcodeproj &
code /Users/matthewbyrden/Documents/Opta/apps/desktop/opta-native &
code /Users/matthewbyrden/Documents/Opta/apps/web/AICompare &
wait
```

## Output

After opening, confirm:
```
Opened Opta projects:
- Opta Mini (Xcode)
- Opta Native (VS Code)
- AICompare (VS Code)
```
