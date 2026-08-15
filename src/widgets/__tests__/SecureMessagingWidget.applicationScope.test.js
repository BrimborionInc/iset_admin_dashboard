import fs from 'fs';
import path from 'path';
import { resolveSecureMessageReplyScope } from '../SecureMessagingWidget';

jest.mock('@cloudscape-design/board-components', () => ({ BoardItem: 'board-item' }));
jest.mock('@cloudscape-design/components', () => ({
  Alert: 'alert',
  Header: 'header',
  SpaceBetween: 'space-between',
  Box: 'box',
  Button: 'button',
  ButtonDropdown: 'button-dropdown',
  Link: 'link',
  Spinner: 'spinner',
  TextFilter: 'text-filter',
  Table: 'table',
  Tabs: 'tabs',
  Modal: 'modal',
  Container: 'container',
  Input: 'input',
  Hotspot: 'hotspot',
}));
jest.mock('../../auth/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../../helpPanelContents/secureMessagesHelpPanelContent', () => () => null);
jest.mock('../../pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx', () => ({
  useCaseWorkspace: () => null,
}));
jest.mock('../SecureMessageComposePanel.jsx', () => ({
  openSecureMessageCompose: jest.fn(),
  SECURE_MESSAGE_REFRESH_EVENT: 'secure-messaging:refresh',
}));

describe('SecureMessagingWidget repeat-application reply scope', () => {
  it('derives reply scope from the selected message rather than the open workspace', () => {
    expect(resolveSecureMessageReplyScope({
      id: '991',
      application_id: '124',
    })).toEqual({
      applicationId: 124,
      replyToMessageId: 991,
    });
  });

  it('does not invent application scope for a legacy application-less message', () => {
    expect(resolveSecureMessageReplyScope({ id: 992, application_id: null })).toEqual({
      applicationId: null,
      replyToMessageId: 992,
    });
  });

  it('wires the selected-message scope into the reply compose event', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/widgets/SecureMessagingWidget.js'),
      'utf8'
    );
    expect(source).toContain('...resolveSecureMessageReplyScope(selectedMessage)');
  });
});
