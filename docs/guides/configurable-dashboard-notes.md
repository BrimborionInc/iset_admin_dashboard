# Configurable Dashboard Implementation Notes

This project embeds Cloudscape board components (Board, BoardItem, ItemsPalette) to deliver configurable dashboards. A few lessons learned while implementing the Finance Overview dashboard:

## Non-negotiable checklist (use before coding any dashboard)

- Start from a known-good example (`src/pages/configurationSettings.js`, `src/pages/contact/ContactCommunicationsDashboard.jsx`) instead of hand-rolling Boards/BoardItems.
- Wire header actions in `AppRoutes` to dispatch `<route>:openPalette` and `<route>:resetLayout`; the page must listen, call `setAvailableItems`, call `setSplitPanelOpen(true)`, and reset the default layout on reset.
- Use the canonical `boardI18nStrings` and `boardItemI18nStrings` objects (drag/resize announcements) on every Board and BoardItem.
- Every BoardItem must expose a `ButtonDropdown` in `settings` that calls `actions.removeItem()`; always pass Cloudscape `actions` through unmodified.
- Guard `setAvailableItems` and storage writes with signatures; do not update on every render.
- Bump the storage key when changing default layout so new widgets appear by default.

1. **Sync palette state sparingly.** Calling `setAvailableItems` on every render causes the AppLayout and split panel to reopen, which in turn re-renders the board and interrupts drag/resize gestures. Only update the palette when the set of items actually changes—compute a signature or reuse memoised values.

2. **Persist layout carefully.** Store only the minimal placement info (`id`, `rowSpan`, `columnSpan`, `columnOffset`) in localStorage. When rehydrating, filter out unknown widget IDs so stale layouts don’t crash the board after refactors.

3. **Keep widget actions intact.** Pass the `actions` object returned by Cloudscape straight into each BoardItem. Wrapping or modifying the callbacks can break their internal drag/drop/resize management. Every widget should expose a `ButtonDropdown` in `settings` that calls `actions.removeItem()` so users can remove tiles consistently across dashboards.

4. **Avoid noisy debug logging.** Excessive `console.debug` statements in render paths flood DevTools and make diagnosing real issues difficult. Log only when needed and clean up once problems are resolved.

5. **Keep the palette out of the help panel.** Cloudscape's AppLayout reserves the tools slot for the help panel, so pushing the ItemsPalette into that region causes it to replace help content while the split panel is also open. Route palette updates through the split panel instead (update the `ItemsPalette` in the split panel and toggle `setSplitPanelOpen(true)`), leaving the tools panel dedicated to contextual help.

Following these guidelines keeps the board responsive, allows widgets to be added/removed via the split panel palette, and preserves the drag/resize experience Cloudscape expects.

## Cloudscape board runaway loop (what happened, how to prevent it)

- **Symptom.** Rendering a board with a `useEffect` that calls `setAvailableItems(paletteItems)` (or writes to storage) on every render causes AppContent to re-render, which triggers the effect again. The browser logs `Warning: Maximum update depth exceeded` and widgets become unusable. Removing a widget can also throw if `boardI18nStrings.liveAnnouncementItemRemoved` is not a function.
- **Root cause.** The palette array is rebuilt each render, so React sees a new reference every time. Calling `setAvailableItems` with that new array schedules upstream state updates, rekindling the render loop. Likewise, returning a string instead of a callback for live announcement handlers violates Cloudscape’s expectations and throws.
- **Fix / prevention.**
  1. Only keep `layout` in state. Derive `boardItems = useMemo(() => toBoardItems(layout), [layout])` and `paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems])`.
  2. Inside `useEffect`, compute a signature such as `JSON.stringify(paletteItems.map(item => item.id))`. Guard the `setAvailableItems` call with a `useRef` holding that signature; only call the setter when the signature changes. Do the same for localStorage writes with the exported layout.
  3. Reset handlers should update both refs after calling `setLayout` so the palette effect does not run again with stale signatures.
  4. Use the canonical `boardI18nStrings` helpers from the finance dashboards—each announcement key returns a function. This keeps Cloudscape’s accessibility announcements intact and avoids runtime errors when removing widgets.
