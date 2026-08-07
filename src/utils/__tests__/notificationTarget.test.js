import { buildNotificationTargetPath } from '../notificationTarget';

describe('notificationTarget', () => {
  it('preserves the exact application when a case has repeat applications', () => {
    expect(buildNotificationTargetPath({
      caseId: 76,
      applicationId: 123,
      isCaseManaged: true,
    })).toBe('/application-case/76?applicationId=123');

    expect(buildNotificationTargetPath({
      caseId: 76,
      applicationId: 124,
      isCaseManaged: true,
    })).toBe('/application-case/76?applicationId=124');
  });

  it('retains the existing case and tracking fallbacks without application scope', () => {
    expect(buildNotificationTargetPath({ caseId: 76, isCaseManaged: true })).toBe('/cases/76');
    expect(buildNotificationTargetPath({ caseId: 76 })).toBe('/application-case/76');
    expect(buildNotificationTargetPath({ trackingId: 'ISET-123' })).toBe('/application-case/ISET-123');
  });
});
