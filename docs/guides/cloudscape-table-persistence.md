# Cloudscape Table Implementation Standard

Use the Finance module’s `BudgetHierarchyWidget` (`src/pages/finance/widgets/BudgetHierarchyWidget.jsx`) as the canonical pattern for every new Cloudscape table. This guide extracts the key practices from that widget so we ship consistent filtering, pagination, collection preferences, and persistence behaviour by default.

---

## 1. Capabilities every table must ship

- **Filtering:** pair a `TextFilter` with any domain filters (segmented control, select, badge filters). Keep filter state controlled and reflect it in the header counter.
- **Column management:** expose a `CollectionPreferences` component with `contentDisplayPreference`, locking mandatory columns in place by re-inserting them during `onConfirm`.
- **Resizable columns:** enable `resizableColumns` and wire `onColumnWidthsChange` to persist widths.
- **Pagination:** render `Pagination` with controlled `currentPageIndex` / `pagesCount`; disable when the current view mode does not support paging (e.g., tree view).
- **Selection:** keep `selectionType` controlled and pass selection changes through to the workspace context so downstream widgets stay in sync.
- **Accessibility:** enable `stickyHeader` and `enableKeyboardNavigation`, and use the shared `boardItemI18nStrings` when wrapping the table in a `BoardItem`.

---

## 2. State management & persistence

### Preference storage

- Versioned key per widget, e.g. `const PREFERENCES_STORAGE_KEY = "caseworking-interventions-preferences-v1";`
- Hydrate synchronously (`typeof window === "undefined"` guard) and merge with defaults.
- Persist view mode, search text, domain filters, visible columns, and page size in a single object.

```ts
const persistPreferences = next => {
  const visibleSet = new Set(next.visibleColumns ?? defaultPreferences.visibleColumns);
  visibleSet.add("pot"); // keep mandatory identifier column

  const payload = {
    ...defaultPreferences,
    ...next,
    visibleColumns: ALL_COLUMN_IDS.filter(id => visibleSet.has(id)),
  };

  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
};
```

### Column widths

- Dedicated key: `const COLUMN_WIDTHS_STORAGE_KEY = "caseworking-interventions-column-widths-v1";`
- Support both `detail.columnWidths` (`[{ id, width }]`) and `detail.widths` (width array).
- Persist only numeric widths with known IDs; remove the key if the array becomes empty.
- Apply stored widths by mapping onto `columnDefinitions` before the table renders.

### Order of operations

1. Load preferences into state.
2. Load column widths and merge into column definitions.
3. Render the table.
4. On state changes (filters, page size, visible columns, widths), update React state first, then persist.
5. Reset pagination to page 1 whenever filters, search text, or visible columns change.

---

## 3. Filtering & view modes

- Debounce `TextFilter` updates (200-300 ms) to avoid noisy re-renders.
- Keep domain filters (e.g., risk segmented control) in the same preference object.
- For dual views (tree vs. flat), compute tree data once and derive flat rows via a memoised flatten helper. Only enable pagination in flat mode.
- Update the table header counter to show the filtered row count (`counter={`(${totalMatches})`}`).

---

## 4. Collection preferences workflow

1. Render `CollectionPreferences` with:
   - `pageSizePreference` tied to stored page size (`DEFAULT_PAGE_SIZE`, `PAGE_SIZE_OPTIONS`).
   - `contentDisplayPreference` generated from the canonical column definitions.
   - `preferences={preferencesState}` so Cloudscape reflects the current selection.
2. In `onConfirm`:
   - Update `pageSize`, `visibleColumns`, and column widths (call `applyColumnWidthUpdates`).
   - Re-append mandatory columns after filtering the user’s selection.
   - Reset `currentPageIndex` to `1`.
3. Persist the merged preferences and column widths immediately afterwards.

---

## 5. Testing checklist

1. Toggle each filter and reload; selections should persist from `localStorage`.
2. Resize multiple columns, reload, and confirm widths remain.
3. Hide/show columns in the settings cog; required columns must never disappear.
4. Change page size and confirm pagination resets to page 1; verify pagination is disabled in modes that do not page.
5. Use keyboard navigation (arrow keys, space/enter) to change selection without breaking focus styling.
6. Clear the preference and column-width keys in `localStorage` and ensure defaults apply cleanly without console errors.

---

## 6. Reference implementation

- Canonical widget: `src/pages/finance/widgets/BudgetHierarchyWidget.jsx`
- Reuse helper utilities (`loadStoredColumnWidths`, `persistColumnWidths`, filtering helpers) when building new tables; rename keys per module but keep the logic identical.

If a future change requires deviating from this standard, update this guide and leave breadcrumbs in the widget comment header so the next engineer knows why the divergence exists.
