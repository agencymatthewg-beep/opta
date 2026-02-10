# Codebase Concerns

**Analysis Date:** 2026-01-28

## Tech Debt

**API Key Stored in UserDefaults (Plain Text):**
- Issue: Claude API key stored in UserDefaults without encryption
- File: `opta-native/OptaApp/OptaApp/Services/CloudLLMService.swift`
- Why: MVP speed, TODO explicitly states "Migrate to Keychain for production security"
- Impact: API key accessible to any app with entitlements, subject to backup exposure
- Fix approach: Use Keychain immediately for production builds

**Hardcoded Todoist Credentials Placeholder:**
- Issue: `clientID = "YOUR_TODOIST_CLIENT_ID"` hardcoded in source
- File: `OptaLMiOS/OptaLMiOS/Services/TodoistService.swift` (lines 17-18)
- Why: Placeholder for OAuth integration
- Impact: Credentials exposed in git if filled in
- Fix approach: Use Config.swift or environment-based credential injection

**Open CORS Configuration:**
- Issue: `origin: '*'` accepts requests from any domain
- File: `Opta iOS/packages/api/src/index.ts` (line 48)
- Why: Development convenience, TODO notes "Configure for production"
- Impact: API vulnerable to CSRF attacks in production
- Fix approach: Implement whitelist of allowed origins

**Database Queries in Components:**
- Issue: Direct API calls in React components instead of server actions
- Files: Multiple pages in `Opta MacOS/src/pages/`
- Why: Rapid prototyping
- Impact: Harder to implement caching, RLS, data layer abstraction
- Fix approach: Extract to service layer or server actions

## Known Bugs

**Unimplemented API Routes:**
- Symptoms: User routes return mock data, feedback discarded
- Files: `Opta iOS/packages/api/src/routes/user.ts`, `feedback.ts`
- TODOs note: "Get from database", "Validate user is authenticated"
- Workaround: None - features non-functional
- Fix: Implement auth middleware and persistence layer

**Missing Settings Rollback Implementation:**
- Symptoms: Rollback buttons in UI don't restore actual system settings
- File: `Opta MacOS/src/hooks/useRollback.ts:163`
- TODO: "In production, call Tauri command to restore settings"
- Workaround: None - UI-only
- Fix: Wire to Tauri settings restoration commands

**GPU Metrics Stubbed:**
- Symptoms: GPU and FPS data always null despite UI displaying them
- File: `Opta MacOS/src/hooks/useGameSession.ts:229-231`
- TODOs: "Get from system telemetry", "Implement FPS tracking"
- Workaround: None - data not collected
- Fix: Integrate GPU telemetry from native APIs

## Security Considerations

**API Keys in Plain Text Storage:**
- Risk: Sensitive credentials accessible without encryption
- Files: `opta-native/OptaApp/OptaApp/Services/CloudLLMService.swift`
- Current mitigation: None
- Recommendations: Migrate to Keychain, implement secure enclave where available

**Vercel OIDC Token in Repository:**
- Risk: Deployment token in committed `.env.local`
- File: `opta-life-manager/.env.local`
- Current mitigation: None
- Recommendations: Rotate token immediately, add to .gitignore, use GitHub secrets

**Missing Server-Side Auth Validation:**
- Risk: Admin routes check isAdmin client-side only
- Files: Various admin pages
- Current mitigation: UI hiding only
- Recommendations: Add middleware to admin routes, verify role server-side

## Performance Bottlenecks

**Large Component Files:**
- Problem: 8 files exceed 900 lines, difficult to maintain
- Files:
  - `Opta MacOS/src/components/OptaRing3D/shaders/RingShader.ts` (1959 lines)
  - `Opta MacOS/src/pages/Settings.tsx` (1135 lines)
  - `Opta MacOS/OptaNative/OptaNative/ViewModels/ChessViewModel.swift` (1133 lines)
  - `Opta MacOS/src/components/effects/NeonTrails.tsx` (944 lines)
  - `Opta Mini/OptaMini/AppDelegate.swift` (931 lines)
  - `Opta MacOS/src/lib/audio/synthesizer.ts` (915 lines)
- Impact: Cognitive overload, harder testing, increased bug density
- Improvement path: Break into 200-300 line chunks with single responsibility

**Sequential API Calls:**
- Problem: Dashboard makes 5+ serial API calls on mount
- File: `opta-life-manager/` dashboard components
- Measurement: Not benchmarked
- Improvement path: Parallel fetch, server component aggregation

## Fragile Areas

**Unsafe Type Casts (8+ instances):**
- Files:
  - `Opta MacOS/src/lib/performance/CapabilityDetector.ts:360` - `(navigator as any)`
  - `Opta MacOS/src/components/effects/MicroInteraction.tsx:166, 212` - `(motionProps as any)`
  - `opta-life-manager/components/SmoothScroll.tsx:8` - `{children as any}`
  - `Opta MacOS/src/contexts/ChessSettingsContext.tsx:125`
  - `Opta MacOS/src/hooks/useChessGame.ts:219`
  - `Opta MacOS/src/hooks/useTelemetry.ts:139`
  - `Opta MacOS/src/hooks/usePuzzle.ts:555`
- Why fragile: Type safety circumvented, runtime errors possible
- Safe modification: Replace with proper typing or `as const`
- Test coverage: None for these areas

**Process Termination Not Wired:**
- File: `Opta MacOS/src/components/ProcessList.tsx:285`
- Why fragile: UI exists but no backend implementation
- Common failures: Kill button does nothing
- Safe modification: Implement Tauri IPC command
- Test coverage: None

## Scaling Limits

**No Persistent Data Layer:**
- Current capacity: Single session (no data survives restart for iOS API)
- Limit: Zero cross-session persistence
- Symptoms: All user data lost on restart
- Scaling path: Implement Supabase integration (credentials in env)

## Dependencies at Risk

**react-hot-toast:**
- Risk: Potentially unmaintained, React 19 compatibility unclear
- Impact: Toast notifications could break
- Migration plan: Consider sonner (actively maintained)

## Missing Critical Features

**Authentication System (iOS API):**
- Problem: No auth middleware, all routes public
- Files: `Opta iOS/packages/api/src/routes/*.ts`
- Current workaround: None - security gap
- Blocks: User isolation, data privacy, production deployment
- Implementation complexity: Medium

**Persistent Feedback Storage:**
- Problem: Feedback logged to console only, not stored
- File: `Opta iOS/packages/api/src/routes/feedback.ts:47`
- Current workaround: None - feedback lost
- Blocks: ML training, user preference learning
- Implementation complexity: Low (add database table)

## Test Coverage Gaps

**No Automated Tests:**
- What's not tested: Entire codebase
- Risk: Regressions undetected, refactoring dangerous
- Priority: High
- Difficulty to test: Need to set up Vitest/Jest infrastructure

**API Route Validation:**
- What's not tested: Zod schema edge cases, error responses
- Risk: Invalid data could cause crashes
- Priority: High
- Difficulty to test: Low (straightforward with Supertest)

**Crux Core Logic:**
- What's not tested: Model updates, effect handling
- Risk: State bugs in core business logic
- Priority: Medium
- Difficulty to test: Low (Crux has built-in test support)

---

*Concerns audit: 2026-01-28*
*Update as issues are fixed or new ones discovered*