- **Checklist before committing a dashboard.**
- [ ] Does `setAvailableItems` live behind a signature guard?
- [ ] Are layout changes persisted only when the exported layout actually changes?
- [ ] Do palette open/reset events reuse the shared helpers?
- [ ] Are the `boardI18nStrings` and `boardItemI18nStrings` identical (or equivalent) to the proven finance implementation?
- [ ] Has the new route been registered in access control with System Administrator and Program Administrator enabled by default?

Following the pattern above keeps new dashboards from entering the runaway render loop and ensures widget removal, drag, and resize announcements behave consistently.

## Dashboard API request loops (recurring regression check)

- Treat runaway API calls as a standard dashboard regression risk, not a one-off incident. Every dashboard/widget spot check should include watching network traffic after the page settles.
- The expected steady state is: initial data calls complete, user-triggered refreshes happen only once per action, and intentional polling is documented and bounded. Repeated canceled `fetch/XHR` calls to the same endpoint are a failure even if the UI appears usable.
- Common causes are unstable render-time values in hook dependencies: inline sort descriptors, filter arrays, payload objects, callback props, and palette/layout arrays. If a data hook depends on an object that is rebuilt every render, a state update from the fetch can recreate the callback/effect, abort the current request, and start a new request indefinitely.
- Prevention pattern: reduce dependency inputs to stable primitives or memoized values, build query/payload objects with `useMemo`, and make `useEffect` depend on stable callbacks only. Do not mask the symptom with request caps or debouncing until the unstable dependency is fixed.
- Spot-test pattern: load the dashboard, apply common sort/filter/page-size interactions, wait 10-20 seconds, and confirm the network log is quiet except for expected polling. For automated checks, capture request counts by endpoint and fail when the same non-polling endpoint keeps firing or canceling after idle.

6. **Match widget ids everywhere.** Use the exact same string for the widget id when registering in `widgetRegistry`, seeding `defaultLayout`, and persisting layouts. A mismatch (e.g., `supportingDocuments` vs `supporting-documents`) makes Cloudscape treat the widget as unknown, so it ends up in Available Widgets even if you meant it for the board.

7. **Reset defaults with a storage-key bump.** Whenever you change the default layout (adding/removing widgets), increment the localStorage key. Without that, browsers keep hydrating the old layout and new widgets never appear by default.

8. **Wrap shared widgets lightly.** When reusing a shared widget (like Supporting Documents) across dashboards, keep a thin wrapper per board that simply forwards the Cloudscape `actions`, context data, and help metadata—no custom logic that might block `actions.removeItem()` or other board callbacks.

9. **Expose board-level add/reset buttons via AppRoutes.** Each dashboard route should pass header actions into `renderContent` that dispatch custom events (e.g., `finance:openPalette`, `finance:resetLayout`, `applicationAssessment:openPalette`). The page component must listen for those events, call `setAvailableItems` and `setSplitPanelOpen(true)` to show the palette, and call `resetLayout` to restore defaults. This keeps the UX consistent with the “Add widget” / “Reset layout” buttons shown in examples and avoids broken or missing palette integration.

10. **BoardItem i18n strings are required.** Cloudscape’s BoardItem now expects `i18nStrings` (`dragHandleAriaLabel/Description`, `resizeHandleAriaLabel/Description`). Omitting them throws `Cannot read properties of undefined (reading 'dragHandleAriaLabel')` when dragging new widgets from the palette. Provide the canonical object on every BoardItem (not just the Board).

### Case workspace widget note (Intervention Assessment)
- When reassigning a submitted proposal to a different Action Plan from the EI step, persist the `actionPlanId` change before leaving the step and use numeric IDs in update calls so the board state can move the intervention between plans without stale associations.

### Configuration dashboard note (Nov 2025)
- The configuration dashboard storage key moved to `configuration-dashboard-layout-v2` when the Backend jobs widget was added. If new widgets appear only in “Available Widgets”, clear `localStorage` for the old key or bump it again when adjusting the default layout.
