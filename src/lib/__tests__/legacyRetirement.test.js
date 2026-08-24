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
    const routeStart = server.indexOf("app.post('/api/clear-iset-test-data'");
    const routeEnd = server.indexOf('// (Removed duplicate linkage-stats route', routeStart);
    const route = server.slice(routeStart, routeEnd);
    expect(route).toContain('accountEventIntegrity');
    expect(route).toContain('clear_test_data_integrity_failed');
    expect(route.indexOf('accountEventIntegrity')).toBeLessThan(route.indexOf('connection.commit()'));
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
