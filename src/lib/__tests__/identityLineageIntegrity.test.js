const fs = require('fs');
const path = require('path');
const { resolveActionPlanApplicationLineage } = require('../actionPlanApplicationLineage');
const {
  assertCanonicalApprovalClientLink,
  linkCanonicalApprovalClient,
} = require('../approvalClientLink');

describe('R5a identity and application lineage integrity', () => {
  test('a repeat-application workspace keeps the selected application instead of the current primary', () => {
    expect(resolveActionPlanApplicationLineage({
      caseId: 10,
      requestedApplicationId: 202,
      primaryApplicationId: 101,
      applicationCaseId: 10,
    })).toBe(202);
    expect(() => resolveActionPlanApplicationLineage({
      caseId: 10,
      requestedApplicationId: 202,
      applicationCaseId: 11,
    })).toThrow(expect.objectContaining({ code: 'action_plan_application_case_mismatch' }));
  });

  test('canonical application ownership fails closed on a strong client conflict', () => {
    expect(() => assertCanonicalApprovalClientLink({
      caseId: 10,
      applicationId: 202,
      applicationCaseId: 10,
      applicationClientId: 31,
      existingCaseClientId: 44,
    })).toThrow(expect.objectContaining({
      code: 'approval_client_ownership_conflict',
      statusCode: 409,
    }));
  });

  test('strong ownership conflict performs zero client or case writes', async () => {
    const writes = [];
    const connection = {
      query: jest.fn(async sql => {
        if (/FROM iset_application/.test(sql)) {
          return [[{ id: 202, case_id: 10, client_id: 31 }]];
        }
        writes.push(sql);
        return [[]];
      }),
    };
    await expect(linkCanonicalApprovalClient(connection, {
      caseId: 10,
      applicationId: 202,
      existingCaseClientId: 44,
    })).rejects.toMatchObject({ code: 'approval_client_ownership_conflict' });
    expect(writes).toEqual([]);
  });

  test('production paths persist selected lineage and never use email to repair approval ownership', () => {
    const server = fs.readFileSync(path.resolve(process.cwd(), 'isetadminserver.js'), 'utf8');
    const approvalStart = server.indexOf('async function ensureCaseClientLinkForApproval');
    const approvalEnd = server.indexOf('async function getHighestApplicationVersion', approvalStart);
    const approval = server.slice(approvalStart, approvalEnd);
    const planStart = server.indexOf("app.post('/api/cases/:id/action-plans'");
    const planEnd = server.indexOf("app.get('/api/cases/:id/cfa-versions'", planStart);
    const planRoute = server.slice(planStart, planEnd);

    expect(approval).toContain('linkCanonicalApprovalClient(connection');
    expect(approval).not.toContain('emailNormalized');
    expect(approval).not.toContain('sinHash');
    expect(planRoute).toContain('(case_id, application_id, name, status');
    expect(planRoute).toContain('actionPlanApplicationId');
    expect(server).toContain('(case_id, application_id, name, status, agreement_number');
    expect(server).toContain('application_id = COALESCE(VALUES(application_id), iset_intervention_proposal.application_id)');
    expect(server).toContain('COALESCE(p.application_id, ap.application_id, a.id) AS application_id');
  });

  test('contact-note attribution has no email fallback after the subject resolver', () => {
    const server = fs.readFileSync(path.resolve(process.cwd(), 'isetadminserver.js'), 'utf8');
    const routeStart = server.indexOf("app.post('/api/admin/contact-messages/:id/notes'");
    const routeEnd = server.indexOf("app.get('/api/admin/contact-messages/:id/notes'", routeStart);
    const route = server.slice(routeStart, routeEnd);
    expect(route).toContain('resolveExistingUserIdFromAuth(req, pool)');
    expect(route).not.toMatch(/FROM user WHERE email/i);
    expect(route).not.toContain('candidateEmails');
  });
});
