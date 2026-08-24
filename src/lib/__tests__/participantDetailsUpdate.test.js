const {
  PARTICIPANT_DETAILS_FIELDS,
  buildParticipantDetailsCaseContextPatch,
  sanitizeParticipantDetailsInput,
} = require('../participantDetailsUpdate');

describe('participantDetailsUpdate', () => {
  test('accepts only the canonical Participant Details fields', () => {
    expect(PARTICIPANT_DETAILS_FIELDS).toHaveLength(89);
    expect(() => sanitizeParticipantDetailsInput({
      postalCode: 'K1A 0B1',
      applicationId: 27,
    })).toThrow(expect.objectContaining({
      code: 'invalid_participant_details',
      field: 'applicationId',
    }));
    expect(() => sanitizeParticipantDetailsInput({
      applicationDecisionLetters: { 27: { status: 'sent' } },
    })).toThrow(expect.objectContaining({
      code: 'invalid_participant_details',
      field: 'applicationDecisionLetters',
    }));
  });

  test('validates SIN, date, and list fields at the server boundary', () => {
    expect(sanitizeParticipantDetailsInput({
      sin: '046 454 286',
      dateOfBirth: '1990-02-28',
      requestedSupports: ['transportation'],
    })).toEqual({
      sin: '046454286',
      dateOfBirth: '1990-02-28',
      requestedSupports: ['transportation'],
    });
    expect(() => sanitizeParticipantDetailsInput({ sin: '123456789' }))
      .toThrow(expect.objectContaining({ field: 'sin' }));
    expect(() => sanitizeParticipantDetailsInput({ dateOfBirth: '2026-02-29' }))
      .toThrow(expect.objectContaining({ field: 'dateOfBirth' }));
    expect(() => sanitizeParticipantDetailsInput({ employmentBarriers: 'transportation' }))
      .toThrow(expect.objectContaining({ field: 'employmentBarriers' }));
  });

  test('maps a postal correction into current-case compatibility fields only', () => {
    const normalized = sanitizeParticipantDetailsInput({
      postalCode: 'K1A 0B1',
      mailingPostal: 'K2P 1L4',
      emergencyName: 'Current contact',
    });
    const patch = buildParticipantDetailsCaseContextPatch(normalized, {
      applicationAnswers: { 'address-postcode': 'OLD' },
      applicationDecisionLetters: { 27: { status: 'sent' } },
      applicationAssessmentContexts: { 27: { assessment_nwac_review_status: 'approve' } },
    });

    expect(patch).toEqual({
      emergencyName: 'Current contact',
      address: { postalCode: 'K1A 0B1' },
      mailingAddress: { postalCode: 'K2P 1L4' },
      applicationPersonal: {
        address: { postalCode: 'K1A 0B1' },
        mailing_address: { postalCode: 'K2P 1L4' },
      },
      applicationAnswers: {
        'address-postcode': 'K1A 0B1',
        'mailing-address-postcode': 'K2P 1L4',
        'emergency-contact-name': 'Current contact',
      },
    });
    expect(patch).not.toHaveProperty('applicationDecisionLetters');
    expect(patch).not.toHaveProperty('applicationAssessmentContexts');
  });

  test('preserves legacy registration targeting and explicit list clears', () => {
    const patch = buildParticipantDetailsCaseContextPatch(
      sanitizeParticipantDetailsInput({
        registrationNumber: '',
        childcareFunding: [],
        expensesTransport: [],
      }),
      {
        applicationAnswers: {
          'metis-registration-number': 'OLD-REGISTRATION',
        },
      }
    );

    expect(patch.registrationNumber).toBeNull();
    expect(patch.childcareFunding).toBeNull();
    expect(patch.expensesTransport).toBeNull();
    expect(patch.applicationAnswers).toMatchObject({
      'registration-number': null,
      'metis-registration-number': null,
      'childcare-fuding-status': null,
      'expenses-transport': [],
    });
  });
});
