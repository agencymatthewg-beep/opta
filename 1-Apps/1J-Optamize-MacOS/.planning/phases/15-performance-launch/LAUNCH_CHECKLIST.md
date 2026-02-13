# v1.1 Launch Checklist

## Pre-Launch

### Documentation
- [x] VERSION bumped to 1.1.0 (package.json, Cargo.toml, tauri.conf.json)
- [x] CHANGELOG.md created with v1.0 and v1.1 entries
- [x] README.md updated with v1.1 features
- [x] Release notes created (.planning/RELEASE_NOTES_1.1.md)

### Code Quality
- [x] All Phase 11-15 plans completed (16/16)
- [x] TypeScript compilation passes (`npm run build`)
- [x] Rust compilation passes (`cargo check`)
- [x] No critical eslint/clippy warnings

### Testing
- [x] Production build succeeds
- [x] macOS ARM build verified
- [ ] macOS Intel build verified (requires Intel Mac)
- [ ] Full app smoke test on macOS

### Performance
- [x] Bundle size optimized (lazy loading, vendor splitting)
- [x] Components memoized (ProcessRow, GameCard, etc.)
- [x] LazyMotion enabled for smaller Framer Motion bundle

## Launch

### GitHub Release
- [ ] Create GitHub release v1.1.0
- [ ] Write release description from RELEASE_NOTES_1.1.md
- [ ] Upload build artifacts:
  - [ ] Opta_1.1.0_aarch64.dmg (Apple Silicon)
  - [ ] Opta_1.1.0_x64.dmg (Intel)
- [ ] Publish release

### Roadmap Update
- [ ] Mark Phase 15 complete in ROADMAP.md
- [ ] Mark v1.1 milestone complete
- [ ] Update progress table with completion date

## Post-Launch

### Monitoring
- [ ] Watch for GitHub issues
- [ ] Monitor crash reports
- [ ] Respond to user feedback

### Planning v2.0
- [ ] Review deferred issues in ISSUES.md
- [ ] Prioritize Phase 16 (Windows Platform)
- [ ] Schedule v2.0 planning session

---

**v1.1 Milestone Summary:**
- 5 phases: Foundation & Stability, UX Flow Polish, Core Features, Educational Enhancement, Performance & Launch
- 16 plans completed
- macOS Refinement focus
- Windows and Social features deferred to v2.0
