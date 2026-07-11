const {
  assertManualSelectedClientIdentity,
  selectedClientIdentityMismatches,
} = require('../manualIntakeSelectedClient');
const fs = require('fs');
const path = require('path');

describe('manual intake selected-client containment', () => {
  const selectedClient = {
    id: 12,
    identity_email: 'ada@example.ca',
    dob: new Date('1990-01-02T00:00:00.000Z'),
  };
  const applicantSeed = {
    email: 'ada@example.ca',
    dateOfBirth: '1990-01-02',
  };

  test('accepts a current selected client with matching email and DOB', () => {
    expect(selectedClientIdentityMismatches(selectedClient, applicantSeed)).toEqual([]);
    expect(() => assertManualSelectedClientIdentity({
      strategy: 'link_selected_client',
      selectedClient,
      applicantSeed,
    })).not.toThrow();
  });

  test.each([
    ['email', { ...applicantSeed, email: 'grace@example.ca' }],
    ['date_of_birth', { ...applicantSeed, dateOfBirth: '1906-12-09' }],
  ])('fails closed when selected-client %s differs', (field, input) => {
    expect(selectedClientIdentityMismatches(selectedClient, input)).toContain(field);
    expect(() => assertManualSelectedClientIdentity({
      strategy: 'link_selected_client',
      selectedClient,
      applicantSeed: input,
    })).toThrow(expect.objectContaining({
      code: 'manual_selected_client_identity_mismatch',
      statusCode: 409,
      mismatches: expect.arrayContaining([field]),
    }));
  });

  test('requires a selection for link strategy and rejects one under another strategy', () => {
    expect(() => assertManualSelectedClientIdentity({
      strategy: 'link_selected_client',
      selectedClient: null,
      applicantSeed,
    })).toThrow(expect.objectContaining({ code: 'manual_selected_client_required', statusCode: 422 }));
    expect(() => assertManualSelectedClientIdentity({
      strategy: 'review_later',
      selectedClient,
      applicantSeed,
    })).toThrow(expect.objectContaining({ code: 'manual_selected_client_strategy_mismatch', statusCode: 409 }));
  });

  test('production manual-intake route checks identity before resolving or writing the applicant user', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'isetadminserver.js'), 'utf8');
    const routeStart = source.indexOf("app.post('/api/applications/manual-intake'");
    const routeEnd = source.indexOf("app.post('/api/imports/client-files/dry-run'", routeStart);
    const route = source.slice(routeStart, routeEnd);
    const containment = route.indexOf('assertManualSelectedClientIdentity({');
    const firstApplicantWrite = route.indexOf('resolveOrCreateManualApplicantUser(');
    expect(routeStart).toBeGreaterThan(-1);
    expect(containment).toBeGreaterThan(-1);
    expect(firstApplicantWrite).toBeGreaterThan(containment);
  });
});
