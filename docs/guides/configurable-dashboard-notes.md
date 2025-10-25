# Configurable Dashboard Implementation Notes

This project embeds Cloudscape board components (Board, BoardItem, ItemsPalette) to deliver configurable dashboards. A few lessons learned while implementing the Finance Overview dashboard:

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
- [ ] Are the `boardI18nStrings` functions identical (or equivalent) to the proven finance implementation?
- [ ] Has the new route been registered in access control with System Administrator and Program Administrator enabled by default?

Following the pattern above keeps new dashboards from entering the runaway render loop and ensures widget removal, drag, and resize announcements behave consistently.
