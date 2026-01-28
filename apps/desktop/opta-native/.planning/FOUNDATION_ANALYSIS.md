# Foundation Analysis Framework

> **NON-NEGOTIABLE**: Every phase MUST complete foundation analysis before implementation begins.

## Overview

This framework ensures holistic analysis of all foundational aspects before any implementation work. It combines documentation requirements with automated validation to enforce quality and consistency.

---

## How to Use

### Before Starting Any Phase

1. Create a phase-specific foundation checklist in `.planning/foundations/phase-{N}/`
2. Complete ALL required sections
3. Run `npm run validate:foundation` to verify
4. Only after validation passes can implementation begin

### Directory Structure

```
.planning/foundations/
├── platform/                    # Platform-specific considerations
│   ├── MACOS_FOUNDATION.md     # macOS native features & APIs
│   ├── WINDOWS_FOUNDATION.md   # Windows native features & APIs
│   ├── LINUX_FOUNDATION.md     # Linux desktop integration
│   └── MOBILE_FOUNDATION.md    # Mobile preparation guidelines
└── phase-{N}/                   # Per-phase analysis
    └── FOUNDATION_CHECKLIST.md  # Completed checklist for phase
```

---

## Foundation Checklist Template

Copy this template to `.planning/foundations/phase-{N}/FOUNDATION_CHECKLIST.md` for each new phase:

```markdown
# Phase {N}: {Phase Name} - Foundation Analysis

## Meta
- **Phase**: {N}
- **Name**: {Phase Name}
- **Author**: {Your Name}
- **Date**: {YYYY-MM-DD}
- **Status**: [ ] Incomplete | [ ] Complete | [ ] Approved

---

## 1. Prerequisites Assessment

### 1.1 Dependencies
- [ ] All required dependencies identified
- [ ] Version compatibility verified
- [ ] License compatibility checked

### 1.2 Prior Work
- [ ] Previous phases completed
- [ ] No blocking issues from earlier work
- [ ] Technical debt addressed (if applicable)

---

## 2. Platform Impact Assessment

### 2.1 Cross-Platform Compatibility
- [ ] Feature works on macOS
- [ ] Feature works on Windows
- [ ] Feature works on Linux
- [ ] Mobile considerations documented (for future)

### 2.2 Platform-Specific Requirements
Reference the platform foundation docs as needed:
- [ ] macOS: See MACOS_FOUNDATION.md - relevant sections: ___
- [ ] Windows: See WINDOWS_FOUNDATION.md - relevant sections: ___
- [ ] Linux: See LINUX_FOUNDATION.md - relevant sections: ___

### 2.3 Native API Usage
List any native APIs this phase will use:

| Platform | API/Feature | Purpose |
|----------|-------------|---------|
| macOS    | {API}       | {Why}   |
| Windows  | {API}       | {Why}   |
| Linux    | {API}       | {Why}   |

---

## 3. Architecture Impact

### 3.1 Affected Code Paths
List all files/modules that will be modified:

| File | Type of Change | Risk Level |
|------|---------------|------------|
| path/to/file.rs | Modify | Low/Med/High |

### 3.2 Breaking Changes
- [ ] No breaking changes
- [ ] Breaking changes documented below:

{List breaking changes if any}

### 3.3 Migration Path
{If breaking changes, describe migration strategy}

---

## 4. Performance Analysis

### 4.1 Expected Impact
- [ ] No performance impact
- [ ] Performance impact analyzed:

| Metric | Before | After (Expected) | Acceptable? |
|--------|--------|------------------|-------------|
| Startup time | {ms} | {ms} | Yes/No |
| Memory usage | {MB} | {MB} | Yes/No |
| CPU usage | {%} | {%} | Yes/No |

### 4.2 Optimization Opportunities
{List any performance optimizations identified}

---

## 5. Security Considerations

### 5.1 Security Checklist
- [ ] No new attack vectors introduced
- [ ] Input validation in place
- [ ] Permissions properly scoped
- [ ] Sensitive data handled correctly
- [ ] OWASP Top 10 reviewed

### 5.2 Security Notes
{Any security-specific notes or concerns}

---

## 6. Rollback Strategy

### 6.1 Rollback Plan
- [ ] Rollback possible without data loss
- [ ] Rollback steps documented:

1. {Step 1}
2. {Step 2}
3. {Step 3}

### 6.2 Point of No Return
{Describe any actions that cannot be undone, if applicable}

---

## 7. Design System Compliance

### 7.1 UI Changes
- [ ] No UI changes in this phase
- [ ] UI changes follow DESIGN_SYSTEM.md:
  - [ ] Uses Framer Motion for animations
  - [ ] Uses Lucide icons only
  - [ ] Uses glass effect classes
  - [ ] Uses CSS variable colors only
  - [ ] Uses Sora font

### 7.2 Component Patterns
{Reference any relevant component patterns from DESIGN_SYSTEM.md}

---

## 8. Testing Strategy

### 8.1 Test Coverage
- [ ] Unit tests planned
- [ ] Integration tests planned
- [ ] E2E tests planned (if applicable)

### 8.2 Test Cases
{List key test cases}

---

## 9. Documentation Updates

### 9.1 Required Updates
- [ ] README.md
- [ ] CLAUDE.md
- [ ] DESIGN_SYSTEM.md
- [ ] API documentation
- [ ] User-facing documentation

---

## 10. Sign-Off

### Completion Checklist
- [ ] All sections completed
- [ ] Platform foundations referenced
- [ ] Architecture impact understood
- [ ] Rollback strategy defined
- [ ] Security reviewed
- [ ] Design system compliance verified

### Approval
- **Analyst**: {Name} - Date: {YYYY-MM-DD}
- **Validation Script**: [ ] Passed
```

---

## Validation Rules

The automated validation script checks:

1. **Existence**: Foundation checklist exists for the phase
2. **Completeness**: All required checkboxes are checked
3. **Platform Coverage**: All platform sections addressed
4. **Sign-Off**: Final approval section completed

---

## Integration Points

### GSD Workflow
- `/gsd:plan-phase` prompts for foundation analysis first
- `/gsd:execute-phase` blocked until foundation validated

### Pre-Commit Hook
- Warns if foundation incomplete for active phase
- Blocks commits to phase directories without foundation

### CI/CD
- Foundation validation runs before build
- Failing validation blocks deployment

---

## Enforcement

This framework is **NON-NEGOTIABLE**. Skipping foundation analysis:
- Creates technical debt
- Introduces cross-platform issues
- Causes security vulnerabilities
- Violates design system consistency

Always complete the foundation analysis. No exceptions.
