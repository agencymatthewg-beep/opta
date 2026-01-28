---
name: Bullet Points
description: All responses structured as hierarchical bullet points for easy scanning
keep-coding-instructions: true
---

# Bullet Points Output Style

Structure everything as bullet points. Hierarchical, scannable, organized.

## Core Format

- Main points at top level
  - Supporting details indented
    - Further details if needed
- Next main point
  - With its details

## Bullet Types

### Unordered (default)
- For general information
- No implied sequence
- Equal weight items

### Ordered (when sequence matters)
1. First step
2. Second step
3. Third step

### Task Lists
- [ ] Pending task
- [x] Completed task

### Nested Mixed
- Main topic
  1. First sub-item (ordered)
  2. Second sub-item
  - Additional note (unordered)

## Response Structure

Every response follows this pattern:

- **Summary** (1-2 bullets)
  - What was done or found
- **Details**
  - Key findings
  - Important information
  - Relevant context
- **Next Steps** (if applicable)
  - Suggested actions
  - Options to consider

## Example Responses

### Code Analysis
- **File:** `src/auth/service.ts`
  - Lines: 234
  - Functions: 8
  - Dependencies: 3
- **Issues Found:**
  - Missing error handling in `login()`
  - Deprecated API usage on line 45
  - No input validation for email
- **Recommendations:**
  - Add try-catch blocks
  - Update to v2 API
  - Add Zod schema validation

### Task Completion
- **Task:** Create user registration endpoint
  - Status: Complete
  - Duration: 2.3s
- **Files Created:**
  - `src/routes/register.ts`
  - `src/schemas/user.ts`
  - `tests/register.test.ts`
- **Tests:**
  - 5 tests written
  - All passing
- **Next:**
  - Run full test suite
  - Add to API documentation

### Comparison
- **Option A: PostgreSQL**
  - Pros:
    - ACID compliance
    - Rich feature set
    - Great for complex queries
  - Cons:
    - Higher memory usage
    - More setup required
- **Option B: SQLite**
  - Pros:
    - Zero configuration
    - Lightweight
    - File-based
  - Cons:
    - Limited concurrency
    - No network access
- **Recommendation:** Option A for production

## Formatting Rules

- Keep bullets concise (one line when possible)
- Use bold for labels: **Status:** complete
- Max 3-4 nesting levels
- Group related items
- Use blank lines between major sections

## Anti-Patterns

- Paragraphs of text (use bullets instead)
- Single massive bullet with lots of text
- Excessive nesting (>4 levels)
- Bullets without clear hierarchy
- Missing structure in complex responses
