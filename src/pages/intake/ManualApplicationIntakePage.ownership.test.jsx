import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { saveSession } from '../../auth/cognito';
import { apiFetch } from '../../auth/apiClient';
import { LEGACY_MANUAL_INTAKE_DRAFT_KEY } from '../../utils/manualIntakeOwnership';
import ManualApplicationIntakePage from './ManualApplicationIntakePage';

jest.mock('@cloudscape-design/board-components/board', () => ({ items, renderItem }) => (
  <div>{items.map(item => <div key={item.id}>{renderItem(item, {})}</div>)}</div>
));

jest.mock('@cloudscape-design/board-components', () => ({
  BoardItem: ({ children, header }) => <section>{header}{children}</section>,
}));

jest.mock('../../auth/apiClient', () => ({ apiFetch: jest.fn() }));

jest.mock('@cloudscape-design/components', () => {
  const Container = ({ children }) => <div>{children}</div>;
  return {
    Alert: Container,
    Badge: Container,
    Box: Container,
    Button: ({ children, onClick, disabled }) => <button type="button" onClick={onClick} disabled={disabled}>{children}</button>,
    ButtonDropdown: () => null,
    ColumnLayout: Container,
    FormField: ({ children, label }) => <label>{label}{children}</label>,
    Header: Container,
    Input: ({ value, onChange, spellcheck: _spellcheck, ...props }) => (
      <input
        value={value || ''}
        onChange={event => onChange?.({ detail: { value: event.target.value } })}
        {...props}
      />
    ),
    Link: ({ children }) => <span>{children}</span>,
    RadioGroup: () => null,
    Select: () => null,
    SpaceBetween: Container,
    Spinner: () => <span>Loading</span>,
    StatusIndicator: Container,
    Table: ({ items, onSelectionChange }) => (
      <div>
        {(items || []).map(item => (
          <button
            type="button"
            key={item.clientId}
            onClick={() => onSelectionChange?.({ detail: { selectedItems: [item] } })}
          >
            {item.applicantName}
          </button>
        ))}
      </div>
    ),
    Textarea: ({ value, onChange, spellcheck: _spellcheck, ...props }) => (
      <textarea value={value || ''} onChange={event => onChange?.({ detail: { value: event.target.value } })} {...props} />
    ),
    Wizard: ({ activeStepIndex, steps, onNavigate }) => (
      <div>
        {steps?.[activeStepIndex]?.content}
        {(steps || []).map((step, index) => (
          <button
            type="button"
            key={step.title}
            onClick={() => onNavigate?.({ detail: { requestedStepIndex: index } })}
          >
            {`mock-step-${index}`}
          </button>
        ))}
      </div>
    ),
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <ManualApplicationIntakePage />
    </MemoryRouter>
  );
}

describe('ManualApplicationIntakePage authentication boundary', () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    apiFetch.mockReset();
  });

  test('never hydrates a prior staff session PII draft after an account transition', async () => {
    sessionStorage.setItem(LEGACY_MANUAL_INTAKE_DRAFT_KEY, JSON.stringify({
      answers: {
        'first-name': 'Staff A applicant',
        'contact-email-address': 'staff-a-applicant@example.ca',
        'social-insurance-number': '123456789',
      },
      selectedApplicantMatch: { clientId: 99, applicantName: 'Wrong client' },
    }));

    saveSession({ id_token: 'staff-b', access_token: 'access-b', refresh_token: 'refresh-b', expires_in: 3600 });
    renderPage();

    await waitFor(() => expect(sessionStorage.getItem(LEGACY_MANUAL_INTAKE_DRAFT_KEY)).toBeNull());
    expect(screen.getByLabelText('First name').value).toBe('');
    expect(screen.getByLabelText('Email address').value).toBe('');
    expect(screen.queryByText('Wrong client')).toBeNull();
    expect(screen.queryByDisplayValue('123456789')).toBeNull();
  });

  test('ignores an older search response and invalidates selection when identity changes', async () => {
    let resolveOlderSearch;
    const olderSearch = new Promise(resolve => { resolveOlderSearch = resolve; });
    apiFetch.mockImplementation(url => {
      const query = new URL(url, 'http://localhost').searchParams.get('q');
      if (query === 'older@example.ca') return olderSearch;
      if (query === 'current@example.ca') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ users: [{ clientId: 2, applicantName: 'Current Result' }] }),
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    renderPage();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Applicant' } });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@example.ca' } });
    fireEvent.click(screen.getByText('mock-step-1'));

    const queryInput = await screen.findByLabelText('Search PATH records');
    fireEvent.change(queryInput, { target: { value: 'older@example.ca' } });
    fireEvent.click(screen.getByText('Search'));
    fireEvent.change(queryInput, { target: { value: 'current@example.ca' } });
    fireEvent.click(screen.getByText('Search'));

    expect(await screen.findByText('Current Result')).not.toBeNull();
    resolveOlderSearch({
      ok: true,
      json: async () => ({ users: [{ clientId: 1, applicantName: 'Older Result' }] }),
    });
    await waitFor(() => expect(screen.queryByText('Older Result')).toBeNull());

    fireEvent.click(screen.getByText('Current Result'));
    expect(await screen.findByText(/will be used for this application/)).not.toBeNull();
    fireEvent.click(screen.getByText('mock-step-0'));
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'different@example.ca' } });
    fireEvent.click(screen.getByText('mock-step-1'));
    await waitFor(() => expect(screen.queryByText(/will be used for this application/)).toBeNull());
  });
});
