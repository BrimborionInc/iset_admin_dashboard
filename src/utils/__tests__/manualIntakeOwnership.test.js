import fs from 'fs';
import path from 'path';

import { clearSession, saveSession } from '../../auth/cognito';
import {
  LEGACY_MANUAL_INTAKE_DRAFT_KEY,
  bindManualIntakeSelection,
  fingerprintManualIntakeIdentity,
  fingerprintManualIntakeQuery,
  manualIntakeSelectionIsCurrent,
  purgeLegacyManualIntakeDraft,
} from '../manualIntakeOwnership';

describe('manual intake browser ownership', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('normalizes query and identity fingerprints without retaining their raw values', () => {
    expect(fingerprintManualIntakeQuery(' Applicant@Example.CA ')).toBe(
      fingerprintManualIntakeQuery('applicant@example.ca')
    );
    const fingerprint = fingerprintManualIntakeIdentity({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.ca',
      dateOfBirth: '1990-01-02',
    });
    expect(fingerprint).toBeTruthy();
    expect(fingerprint).not.toContain('ada');
    expect(fingerprint).not.toContain('1990');
  });

  test('selection is valid only for the current query, identity, and result generation', () => {
    const context = {
      queryFingerprint: fingerprintManualIntakeQuery('ada@example.ca'),
      identityFingerprint: fingerprintManualIntakeIdentity({ email: 'ada@example.ca' }),
      generation: 4,
    };
    const selection = bindManualIntakeSelection({ clientId: 12, applicantName: 'Ada' }, context);
    expect(manualIntakeSelectionIsCurrent(selection, context)).toBe(true);
    expect(manualIntakeSelectionIsCurrent(selection, { ...context, generation: 5 })).toBe(false);
    expect(manualIntakeSelectionIsCurrent(selection, {
      ...context,
      queryFingerprint: fingerprintManualIntakeQuery('grace@example.ca'),
    })).toBe(false);
    expect(manualIntakeSelectionIsCurrent(selection, {
      ...context,
      identityFingerprint: fingerprintManualIntakeIdentity({ email: 'grace@example.ca' }),
    })).toBe(false);
    expect(manualIntakeSelectionIsCurrent(selection, {
      ...context,
      identityFingerprint: fingerprintManualIntakeIdentity({
        email: 'ada@example.ca',
        sin: '123 456 789',
      }),
    })).toBe(false);
  });

  test('legacy PII draft is purged on explicit clear and every session save/clear boundary', () => {
    sessionStorage.setItem(LEGACY_MANUAL_INTAKE_DRAFT_KEY, JSON.stringify({ sin: '123456789' }));
    expect(purgeLegacyManualIntakeDraft()).toBe(true);
    expect(sessionStorage.getItem(LEGACY_MANUAL_INTAKE_DRAFT_KEY)).toBeNull();

    sessionStorage.setItem(LEGACY_MANUAL_INTAKE_DRAFT_KEY, 'staff-a-pii');
    saveSession({ id_token: 'id-a', access_token: 'access-a', refresh_token: 'refresh-a', expires_in: 3600 });
    expect(sessionStorage.getItem(LEGACY_MANUAL_INTAKE_DRAFT_KEY)).toBeNull();

    sessionStorage.setItem(LEGACY_MANUAL_INTAKE_DRAFT_KEY, 'staff-b-pii');
    clearSession();
    expect(sessionStorage.getItem(LEGACY_MANUAL_INTAKE_DRAFT_KEY)).toBeNull();
    expect(sessionStorage.getItem('authSession')).toBeNull();
  });

  test('manual intake page contains no session-storage read or write path', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/intake/ManualApplicationIntakePage.jsx'),
      'utf8'
    );
    expect(source).not.toMatch(/sessionStorage\.(?:getItem|setItem)/);
    expect(source).not.toContain('buildDraftPayload');
    expect(source).not.toContain('loadDraft');
  });
});
