# Configurable Dashboard Implementation Notes

This project embeds Cloudscape board components (Board, BoardItem, ItemsPalette) to deliver configurable dashboards. A few lessons learned while implementing the Finance Overview dashboard:

1. **Sync palette state sparingly.** Calling `setAvailableItems` on every render causes the AppLayout and split panel to reopen, which in turn re-renders the board and interrupts drag/resize gestures. Only update the palette when the set of items actually changes—compute a signature or reuse memoised values.

2. **Persist layout carefully.** Store only the minimal placement info (`id`, `rowSpan`, `columnSpan`, `columnOffset`) in localStorage. When rehydrating, filter out unknown widget IDs so stale layouts don’t crash the board after refactors.

3. **Keep widget actions intact.** Pass the `actions` object returned by Cloudscape straight into each BoardItem. Wrapping or modifying the callbacks can break their internal drag/drop/resize management.

4. **Avoid noisy debug logging.** Excessive `console.debug` statements in render paths flood DevTools and make diagnosing real issues difficult. Log only when needed and clean up once problems are resolved.

Following these guidelines keeps the board responsive, allows widgets to be added/removed via the split panel palette, and preserves the drag/resize experience Cloudscape expects.
