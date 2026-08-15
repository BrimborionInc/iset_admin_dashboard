import fs from 'fs';
import path from 'path';
import {
  buildCaseCalendarAcknowledgementRequest,
  buildCaseCalendarRemindersUrl,
  reminderMatchesCaseCalendarScope,
  resolveCaseCalendarReminderScope,
} from '../CaseCalendarWidget';

jest.mock('@cloudscape-design/board-components', () => ({ BoardItem: 'board-item' }));
jest.mock('@cloudscape-design/components', () => ({
  Header: 'header',
  SpaceBetween: 'space-between',
  Box: 'box',
  Link: 'link',
  ButtonDropdown: 'button-dropdown',
  Button: 'button',
  Container: 'container',
  Badge: 'badge',
  Tabs: 'tabs',
  Table: 'table',
  TextFilter: 'text-filter',
  Hotspot: 'hotspot',
}));
jest.mock('../../auth/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('../../helpPanelContents/caseCalendarHelp', () => () => null);
jest.mock('../../pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx', () => ({
  useCaseWorkspace: () => null,
}));

const reminder = (overrides = {}) => ({
  id: 1,
  caseId: 10,
  applicationId: null,
  actionPlanId: null,
  interventionId: null,
  ...overrides,
});

describe('CaseCalendarWidget application reminder scope', () => {
  const applicationScope = resolveCaseCalendarReminderScope({
    caseId: 10,
    applicationId: 20,
    workspaceMode: 'application',
  });
  const caseScope = resolveCaseCalendarReminderScope({
    caseId: 10,
    workspaceMode: 'case',
  });

  test('application mode requests an explicit case/application filter contract', () => {
    expect(applicationScope).toEqual({
      scopeMode: 'application',
      caseId: 10,
      applicationId: 20,
      valid: true,
    });
    expect(buildCaseCalendarRemindersUrl(applicationScope)).toBe(
      '/api/reminders?caseId=10&scopeMode=application&applicationId=20'
    );
    expect(buildCaseCalendarRemindersUrl(caseScope)).toBe(
      '/api/reminders?caseId=10&scopeMode=case'
    );
    expect(resolveCaseCalendarReminderScope({ caseId: 10, applicationId: 20 }).valid).toBe(false);
  });

  test('app A includes app A and true case-only reminders, but excludes app B and app-less plan lineage', () => {
    expect(reminderMatchesCaseCalendarScope(
      reminder({ id: 20, applicationId: 20, actionPlanId: 30 }),
      applicationScope
    )).toBe(true);
    expect(reminderMatchesCaseCalendarScope(
      reminder({ id: 21, applicationId: 21, actionPlanId: 31 }),
      applicationScope
    )).toBe(false);
    expect(reminderMatchesCaseCalendarScope(reminder({ id: 22 }), applicationScope)).toBe(true);
    expect(reminderMatchesCaseCalendarScope(
      reminder({ id: 23, actionPlanId: 31 }),
      applicationScope
    )).toBe(false);
  });

  test('case mode remains intentionally case-wide', () => {
    expect(reminderMatchesCaseCalendarScope(
      reminder({ applicationId: 20, actionPlanId: 30 }),
      caseScope
    )).toBe(true);
    expect(reminderMatchesCaseCalendarScope(
      reminder({ applicationId: 21, actionPlanId: 31 }),
      caseScope
    )).toBe(true);
    expect(reminderMatchesCaseCalendarScope(reminder(), caseScope)).toBe(true);
    expect(reminderMatchesCaseCalendarScope(reminder({ caseId: 11 }), caseScope)).toBe(false);
  });

  test('acknowledgement carries the expected application mutation scope', () => {
    const request = buildCaseCalendarAcknowledgementRequest(applicationScope);
    expect(request).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(request.body)).toEqual({
      scopeMode: 'application',
      expectedCaseId: 10,
      expectedApplicationId: 20,
    });
    expect(JSON.parse(buildCaseCalendarAcknowledgementRequest(caseScope).body)).toEqual({
      scopeMode: 'case',
      expectedCaseId: 10,
    });
  });

  test('the live widget applies the response filter and scoped acknowledgement request', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/widgets/CaseCalendarWidget.js'),
      'utf8'
    );
    expect(source).toContain(
      'payload.filter(reminder => reminderMatchesCaseCalendarScope(reminder, reminderScope))'
    );
    expect(source).toContain('buildCaseCalendarAcknowledgementRequest(reminderScope)');
    expect(source).not.toContain('/notes/${noteId}');
    expect(source).not.toContain('Failed to delete note after acknowledging reminder');

    const applicationWorkspaceSource = fs.readFileSync(
      path.join(process.cwd(), 'src/pages/applicationCaseDashboard.js'),
      'utf8'
    );
    const caseWorkspaceSource = fs.readFileSync(
      path.join(process.cwd(), 'src/pages/Caseworking/CaseWorkspacePage.jsx'),
      'utf8'
    );
    expect(applicationWorkspaceSource).toContain('workspaceMode="application"');
    expect(caseWorkspaceSource).toContain('workspaceMode="case"');
  });
});
