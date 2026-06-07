const {
  normaliseNameValue,
  resolveApplicantDisplayName,
  resolveApplicantNameFromPayload,
  resolveApplicantSalutationName,
} = require('./applicantNameResolver');

describe('applicantNameResolver', () => {
  test('ignores generic placeholders when case context has the participant name', () => {
    const caseContext = {
      firstName: 'Claire',
      lastName: 'Morse',
      applicationAnswers: {
        'first-name': 'Claire',
        'last-name': 'Morse',
        'preferred-name': '',
      },
    };
    const caseRow = {
      applicant_name: 'Applicant',
      client_first_name: 'Claire',
      client_last_name: 'Morse',
    };

    expect(resolveApplicantDisplayName({ caseContext, caseRow })).toBe('Claire Morse');
    expect(resolveApplicantSalutationName({ caseContext, caseRow })).toBe('Claire');
  });

  test('uses preferred name for salutation but keeps full name for formal display', () => {
    const caseContext = {
      preferredName: 'CJ',
      firstName: 'Claire',
      middleNames: 'Anne',
      lastName: 'Morse',
    };

    expect(resolveApplicantDisplayName({ caseContext })).toBe('Claire Anne Morse');
    expect(resolveApplicantSalutationName({ caseContext })).toBe('CJ');
  });

  test('resolves top-level intake payload first and last name fields', () => {
    const payload = {
      'first-name': 'Claire',
      'last-name': 'Morse',
      consent: { name: 'Claire Morse' },
    };

    expect(resolveApplicantNameFromPayload(payload, null)).toBe('Claire Morse');
    expect(resolveApplicantDisplayName({ submissionPayload: payload })).toBe('Claire Morse');
    expect(resolveApplicantSalutationName({ submissionPayload: payload })).toBe('Claire');
  });

  test('uses client identity before a generic UI fallback', () => {
    expect(
      resolveApplicantDisplayName({
        client: { firstName: 'Claire', lastName: 'Morse' },
        fallback: 'Applicant',
      })
    ).toBe('Claire Morse');
    expect(normaliseNameValue('Applicant')).toBeNull();
  });

  test('uses submission summary fields when full payload is not loaded', () => {
    const caseRow = {
      applicant_name: 'Applicant',
      submission_first_name: 'Claire',
      submission_last_name: 'Morse',
    };

    expect(resolveApplicantDisplayName({ caseRow })).toBe('Claire Morse');
    expect(resolveApplicantSalutationName({ caseRow })).toBe('Claire');
  });
});
