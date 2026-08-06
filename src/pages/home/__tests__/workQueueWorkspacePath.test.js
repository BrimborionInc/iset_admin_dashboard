import { getWorkspacePath } from '../widgets/WorkQueueItemsTableWidget';

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
    const first = getWorkspacePath({ case_id: 76, application_id: 123, type: 'Application' });
    const repeat = getWorkspacePath({ case_id: 76, application_id: 124, type: 'Application' });

    expect(first).toBe('/application-case/76?applicationId=123');
    expect(repeat).toBe('/application-case/76?applicationId=124');
    expect(first).not.toBe(repeat);
  });
});
