# /oap - Open All Opta Projects

Opens all Opta projects in their respective IDEs.

## Instructions

When this command is invoked, open all Opta projects:

### Xcode Projects
1. **Opta Mini** (menubar app)
   ```bash
   open ~/Synced/Opta/1-Apps/1C-MacOS/1C1-Opta-Mini/OptaMini.xcodeproj
   ```

2. **Opta iOS** (if exists)
   ```bash
   open ~/Synced/Opta/1-Apps/1B-IOS/1B1-Opta-Life-IOS/*.xcodeproj 2>/dev/null || true
   ```

### VS Code Projects
3. **Opta Native** (Tauri desktop app)
   ```bash
   code ~/Synced/Opta/1-Apps/1C-MacOS/1C2-Optamize-MacOS
   ```

4. **AICompare** (Next.js web app)
   ```bash
   code ~/Synced/Opta/1-Apps/1I-Web/1I4-AICompare
   ```

## Execution

Run all open commands in parallel to launch quickly:

```bash
open ~/Synced/Opta/1-Apps/1C-MacOS/1C1-Opta-Mini/OptaMini.xcodeproj &
code ~/Synced/Opta/1-Apps/1C-MacOS/1C2-Optamize-MacOS &
code ~/Synced/Opta/1-Apps/1I-Web/1I4-AICompare &
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
