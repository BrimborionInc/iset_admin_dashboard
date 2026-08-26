const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

describe('R6b dormant and compatibility cleanup', () => {
  test('Clear Test Data removes account events before clients and checks the relationship postcondition', () => {
    const server = read('isetadminserver.js');
    const listStart = server.indexOf('const ISET_TEST_DATA_TABLE_ORDER');
    const listEnd = server.indexOf('];', listStart);
    const order = server.slice(listStart, listEnd);
    expect(order.indexOf("'client_applicant_account_event'")).toBeGreaterThan(0);
    expect(order.indexOf("'client_applicant_account_event'")).toBeLessThan(order.indexOf("'client'"));
    expect(order.indexOf("'iset_document_lifecycle_event'")).toBeGreaterThan(0);
    expect(order.indexOf("'iset_document_lifecycle_event'")).toBeLessThan(
      order.indexOf("'iset_document_lifecycle'")
    );
    expect(order.indexOf("'iset_document_lifecycle'")).toBeLessThan(order.indexOf("'iset_document'"));
    for (const versionTable of [
      "'cfa_version_documents'",
      "'cfa_version'",
      "'cfa_series'",
      "'funding_overview_version_documents'",
      "'funding_overview_version'",
      "'funding_overview_series'",
    ]) {
      expect(order.indexOf(versionTable)).toBeGreaterThan(0);
      expect(order.indexOf(versionTable)).toBeLessThan(order.indexOf("'iset_case_action_plan'"));
      expect(order.indexOf(versionTable)).toBeLessThan(order.indexOf("'iset_application'"));
      expect(order.indexOf(versionTable)).toBeLessThan(order.indexOf("'iset_case'"));
    }
    expect(order.indexOf("'iset_application'")).toBeLessThan(
      order.indexOf("'iset_application_submission'")
    );
    expect(order.indexOf("'iset_application'")).toBeLessThan(order.indexOf("'iset_case'"));
    expect(order.indexOf("'iset_application'")).toBeLessThan(order.indexOf("'client'"));
    expect(order.indexOf("'iset_document'")).toBeLessThan(
      order.indexOf("'iset_intake.messages'")
    );
    expect(order.indexOf("'iset_event_delivery'")).toBeLessThan(
      order.indexOf("'iset_event_entry'")
    );
    expect(order.indexOf("'iset_reminder_lifecycle_event'")).toBeLessThan(
      order.indexOf("'iset_intake.iset_case_reminder'")
    );
    for (const referencingTable of [
      "'client_file_import_identity_claim'",
      "'iset_client_merge_audit'",
      "'iset_case_merge_audit'",
    ]) {
      expect(order.indexOf(referencingTable)).toBeGreaterThan(0);
      expect(order.indexOf(referencingTable)).toBeLessThan(order.indexOf("'iset_case'"));
      expect(order.indexOf(referencingTable)).toBeLessThan(order.indexOf("'client'"));
    }
    const clearHelperStart = server.indexOf('async function clearTableWithCount');
    const clearHelperEnd = server.indexOf('\nfunction clonePayload', clearHelperStart);
    const clearHelper = server.slice(clearHelperStart, clearHelperEnd);
    expect(clearHelper).toContain('DELETE FROM ${tableTarget.sqlIdentifier}');
    expect(clearHelper).not.toContain('ALTER TABLE');
    expect(clearHelper).not.toContain('AUTO_INCREMENT');
    const routeStart = server.indexOf("app.post('/api/clear-iset-test-data'");
    const routeEnd = server.indexOf('// (Removed duplicate linkage-stats route', routeStart);
    const route = server.slice(routeStart, routeEnd);
    expect(route).toContain('assertClearTestAccountEventIntegrity');
    expect(server).toContain('clear_test_data_integrity_failed');
    expect(route).not.toContain('FOREIGN_KEY_CHECKS');
    expect(route.indexOf('resolveClearTestDataEnvironmentSafety()')).toBeLessThan(
      route.indexOf('pool.getConnection()')
    );
    expect(route.indexOf('buildClearTestDataDeletionPlan(connection)')).toBeLessThan(
      route.indexOf('connection.beginTransaction()')
    );
    expect(route.indexOf('connection.beginTransaction()')).toBeLessThan(
      route.indexOf('detachClearTestDataSelfReferences(')
    );
    expect(route.indexOf('detachClearTestDataSelfReferences(')).toBeLessThan(
      route.indexOf('clearTableWithCount(connection, tableTarget)')
    );
    expect(route.indexOf('assertClearTestAccountEventIntegrity')).toBeLessThan(
      route.indexOf('connection.commit()')
    );
    expect(route).toContain('connection.rollback()');
  });

  test('draft Action Plan deletion preserves typed CFA evidence and directs staff to archive', () => {
    const server = read('isetadminserver.js');
    const routeStart = server.indexOf("app.post('/api/action-plans/:id/delete'");
    const routeEnd = server.indexOf("app.patch('/api/action-plans/:id'", routeStart);
    const route = server.slice(routeStart, routeEnd);
    const retainedEvidenceCheck = route.indexOf(
      'await findRetainedCfaVersionForActionPlan(deleteConnection, planId)'
    );
    const deleteMutation = route.indexOf('DELETE FROM iset_case_action_plan');
    expect(retainedEvidenceCheck).toBeGreaterThanOrEqual(0);
    expect(retainedEvidenceCheck).toBeLessThan(deleteMutation);
    expect(route).toContain("error: 'retained_cfa_evidence_blocks_plan_delete'");
    expect(route).toContain('Archive the Action Plan instead.');
  });

  test('intake authoring exposes static options only and no longer calls a retired catalogue', () => {
    const panel = read('src/pages/PropertiesPanel.js');
    const smoke = read('scripts/modify-component-editor-browser-smoke.js');
    expect(panel).toContain('PATH currently supports manually entered static options only.');
    expect(panel).not.toContain('/api/option-data-sources');
    expect(panel).not.toContain("value: 'dynamic'");
    expect(panel).not.toContain("value: 'snapshot'");
    expect(smoke).not.toContain('/api/option-data-sources');
  });

  test('the PTMA management surface is retired while Hub management has a scoped replacement', () => {
    const server = read('isetadminserver.js');
    const routes = read('src/routes/AppRoutes.js');
    const navigation = read('src/layouts/SideNavigation.js');
    const matrix = read('src/widgets/AccessControlMatrix.jsx');
    const hubRouter = read('src/routes/hubRoutes.js');
    const schemaContract = read('src/lib/adminRuntimeSchemaContract.js');
    for (const source of [server, routes, navigation, matrix]) {
      expect(source).not.toContain('/api/ptmas');
      expect(source).not.toContain('/ptma-management');
    }
    expect(server).toContain("app.use('/api/hubs', createHubRouter({ pool }))");
    expect(server).toContain('assertAdminRuntimeSchemaReady(pool)');
    expect(schemaContract).toContain("['ptma', ['id', 'type', 'iset_full_name']]");
    expect(routes).toContain('path="/modify-hub/:id"');
    expect(hubRouter).toContain("type = 'Hub'");
    expect(fs.existsSync(path.join(root, 'src/pages/manageLocations.js'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'src/pages/newLocationForm.js'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'src/routes/ptmaRoutes.js'))).toBe(false);
  });
});
