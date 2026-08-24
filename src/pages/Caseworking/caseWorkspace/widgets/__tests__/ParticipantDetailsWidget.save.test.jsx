import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ParticipantDetailsWidget from '../ParticipantDetailsWidget.jsx';

jest.mock('@cloudscape-design/board-components', () => {
  const ReactForMock = require('react');
  return {
    BoardItem: ({ children, header }) => ReactForMock.createElement('div', null, header, children),
  };
});

jest.mock('@cloudscape-design/components', () => {
  const ReactForMock = require('react');
  const Container = ({ children }) => ReactForMock.createElement('div', null, children);
  const Input = ({ value, onChange, readOnly, disabled, placeholder }) => ReactForMock.createElement('input', {
    value: value || '',
    readOnly,
    disabled,
    placeholder,
    onChange: event => onChange?.({ detail: { value: event.target.value } }),
  });
  return {
    Alert: Container,
    Autosuggest: Input,
    Badge: Container,
    Box: Container,
    Button: ({ children, onClick, disabled }) => ReactForMock.createElement(
      'button',
      { type: 'button', onClick, disabled },
      children
    ),
    ButtonDropdown: () => null,
    ColumnLayout: Container,
    CopyToClipboard: () => null,
    DatePicker: Input,
    ExpandableSection: Container,
    FormField: ({ children, label }) => ReactForMock.createElement('label', null, label, children),
    Header: ({ children, actions }) => ReactForMock.createElement('div', null, children, actions),
    Hotspot: Container,
    Input,
    Link: ({ children }) => ReactForMock.createElement('span', null, children),
    Multiselect: () => null,
    Select: () => null,
    SpaceBetween: Container,
    Table: Container,
    Tabs: ({ tabs = [] }) => ReactForMock.createElement('div', null, tabs[0]?.content || null),
    Textarea: ({ value, onChange }) => ReactForMock.createElement('textarea', {
      value: value || '',
      onChange: event => onChange?.({ detail: { value: event.target.value } }),
    }),
  };
});

const mockSaveParticipantDetails = jest.fn();
const mockWorkspace = {
  caseData: {
    caseContext: {
      address: { postalCode: 'OLD' },
      sin: 'legacy-invalid-sin',
      dateOfBirth: 'legacy-date-format',
      applicationAnswers: { 'address-postcode': 'OLD' },
      applicationDecisionLetters: { 27: { status: 'sent' } },
      applicationAssessmentContexts: {
        27: { assessment_nwac_review_status: 'approve' },
      },
    },
  },
  saveParticipantDetails: mockSaveParticipantDetails,
  searchNocCodes: jest.fn().mockResolvedValue([]),
};

jest.mock('../../CaseWorkspaceContext.jsx', () => ({
  useCaseWorkspace: () => mockWorkspace,
}));

describe('ParticipantDetailsWidget save boundary', () => {
  beforeEach(() => {
    mockSaveParticipantDetails.mockReset();
    mockSaveParticipantDetails.mockResolvedValue({
      ...mockWorkspace.caseData.caseContext,
      address: { postalCode: 'K1A 0B1' },
    });
  });

  test('sends only the changed participant field without application-owned or unrelated legacy context', async () => {
    render(<ParticipantDetailsWidget />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const postalInput = screen.getByLabelText('Postal code');
    fireEvent.change(postalInput, { target: { value: 'K1A 0B1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockSaveParticipantDetails).toHaveBeenCalledTimes(1));
    const [participantDetails] = mockSaveParticipantDetails.mock.calls[0];
    expect(participantDetails).toEqual({ postalCode: 'K1A 0B1' });
  });

  test('does not call the server when no participant field changed', async () => {
    render(<ParticipantDetailsWidget />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockSaveParticipantDetails).not.toHaveBeenCalled();
    expect(screen.getByText('No participant detail changes to save.')).toBeTruthy();
  });
});
