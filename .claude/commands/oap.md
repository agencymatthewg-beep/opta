# /oap - Open All Opta Projects

Opens all Opta projects in their respective IDEs.

## Instructions

When this command is invoked, open all Opta projects:

### Xcode Projects
1. **Opta Mini** (menubar app)
   ```bash
   open ~/Synced/Opta/1-Apps/1G-Opta-Mini-MacOS/OptaMini.xcodeproj
   ```

2. **Opta Life iOS** (if exists)
   ```bash
   open ~/Synced/Opta/1-Apps/1E-Opta-Life-IOS/*.xcodeproj 2>/dev/null || true
   ```

### VS Code Projects
3. **Optamize** (Tauri desktop app)
   ```bash
   code ~/Synced/Opta/1-Apps/optamize/1J-Optamize-MacOS
   ```

4. **AICompare** (Next.js web app)
   ```bash
   code ~/Synced/Opta/1-Apps/1B-AICompare-Web
   ```

## Execution

Run all open commands in parallel to launch quickly:

```bash
open ~/Synced/Opta/1-Apps/1G-Opta-Mini-MacOS/OptaMini.xcodeproj &
code ~/Synced/Opta/1-Apps/optamize/1J-Optamize-MacOS &
code ~/Synced/Opta/1-Apps/1B-AICompare-Web &
wait
```

## Output

After opening, confirm:
```
Opened Opta projects:
- Opta Mini (Xcode)
- Optamize (VS Code)
- AICompare (VS Code)
```
