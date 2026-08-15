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
    })).toEqual({
      applicationId: 123,
      interventionId: 456,
    });
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
});
