# Dashboard Scaffolding Guide

This guide tracks what “scaffold a dashboard” means for the Financial Management module and similar Cloudscape boards. Keep it current whenever requirements or patterns change.

## 1. Definition
Scaffolding a dashboard means delivering a configurable Cloudscape board that matches the CR-0003 requirements while still running on mock/local state. The scaffold must:
- Ship a fully wired page component (route, breadcrumbs, board layout, palette events, persistence).
- Provide functional widgets with representative mock data and interactions.
- Supply dashboard-level and widget-level help panel content, each with AI context prompts.
- Follow the Cloudscape persistence conventions documented in `docs/guides/cloudscape-table-persistence.md`.

## 2. Standard Steps

1. **Promote placeholder prose into help content**
   - Remove descriptive text from the page placeholder component.
   - Create/update `src/helpPanelContents/<dashboard>Help.js` using that text as the basis.
   - Ensure the dashboard page imports the help component and passes its `aiContext` into `renderContent`.

2. **Build the configurable board**
   - Mirror the pattern used in `FinanceOverviewPage`, `FinanceBudgetsPage`, `FinanceAllocationsPage`, `FinanceReconciliationPage`, or the new `FinancePaymentsPage`.
   - Define a `widgetRegistry`, a versioned `STORAGE_KEY`, default layout, helpers for palette items, and persistence via `window.localStorage`.
   - Wire `Add widget` / `Reset layout` buttons and custom events (`<dashboard>:openPalette`, `<dashboard>:resetLayout`) so the board integrates with `AppContent`’s palette.
   - Export mock data or contexts as needed (e.g., `<Dashboard>DataProvider`) to keep widgets cohesive.

3. **Create widgets**
   - Add React components under `src/pages/<feature>/widgets/`, each returning a `BoardItem` with header, mock payload, and Cloudscape controls.
   - Align widget capabilities with the CR's functional bullets (actions, tables, charts, forms, status indicators).
   - Persist per-widget preferences (table columns, widths, filters) when applicable, reusing helper patterns from existing widgets.
   - When a widget renders a Cloudscape table:
     - Include pagination controls and the settings cogwheel (`CollectionPreferences`) so users can manage page size and visible columns.
     - Enable resizable columns and persist width changes to `localStorage` (see `BudgetHierarchyWidget.jsx` for the reference implementation).

4. **Author widget help files**
   - For every widget, create `src/helpPanelContents/<widget>Help.js`.
   - Use the widget’s purpose, workflow, and notes from the CR as the narrative.
   - Export an `aiContext` string summarising the widget’s intent for the in-app assistant.
   - Reference help components from widgets via `metadata.helpComponent` so the board renders Info links.

5. **Connect routing, navigation, and access control**
   - Ensure `src/routes/AppRoutes.js` imports the page component and help content.
   - Confirm the side navigation already points to the route (or update if needed).
   - Register the new route with the access control tooling:
     - Add a friendly label in `src/widgets/AccessControlMatrix.jsx` (`ROUTE_LABELS`).
     - Extend `src/config/roleMatrix.json` so the route defaults to `["System Administrator", "NWAC Administrator"]`.
   - Verify breadcrumb updates and `renderContent` calls include unique help keys/contexts.

6. **Mock data & events**
   - Populate widgets with believable sample records that demonstrate expected behaviours (filters, status badges, actions).
   - Emit and listen for custom events to keep widgets coordinated (e.g., saved view broadcasts, prefill requests) consistent with existing dashboards.

## 3. Quality Checklist
- [ ] Page renders a Cloudscape `Board` with movable/removable widgets and palette integration.
- [ ] Layout changes persist and reset correctly.
- [ ] Dashboard-level help panel exists, using migrated placeholder prose, with `aiContext` defined.
- [ ] Each widget exposes an Info link hooked to a dedicated help file with `aiContext`.
- [ ] Mock data covers key user goals outlined in CR-0003.
- [ ] Access Control matrix lists the dashboard with System Administrator and NWAC Administrator enabled by default.
- [ ] New modules respect naming/versioning conventions (`finance-<dashboard>-layout-v1`, etc.).
- [ ] No leftover placeholder components remain for the scaffolded page.

Update this guide whenever new expectations emerge (e.g., additional telemetry requirements, new persistence helpers, revised naming standards).
