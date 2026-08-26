import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SecureMessageComposePanel, {
  SECURE_MESSAGE_COMPOSE_OPEN_EVENT,
} from '../SecureMessageComposePanel';
import { apiFetch } from '../../auth/apiClient';

jest.mock('../../auth/apiClient', () => ({ apiFetch: jest.fn() }));

jest.mock('@cloudscape-design/components', () => {
  const React = require('react');
  const Box = ({ children }) => <div>{children}</div>;
  const Button = ({ children, onClick, disabled, ariaLabel }) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children || ariaLabel}
    </button>
  );
  const Checkbox = ({ children, checked, onChange, disabled }) => (
    <label>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange?.({ detail: { checked: event.target.checked } })}
      />
      {children}
    </label>
  );
  const Container = ({ children, header, footer }) => (
    <section>{header}{children}{footer}</section>
  );
  const FormField = ({ children, label, description, errorText }) => (
    <div><div>{label}</div><div>{description}</div>{children}<div>{errorText}</div></div>
  );
  const Header = ({ children, actions }) => <header>{children}{actions}</header>;
  const Input = ({ value, onChange, placeholder, readOnly, disabled }) => (
    <input
      value={value}
      placeholder={placeholder}
      readOnly={readOnly}
      disabled={disabled}
      onChange={event => onChange?.({ detail: { value: event.target.value } })}
    />
  );
  const Multiselect = ({ options, selectedOptions, onChange, disabled }) => (
    <select
      aria-label="forms"
      multiple
      disabled={disabled}
      value={selectedOptions.map(option => String(option.value))}
      onChange={event => {
        const values = Array.from(event.target.selectedOptions, option => option.value);
        onChange?.({
          detail: {
            selectedOptions: options.filter(option => values.includes(String(option.value))),
          },
        });
      }}
    >
      {options.map(option => (
        <option key={option.value} value={String(option.value)}>{option.label}</option>
      ))}
    </select>
  );
  const RadioGroup = () => null;
  const Select = ({ options, selectedOption, onChange, disabled }) => (
    <select
      aria-label="action-plan"
      disabled={disabled}
      value={selectedOption?.value || ''}
      onChange={event => onChange?.({
        detail: {
          selectedOption: options.find(option => String(option.value) === event.target.value) || null,
        },
      })}
    >
      <option value="">Choose an Action Plan</option>
      {options.map(option => (
        <option key={option.value} value={String(option.value)}>{option.label}</option>
      ))}
    </select>
  );
  const SpaceBetween = ({ children }) => <div>{children}</div>;
  const Spinner = () => <span>Loading</span>;
  const Textarea = ({ value, onChange, placeholder, disabled }) => (
    <textarea
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={event => onChange?.({ detail: { value: event.target.value } })}
    />
  );
  const Alert = ({ children }) => <div role="alert">{children}</div>;
  return {
    Alert,
    Box,
    Button,
    Checkbox,
    Container,
    FormField,
    Header,
    Input,
    Multiselect,
    RadioGroup,
    Select,
    SpaceBetween,
    Spinner,
    Textarea,
  };
});

const baseCaseData = {
  id: 12,
  application_id: 95,
  applicant_user_id: 7,
  applicant_name: 'Test Applicant',
  assigned_to_name: 'Test Worker',
  application_status: 'approved',
  decision_outcome: 'approved',
};

const openComposer = (overrides = {}) => {
  act(() => {
    window.dispatchEvent(new CustomEvent(SECURE_MESSAGE_COMPOSE_OPEN_EVENT, {
      detail: {
        caseId: 12,
        applicationId: 95,
        applicantUserId: 7,
        applicantName: 'Test Applicant',
        isCaseWorkspace: true,
        suggestedInterventionId: 777,
        ...overrides,
      },
    }));
  });
};

const enterMessage = () => {
  fireEvent.change(screen.getByPlaceholderText('Subject'), { target: { value: 'Test subject' } });
  fireEvent.change(screen.getByPlaceholderText('Write your message'), { target: { value: 'Test body' } });
};

