import fs from 'fs';
import path from 'path';
import { buildCaseNoteReminderAcknowledgementRequest } from '../CaseNotesWidget';

jest.mock('@cloudscape-design/board-components', () => ({ BoardItem: 'board-item' }));
jest.mock('@cloudscape-design/components', () => ({
  Header: 'header',
  Box: 'box',
  ButtonDropdown: 'button-dropdown',
  SpaceBetween: 'space-between',
  Button: 'button',
  Container: 'container',
  Spinner: 'spinner',
  Alert: 'alert',
  Modal: 'modal',
  FormField: 'form-field',
  Textarea: 'textarea',
  Badge: 'badge',
  Link: 'link',
  DatePicker: 'date-picker',
  Hotspot: 'hotspot',
}));
jest.mock('../../auth/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../../helpPanelContents/caseNotesHelp', () => () => null);
jest.mock('../../pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx', () => ({
  useCaseWorkspace: () => null,
}));

const readWidget = fileName => fs.readFileSync(
  path.join(process.cwd(), 'src/widgets', fileName),
  'utf8'
);

const findBrowserAcknowledgementCallers = directory => {
  const callers = [];
  fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') callers.push(...findBrowserAcknowledgementCallers(fullPath));
      return;
    }
    if (!/\.[jt]sx?$/.test(entry.name)) return;
    const source = fs.readFileSync(fullPath, 'utf8');
    if (source.includes('/api/reminders/') && source.includes('/acknowledge')) {
      callers.push([path.relative(process.cwd(), fullPath), source]);
    }
  });
  return callers;
};

describe('reminder acknowledgement caller contracts', () => {
  test('case notes sends an explicit application or case workspace expectation', () => {
    const applicationRequest = buildCaseNoteReminderAcknowledgementRequest({
      workspaceMode: 'application',
      caseId: 10,
      applicationId: 20,
    });
    expect(JSON.parse(applicationRequest.body)).toEqual({
      scopeMode: 'application',
      expectedCaseId: 10,
      expectedApplicationId: 20,
    });

    const caseRequest = buildCaseNoteReminderAcknowledgementRequest({
      workspaceMode: 'case',
      caseId: 10,
      applicationId: 20,
    });
    expect(JSON.parse(caseRequest.body)).toEqual({
      scopeMode: 'case',
      expectedCaseId: 10,
    });
    expect(buildCaseNoteReminderAcknowledgementRequest({
      caseId: 10,
      applicationId: 20,
    })).toBeNull();
  });

  test('Application Events is audit-only and cannot acknowledge a case-wide reminder', () => {
    const source = readWidget('applicationEvents.js');
    expect(source).not.toContain('/api/reminders/');
    expect(source).not.toContain('handleAcknowledgeReminder');
    expect(source).not.toContain('Acknowledge reminder');

    const applicationHelp = fs.readFileSync(
      path.join(process.cwd(), 'src/helpPanelContents/applicationEventsHelp.js'),
      'utf8'
    );
    const caseTimelineHelp = fs.readFileSync(
      path.join(process.cwd(), 'src/helpPanelContents/caseWorkspaceTimelineHelp.js'),
      'utf8'
    );
    [applicationHelp, caseTimelineHelp].forEach(helpSource => {
      expect(helpSource).toContain('timeline is audit-only');
      expect(helpSource).toContain('Case Calendar or Notes and Tasks');
      expect(helpSource).not.toContain('include an action to acknowledge');
    });
  });

  test('every remaining browser acknowledgement caller supplies a scoped JSON request', () => {
    const activeCallers = findBrowserAcknowledgementCallers(
      path.join(process.cwd(), 'src')
    );
    expect(activeCallers.map(([fileName]) => fileName).sort()).toEqual([
      'src/widgets/CaseCalendarWidget.js',
      'src/widgets/CaseNotesWidget.js',
    ]);
    const sourcesByFile = Object.fromEntries(activeCallers);
    expect(sourcesByFile['src/widgets/CaseCalendarWidget.js']).toContain(
      'buildCaseCalendarAcknowledgementRequest(reminderScope)'
    );
    expect(sourcesByFile['src/widgets/CaseNotesWidget.js']).toContain(
      'reminderAcknowledgementRequest'
    );
    activeCallers.forEach(([, source]) => {
      expect(source).toContain("'Content-Type': 'application/json'");
      expect(source).toContain('expectedCaseId');
    });
  });
});
