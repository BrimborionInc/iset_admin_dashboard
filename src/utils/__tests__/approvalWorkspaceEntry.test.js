import {
  buildApprovalWorkspacePath,
  parseWorkspaceEntry,
} from '../approvalWorkspaceEntry';

describe('approvalWorkspaceEntry', () => {
  it('preserves the selected application in an application approval deep link', () => {
    const path = buildApprovalWorkspacePath({
      basePath: '/application-case/76',
      approvalType: 'application',
      step: 'decision',
      applicationId: 123,
    });

    expect(path).toBe(
      '/application-case/76?entry=approval&approvalType=application&step=decision&applicationId=123'
    );
    expect(parseWorkspaceEntry(path.split('?')[1])).toMatchObject({
      mode: 'approval',
      approvalType: 'application',
      step: 'decision',
      applicationId: 123,
    });
  });

  it('distinguishes repeat applications on the same case', () => {
    const first = parseWorkspaceEntry(
      '?entry=approval&approvalType=application&step=decision&applicationId=123'
    );
    const repeat = parseWorkspaceEntry(
      '?entry=approval&approvalType=application&step=decision&applicationId=124'
    );

    expect(first.key).not.toBe(repeat.key);
    expect(first.applicationId).toBe(123);
    expect(repeat.applicationId).toBe(124);
  });

  it('preserves application lineage in intervention approval links', () => {
    const path = buildApprovalWorkspacePath({
      basePath: '/cases/76',
      approvalType: 'intervention',
      step: 'review',
      applicationId: 124,
      interventionId: 91,
      planId: 47,
    });

    expect(parseWorkspaceEntry(path.split('?')[1])).toMatchObject({
      approvalType: 'intervention',
      step: 'review',
      applicationId: 124,
      interventionId: 91,
      planId: 47,
    });
  });
});
