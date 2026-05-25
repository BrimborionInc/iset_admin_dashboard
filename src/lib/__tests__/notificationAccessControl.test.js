const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(
  path.join(process.cwd(), 'isetadminserver.js'),
  'utf8'
);

function extractRouteBlock(method, route) {
  const marker = `app.${method}('${route}'`;
  const start = serverSource.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextRoute = serverSource.indexOf('\napp.', start + marker.length);
  return serverSource.slice(start, nextRoute === -1 ? undefined : nextRoute);
}

describe('notification access control', () => {
  test('notification config access uses route matrix checks instead of hardcoded roles', () => {
    const functionStart = serverSource.indexOf('async function requireNotificationConfigAccess');
    expect(functionStart).toBeGreaterThanOrEqual(0);
    const functionEnd = serverSource.indexOf('\n}\n\n// Get all templates', functionStart);
    const functionSource = serverSource.slice(functionStart, functionEnd);

    expect(functionSource).toContain('requestHasAnyRouteMatrixAccess(req, routePaths)');
    expect(functionSource).not.toContain('hasSystemOrNwacAdminAccess');
  });

  test('template authoring endpoints follow template-editor route access', () => {
    expect(extractRouteBlock('get', '/api/templates')).toContain(
      'requireNotificationConfigAccess(req, res, [TEMPLATE_EDITOR_ROUTE, MANAGE_NOTIFICATIONS_ROUTE])'
    );
    expect(extractRouteBlock('get', '/api/templates/:templateId')).toContain(
      'requireNotificationConfigAccess(req, res, TEMPLATE_EDITOR_ROUTE)'
    );
    expect(extractRouteBlock('post', '/api/templates/:templateId')).toContain(
      'requireNotificationConfigAccess(req, res, TEMPLATE_EDITOR_ROUTE)'
    );
    expect(extractRouteBlock('delete', '/api/templates/:templateId')).toContain(
      'requireNotificationConfigAccess(req, res, TEMPLATE_EDITOR_ROUTE)'
    );
  });

  test('notification settings endpoints follow manage-notifications route access', () => {
    [
      extractRouteBlock('get', '/api/config/notifications/email-settings'),
      extractRouteBlock('patch', '/api/config/notifications/email-settings'),
      extractRouteBlock('get', '/api/notifications'),
      extractRouteBlock('post', '/api/notifications'),
      extractRouteBlock('delete', '/api/notifications/:id')
    ].forEach((routeSource) => {
      expect(routeSource).toContain(
        'requireNotificationConfigAccess(req, res, MANAGE_NOTIFICATIONS_ROUTE)'
      );
    });
  });
});
