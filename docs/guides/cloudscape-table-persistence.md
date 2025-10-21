# Cloudscape Table Persistence Notes

This note captures the steps (and past gotchas) for making Cloudscape tables remember user preferences across reloads. It’s based on the fixes we applied to the Finance Budgets dashboard after several failed attempts, so following it should prevent a repeat of that debugging loop.

## What to persist

Decide which parts of the table state must survive a reload. Typical items:

- View mode toggles (e.g., tree vs. flat).
- Domain filters (risk, timeframe, search text).
- Pagination state (current page, page size).
- Column visibility and ordering.
- Column widths from user-resizing actions.
- Selected saved view (if we have a saved-views widget).

Keep all of these in a single preference object keyed off the widget, e.g.:

```ts
const PREFERENCES_STORAGE_KEY = "finance-budget-hierarchy-preferences-v1";
```

Store a versioned key so we can bump the suffix when schema changes.

## When to load preferences

1. On initial render, synchronously read from `window.localStorage`. Guard for `typeof window === "undefined"` so server-side rendering doesn’t explode.
2. Populate React state with the stored values; default back to our built-in initial state if the key isn’t present or the payload is malformed.
3. Only use a saved preset (e.g., the default saved view) when no preferences were stored. Otherwise the table state should honour the stored preference. This was a key bug: our saved-view widget always broadcast its “tree” preset on mount, overwriting the persisted state every time.

## Persisting changes

Whenever a relevant value changes (view mode, filter, page size, visible columns, etc.), call a `persistPreferences()` helper to write the merged object back to localStorage. Centralise the logic so every state update goes through the same sanitiser.

Example sanitiser:

```ts
const persistPreferences = prefs => {
  const payload = {
    ...defaultPreferences,
    ...prefs,
    visibleColumns: Array.from(
      new Set((prefs.visibleColumns ?? defaultPreferences.visibleColumns)
        .filter(id => ALL_COLUMN_IDS.includes(id)))
    ),
  };
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
};
```

Always de-dupe `visibleColumns` and make sure required columns (e.g., the primary “pot” column) stay in the list.

## Column width handling

Cloudscape emits column-width updates in one of two shapes:

- `detail.columnWidths`: array of `{ id, width }`.
- `detail.widths`: array of raw numbers matching the currently rendered columns.

Handle both cases. Ignore any entries lacking numeric widths or IDs we don’t recognise. Use the column order we render (e.g., `columnDefinitionsForTable`) to map raw widths back to column IDs when necessary. Once sanitised, store them via the same preference key or a dedicated `finance-budget-hierarchy-column-widths-v1`.

## Order of operations

1. **Load stored preferences** ➜ set initial React state.
2. **Load stored column widths** ➜ merge into column definitions before rendering.
3. **Render** the table.
4. **Only after state is ready** should we dispatch any “apply saved view” events (if needed). Skip dispatch if preferences already existed.
5. **On change events** (filters, column widths, page size) ➜ update state ➜ persist preferences.

Failing to respect this order is what caused Tree view to keep winning: we broadcast the preset event before state finished initialising, thereby overwriting the stored view mode every time.

## Testing checklist

After wiring persistence:

1. Toggle view mode (tree/flat). Reload the page. Confirm the same mode returns.
2. Change a risk filter and the text filter. Reload. Filters should be restored.
3. Resize a column, navigate away (or reload), and confirm the width sticks.
4. If a saved view widget exists, hit its Info link and make sure the view mode doesn’t reset. (The Info link causing a rerender exposed our earlier bug.)
5. Clear `localStorage` for the preference key and ensure defaults kick back in cleanly.

Following this recipe keeps preferences reliable and avoids the silent regressions we hit on the Budgets dashboard. Whenever we introduce a new table, copy the helpers, rename the keys, and verify with the checklist above.*** End Patch