describe('SecureMessageComposePanel scope interactions', () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  test('offers only active workflows with supported signing contracts', async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, name: 'Generic consent', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'generic_consent' },
        { id: 2, name: 'Draft consent', status: 'draft', workflow_type: 'consent-no-prefill', document_type: 'generic_consent' },
        { id: 3, name: 'Inactive consent', status: 'inactive', workflow_type: 'consent-cm-prefill', document_type: 'generic_consent' },
        { id: 4, name: 'Unsafe funding mode', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'funding_agreement' },
        { id: 5, name: 'Unsafe financial mode', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'financial_overview' },
        { id: 6, name: 'Unsafe attendance mode', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'attendance_form' },
        { id: 7, name: 'Funding alias', status: 'active', workflow_type: 'consent-cm-prefill', document_type: 'client_funding_agreement' },
        { id: 8, name: 'EFT alias', status: 'active', workflow_type: 'consent-cm-prefill', document_type: 'eft_or_wire_transfer_form' },
        { id: 9, name: 'Client Funding Agreement', status: 'active', workflow_type: 'consent-cm-prefill', document_type: null },
        { id: 10, name: 'Client Funding Agreement', status: 'active', workflow_type: 'consent-cm-prefill', document_type: 'funding_agreement' },
        { id: 11, name: 'Financial Overview', status: 'ACTIVE', workflow_type: 'consent-cm-prefill', document_type: 'financial_overview' },
        { id: 12, name: 'Attendance Report', status: 'active', workflow_type: 'consent-cm-prefill', document_type: 'attendance_form' },
        { id: 13, name: 'EFT form', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'eft_form' },
        { id: 14, name: 'Approval letter', status: 'active', workflow_type: 'consent-no-prefill', document_type: 'assessment_approval_letter' },
      ],
    });

    render(<SecureMessageComposePanel caseData={baseCaseData} isCaseWorkspace />);
    openComposer();

    const forms = await screen.findByLabelText('forms');
    const labels = Array.from(forms.options).map(option => option.textContent);
    expect(labels).toEqual([
      'Generic consent',
      'Client Funding Agreement',
      'Financial Overview',
      'Attendance Report',
      'EFT form',
      'Approval letter',
    ]);
  });

  test('does not silently send workspace or event scope for an ordinary message', async () => {
    apiFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true });

    render(
      <SecureMessageComposePanel
        caseData={baseCaseData}
        isCaseWorkspace
        selectedInterventionId={777}
      />
    );
    openComposer({ interventionId: 888, actionPlanId: 184 });

    await screen.findByRole('dialog', { name: 'Secure message compose window' });
    enterMessage();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    const [url, options] = apiFetch.mock.calls[1];
    expect(url).toBe('/api/cases/12/messages');
    expect(JSON.parse(options.body)).toMatchObject({ applicationId: 95 });
    expect(JSON.parse(options.body)).not.toHaveProperty('interventionId');
    expect(JSON.parse(options.body)).not.toHaveProperty('actionPlanId');
  });

  test('sends confirmed workspace intervention scope for an attendance report', async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 46,
          name: 'Client Monthly Attendance Report',
          status: 'active',
          workflow_type: 'consent-cm-prefill',
          document_type: 'attendance_form',
        }],
      })
      .mockResolvedValueOnce({ ok: true });

    render(
      <SecureMessageComposePanel
        caseData={baseCaseData}
        isCaseWorkspace
        selectedInterventionId={777}
      />
    );
    openComposer();

    const forms = await screen.findByLabelText('forms');
    expect(screen.queryByText(/Use selected intervention 777/)).toBeNull();
    fireEvent.change(forms, { target: { value: '46' } });

    const interventionConfirmation = await screen.findByRole('checkbox', {
      name: /Use selected intervention 777 for this form/,
    });
    fireEvent.click(interventionConfirmation);
    enterMessage();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    const [url, options] = apiFetch.mock.calls[1];
    expect(url).toBe('/api/cases/12/messages');
    const payload = JSON.parse(options.body);
    expect(payload).toMatchObject({
      applicationId: 95,
      interventionId: 777,
      attachments: [{ workflow_id: 46 }],
    });
    expect(payload).not.toHaveProperty('actionPlanId');
  });

  test('sends confirmed workspace intervention scope for the exact legacy EFT workflow', async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 43,
          name: 'EFT & Wire Transfer Direct Debit',
          status: 'draft',
          workflow_type: 'consent-no-prefill',
          document_type: 'EFT_form',
        }],
      })
      .mockResolvedValueOnce({ ok: true });

    render(
      <SecureMessageComposePanel
        caseData={baseCaseData}
        isCaseWorkspace
        selectedInterventionId={777}
      />
    );
    openComposer();

    const forms = await screen.findByLabelText('forms');
    fireEvent.change(forms, { target: { value: '43' } });
    const interventionConfirmation = await screen.findByRole('checkbox', {
      name: /Use selected intervention 777 for this form/,
    });
    fireEvent.click(interventionConfirmation);
    enterMessage();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(apiFetch.mock.calls[1][1].body)).toMatchObject({
      applicationId: 95,
      interventionId: 777,
      attachments: [{ workflow_id: 43 }],
    });
  });

  test('does not send suggested intervention scope for legacy EFT without confirmation', async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 43,
          name: 'EFT & Wire Transfer Direct Debit',
          status: 'draft',
          workflow_type: 'consent-no-prefill',
          document_type: 'EFT_form',
        }],
      })
      .mockResolvedValueOnce({ ok: true });

    render(
      <SecureMessageComposePanel
        caseData={baseCaseData}
        isCaseWorkspace
        selectedInterventionId={777}
      />
    );
    openComposer();

    const forms = await screen.findByLabelText('forms');
    fireEvent.change(forms, { target: { value: '43' } });
    expect(await screen.findByRole('checkbox', {
      name: /Use selected intervention 777 for this form/,
    })).toBeTruthy();
    enterMessage();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    const payload = JSON.parse(apiFetch.mock.calls[1][1].body);
    expect(payload).toMatchObject({
      applicationId: 95,
      attachments: [{ workflow_id: 43 }],
    });
    expect(payload).not.toHaveProperty('interventionId');
  });

  test('requires a visible choice when a funding agreement has multiple exact plans', async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 45,
          name: 'Client Funding Agreement',
          status: 'active',
          workflow_type: 'consent-cm-prefill',
          document_type: 'funding_agreement',
        }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          actionPlans: [
            { id: 3, applicationId: null, title: 'Historical', status: 'active' },
            { id: 184, applicationId: 95, title: 'Current active', status: 'active' },
            { id: 185, applicationId: 95, title: 'Current draft', status: 'draft' },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true });

    render(
      <SecureMessageComposePanel
        caseData={{
          ...baseCaseData,
          actionPlans: [
            { id: 3, applicationId: null, title: 'Historical', status: 'active' },
            { id: 184, applicationId: 95, title: 'Current active', status: 'active' },
            { id: 185, applicationId: 95, title: 'Current draft', status: 'draft' },
          ],
        }}
        isCaseWorkspace
        selectedInterventionId={777}
      />
    );
    openComposer();

    const forms = await screen.findByLabelText('forms');
    fireEvent.change(forms, { target: { value: '45' } });
    const planSelect = await screen.findByLabelText('action-plan');
    enterMessage();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Choose the Action Plan for this funding agreement.')).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledTimes(2);

    fireEvent.change(planSelect, { target: { value: '185' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3));
    const payload = JSON.parse(apiFetch.mock.calls[2][1].body);
    expect(payload).toMatchObject({ applicationId: 95, actionPlanId: 185 });
    expect(payload).not.toHaveProperty('interventionId');
  });

  test('sends a zero-funded approval letter without pre-emptively requiring an Action Plan', async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 47,
          name: 'Application approval letter',
          status: 'active',
          workflow_type: 'consent-no-prefill',
          document_type: 'assessment_approval_letter',
        }],
      })
      .mockResolvedValueOnce({ ok: true });

    render(<SecureMessageComposePanel
      caseData={{
        ...baseCaseData,
        actionPlans: [
          { id: 184, applicationId: 95, title: 'Current active', status: 'active' },
          { id: 185, applicationId: 95, title: 'Current draft', status: 'draft' },
        ],
      }}
      isCaseWorkspace
    />);
    openComposer();

    const forms = await screen.findByLabelText('forms');
    fireEvent.change(forms, { target: { value: '47' } });
    expect(screen.queryByLabelText('action-plan')).toBeNull();
    enterMessage();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    const payload = JSON.parse(apiFetch.mock.calls[1][1].body);
    expect(payload).toMatchObject({
      applicationId: 95,
      attachments: [{ workflow_id: 47 }],
    });
    expect(payload).not.toHaveProperty('actionPlanId');
  });

  test('shows an Action Plan selector and retries a funded approval only after the server requests it', async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 47,
          name: 'Application approval letter',
          status: 'active',
          workflow_type: 'consent-no-prefill',
          document_type: 'assessment_approval_letter',
        }],
      })
      .mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({
          error: 'cfa_action_plan_selection_required',
          message: 'Choose the intended Action Plan for this application before sending the funding agreement.',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          actionPlans: [
            { id: 184, applicationId: 95, title: 'Current active', status: 'active' },
            { id: 185, applicationId: 95, title: 'Current draft', status: 'draft' },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true });

    render(<SecureMessageComposePanel caseData={baseCaseData} isCaseWorkspace />);
    openComposer();

    const forms = await screen.findByLabelText('forms');
    fireEvent.change(forms, { target: { value: '47' } });
    expect(screen.queryByLabelText('action-plan')).toBeNull();
    enterMessage();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    const planSelect = await screen.findByLabelText('action-plan');
    const initialPayload = JSON.parse(apiFetch.mock.calls[1][1].body);
    expect(initialPayload).not.toHaveProperty('actionPlanId');

    fireEvent.change(planSelect, { target: { value: '184' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(4));
    const payload = JSON.parse(apiFetch.mock.calls[3][1].body);
    expect(payload).toMatchObject({ applicationId: 95, actionPlanId: 184 });
    expect(payload).not.toHaveProperty('interventionId');
  });

  test('does not impose approval Action Plan scope on a denial letter', async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 48,
          name: 'Application denial letter',
          status: 'active',
          workflow_type: 'consent-no-prefill',
          document_type: 'assessment_denial_letter',
        }],
      })
      .mockResolvedValueOnce({ ok: true });

    render(
      <SecureMessageComposePanel
        caseData={{ ...baseCaseData, decision_outcome: 'denied' }}
        isCaseWorkspace
      />
    );
    openComposer();

    const forms = await screen.findByLabelText('forms');
    fireEvent.change(forms, { target: { value: '48' } });
    expect(screen.queryByLabelText('action-plan')).toBeNull();
    enterMessage();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    const payload = JSON.parse(apiFetch.mock.calls[1][1].body);
    expect(payload).toMatchObject({
      applicationId: 95,
      attachments: [{ workflow_id: 48 }],
    });
    expect(payload).not.toHaveProperty('actionPlanId');
    expect(payload).not.toHaveProperty('interventionId');
  });

  test('does not treat a malformed Action Plan response as proof of no plan or retry forever', async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          id: 45,
          name: 'Client Funding Agreement',
          status: 'active',
          workflow_type: 'consent-cm-prefill',
          document_type: 'funding_agreement',
        }],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ unexpected: [] }) })
      .mockResolvedValueOnce({ ok: true });

    render(
      <SecureMessageComposePanel
        caseData={{
          ...baseCaseData,
          actionPlans: [
            { id: 3, applicationId: null, title: 'Historical', status: 'active' },
            { id: 900, applicationId: 999, title: 'Sibling', status: 'active' },
          ],
        }}
        isCaseWorkspace
      />
    );
    openComposer({ actionPlanId: 184 });

    const forms = await screen.findByLabelText('forms');
    fireEvent.change(forms, { target: { value: '45' } });
    expect(await screen.findByText(/Action Plans could not be loaded/)).toBeTruthy();

    await new Promise(resolve => setTimeout(resolve, 25));
    expect(apiFetch).toHaveBeenCalledTimes(2);

    enterMessage();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3));
    const payload = JSON.parse(apiFetch.mock.calls[2][1].body);
    expect(payload).not.toHaveProperty('actionPlanId');
  });

  test('issues only one POST when Send is activated twice before the first response', async () => {
    let resolveSend;
    const pendingSend = new Promise(resolve => {
      resolveSend = resolve;
    });
    apiFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockReturnValueOnce(pendingSend);

    render(<SecureMessageComposePanel caseData={baseCaseData} isCaseWorkspace />);
    openComposer();

    await screen.findByRole('dialog', { name: 'Secure message compose window' });
    enterMessage();
    const sendButton = screen.getByRole('button', { name: 'Send' });
    act(() => {
      sendButton.click();
      sendButton.click();
    });

    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(apiFetch.mock.calls.filter(([url]) => url === '/api/cases/12/messages')).toHaveLength(1);

    await act(async () => {
      resolveSend({ ok: true });
      await pendingSend;
    });
  });

  test('reuses one client operation ID after a lost response and rotates it after a material edit', async () => {
    apiFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockRejectedValueOnce(new Error('connection reset after commit'))
      .mockRejectedValueOnce(new Error('second response lost'))
      .mockResolvedValueOnce({ ok: true });

    render(<SecureMessageComposePanel caseData={baseCaseData} isCaseWorkspace />);
    openComposer();
    await screen.findByRole('dialog', { name: 'Secure message compose window' });
    enterMessage();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('connection reset after commit')).toBeTruthy();

    const firstPayload = JSON.parse(apiFetch.mock.calls[1][1].body);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('second response lost')).toBeTruthy();
    const retryPayload = JSON.parse(apiFetch.mock.calls[2][1].body);
    expect(retryPayload).toEqual(firstPayload);
    expect(firstPayload.clientOperationId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);

    fireEvent.change(screen.getByPlaceholderText('Write your message'), {
      target: { value: 'Changed intentional body' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(4));
    const changedAttempt = JSON.parse(apiFetch.mock.calls[3][1].body);
    expect(changedAttempt.clientOperationId).not.toBe(retryPayload.clientOperationId);
  });

  test('a confirmed send clears its operation ID so a later intentional send is fresh', async () => {
    apiFetch
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true });

    render(<SecureMessageComposePanel caseData={baseCaseData} isCaseWorkspace />);
    openComposer();
    await screen.findByRole('dialog', { name: 'Secure message compose window' });
    enterMessage();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    const firstPayload = JSON.parse(apiFetch.mock.calls[1][1].body);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Secure message compose window' })).toBeNull();
    });

    openComposer();
    enterMessage();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(4));
    const secondPayload = JSON.parse(apiFetch.mock.calls[3][1].body);
    expect(secondPayload.clientOperationId).not.toBe(firstPayload.clientOperationId);
  });
});
