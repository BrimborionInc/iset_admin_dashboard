import {
  appendWorkQueueEiVerificationUploadFields,
  getWorkspacePath,
  updateApplicationEligibility,
} from '../widgets/WorkQueueItemsTableWidget';

jest.mock('@cloudscape-design/board-components', () => ({ BoardItem: 'board-item' }));
jest.mock('@cloudscape-design/components', () => ({
  Box: 'box',
  Badge: 'badge',
  Button: 'button',
  ButtonDropdown: 'button-dropdown',
  CopyToClipboard: 'copy-to-clipboard',
  FormField: 'form-field',
  Header: 'header',
  Hotspot: 'hotspot',
  Icon: 'icon',
  Link: 'link',
  Modal: 'modal',
  Select: 'select',
  SpaceBetween: 'space-between',
  StatusIndicator: 'status-indicator',
  Table: 'table',
  Textarea: 'textarea',
  TextFilter: 'text-filter',
}));

describe('work queue workspace links', () => {
  it('keeps the exact application on application approval fallback links', () => {
    expect(
      getWorkspacePath({
        case_id: 76,
        application_id: 123,
        type: 'AwaitingApproval',
      })
    ).toBe(
      '/application-case/76?entry=approval&approvalType=application&step=decision&applicationId=123'
    );
  });

  it('does not collapse repeat applications on the same case to one fallback link', () => {
    const first = getWorkspacePath({ case_id: 76, application_id: 123, type: 'AwaitingApproval' });
    const repeat = getWorkspacePath({ case_id: 76, application_id: 124, type: 'AwaitingApproval' });

    expect(first).toBe('/application-case/76?entry=approval&approvalType=application&step=decision&applicationId=123');
    expect(repeat).toBe('/application-case/76?entry=approval&approvalType=application&step=decision&applicationId=124');
    expect(first).not.toBe(repeat);
  });
});

describe('work queue EI eligibility writes', () => {
  it('tags the uploaded verification document with the selected EI status and exact scope', () => {
    const formData = { append: jest.fn() };
    const file = { name: 'ei-verification.pdf' };

    expect(appendWorkQueueEiVerificationUploadFields({
      formData,
      file,
      eligibilityStatus: 'EI Reach Back',
      caseId: 76,
      applicationId: 124,
    })).toBe(formData);

    expect(formData.append.mock.calls).toEqual([
      ['file', file],
      ['label', 'EI Verification'],
      ['documentType', 'ei_verification'],
      ['eligibilityStatus', 'EI Reach Back'],
      ['caseId', 76],
      ['applicationId', 124],
    ]);
  });

  it('sends the exact selected application id with the case-scoped update', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true });

    await updateApplicationEligibility({
      fetcher,
      caseId: 76,
      applicationId: 124,
      value: 'EI Reach Back',
    });

    expect(fetcher).toHaveBeenCalledWith('/api/cases/76', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: 124,
        assessment_esdc_eligibility: 'EI Reach Back',
      }),
    });
  });

  it('fails closed before a request when application scope is missing', () => {
    const fetcher = jest.fn();

    expect(() => updateApplicationEligibility({
      fetcher,
      caseId: 76,
      applicationId: null,
      value: 'CRF',
    })).toThrow('application_id_required');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
