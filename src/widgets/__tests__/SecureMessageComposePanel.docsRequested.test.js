import { selectExactFundingActionPlans } from '../../lib/signingWorkflowAvailability';
import { buildSecureMessageScopePayload } from '../SecureMessageComposePanel';

jest.mock('@cloudscape-design/components', () => ({
  Alert: 'alert',
  Box: 'box',
  Button: 'button',
  Checkbox: 'checkbox',
  Container: 'container',
  FormField: 'form-field',
  Header: 'header',
  Input: 'input',
  Multiselect: 'multiselect',
  RadioGroup: 'radio-group',
  Select: 'select',
  SpaceBetween: 'space-between',
  Spinner: 'spinner',
  Textarea: 'textarea',
}));

describe('SecureMessageComposePanel application scope', () => {
  it('keeps a case-workspace message and its form on the exact repeat application', () => {
    expect(buildSecureMessageScopePayload({
      applicationId: 123,
      isCaseWorkspace: true,
      interventionId: 456,
      actionPlanId: 184,
    })).toEqual({
      applicationId: 123,
      interventionId: 456,
      actionPlanId: 184,
    });
  });

  it('carries a deliberately selected Action Plan without depending on workspace location', () => {
    expect(buildSecureMessageScopePayload({
      applicationId: 123,
      actionPlanId: 184,
    })).toEqual({ applicationId: 123, actionPlanId: 184 });
  });

  it('does not invent Action Plan or intervention scope for an ordinary message', () => {
    expect(buildSecureMessageScopePayload({
      applicationId: 123,
    })).toEqual({ applicationId: 123 });
  });

  it('fails closed instead of inventing application scope', () => {
    expect(buildSecureMessageScopePayload({
      applicationId: null,
      isCaseWorkspace: true,
      interventionId: null,
    })).toEqual({});
  });

  it('sends the explicit reply target using the established reply_to convention', () => {
    expect(buildSecureMessageScopePayload({
      applicationId: 124,
      replyToMessageId: 991,
    })).toEqual({
      applicationId: 124,
      reply_to: 991,
    });
  });

  it('lists only open, non-archived Action Plans owned by the exact application', () => {
    expect(selectExactFundingActionPlans([
      { id: 3, applicationId: null, title: 'Legacy plan', status: 'active' },
      { id: 184, applicationId: 123, title: 'Current plan', status: 'active' },
      { id: 185, application_id: 123, name: 'Draft plan', status: 'draft' },
      { id: 186, applicationId: 123, title: 'Closed plan', status: 'closed' },
      { id: 187, applicationId: 123, title: 'Archived plan', status: 'draft', archivedAt: '2026-08-25' },
      { id: 900, applicationId: 999, title: 'Sibling plan', status: 'active' },
    ], 123)).toEqual([
      { id: 184, label: 'Current plan', status: 'active' },
      { id: 185, label: 'Draft plan', status: 'draft' },
    ]);
  });
});
