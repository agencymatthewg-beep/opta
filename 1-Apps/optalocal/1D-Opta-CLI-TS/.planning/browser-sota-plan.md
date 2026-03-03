# Opta Browser Enhancement Plan (SOTA 2025)

## Objective
Upgrade the existing Opta Browser architecture from a "Gen 1" DOM-parsing/CSS-selector model to a "State-of-the-Art (2025)" Dual-Grounding model using Set-of-Mark (SoM) and Accessibility Trees. This will eliminate CSS selector hallucinations, dramatically reduce token context bloat, and improve agent reliability.

## Phase 1: Set-of-Mark (SoM) Injection (Perception Layer)
**Goal:** Replace raw HTML DOM dumps with a visually annotated screenshot and a much smaller element dictionary.

1.  **Modify `1D-Opta-CLI-TS/src/browser/chrome-overlay.ts`:**
    *   Add a new event listener (`opta:inject-marks`).
    *   When triggered, parse the DOM for all interactable elements (buttons, inputs, `a` tags, elements with `role="button"`, etc.).
    *   Assign a sequential integer ID to each visible interactable element.
    *   Use the existing Shadow DOM to inject small, highly visible badges (e.g., `[14]`) absolutely positioned over the top-left corner of each element.
    *   Collect a dictionary mapping `ID -> { selector, boundingBox, type }`.

2.  **Update `browser_snapshot` & `browser_screenshot` Tools (`1D-Opta-CLI-TS/src/browser/mcp-bootstrap.ts` or related MCP server):**
    *   Modify `browser_snapshot` to trigger the `opta:inject-marks` event *before* taking the screenshot.
    *   Instead of returning raw HTML, the tool should return the mapped dictionary of IDs to their accessibility labels/roles, alongside the marked screenshot.

## Phase 2: ID-Based Interaction (Action Layer)
**Goal:** Prevent the LLM from hallucinating complex CSS selectors by forcing it to act on the integer IDs generated in Phase 1.

1.  **Update Tool Schemas (`1D-Opta-CLI-TS/src/core/tools/` or MCP definitions):**
    *   Change the parameters for `browser_click`, `browser_type`, `browser_hover`, etc., from expecting a `selector` string to expecting an `element_id` integer.
    *   *Backward compatibility:* Support both for a transitional period, but instruct the agent heavily to prefer `element_id`.

2.  **Update MCP Interceptor (`1D-Opta-CLI-TS/src/browser/mcp-interceptor.ts`):**
    *   When an action with `element_id` is received, map it back to the exact coordinates or internal selector generated during the SoM phase.
    *   Execute the Playwright action (e.g., `page.mouse.click(x, y)`).

## Phase 3: Accessibility Tree (A11y) Replacement
**Goal:** Further reduce context size and improve semantic understanding.

1.  **Leverage Playwright's A11y API:**
    *   Playwright natively supports fetching the Accessibility Tree: `await page.accessibility.snapshot()`.
    *   Update `browser_snapshot` to return this pruned semantic tree instead of (or in addition to) the SoM dictionary. The A11y tree naturally excludes layout noise and focuses on roles (`button`, `textbox`) and states (`disabled`, `checked`).

## Phase 4: Implicit State Verification (Reflection Layer)
**Goal:** Ensure the agent knows immediately if an action succeeded without wasting a separate tool call to re-read the page.

1.  **Modify Action Returns:**
    *   Instead of `browser_click` returning `{"status": "success"}`, modify the MCP interceptor so that after a successful click, it waits briefly for network idle or DOM stabilization.
    *   It then automatically re-runs the A11y snapshot (or a diff) and returns *that* as the result of the click tool call.
    *   *Result:* The agent immediately knows the new state of the page.

## Phase 5: Planner-Actor Delegation (Swarm Integration)
**Goal:** Use the existing CEO/Swarm capabilities to break up complex browser tasks.

1.  **Refactor `1D-Opta-CLI-TS/src/browser/sub-agent-delegator.ts`:**
    *   Instead of a monolithic Browser Specialist, introduce a "Browser Planner" that uses the main context.
    *   For specific interactions, spawn a smaller "Navigator" sub-agent equipped only with Vision and `browser_click/type` tools, delegating the low-level SoM ID interactions to it.