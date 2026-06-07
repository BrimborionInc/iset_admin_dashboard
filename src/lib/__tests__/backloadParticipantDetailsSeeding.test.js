const {
  mergeBackloadActionPlanParticipantDetails,
  mergeBackloadInterventionParticipantDetails,
} = require('../backloadParticipantDetailsSeeding');

describe('backloadParticipantDetailsSeeding', () => {
  test('seeds blank participant details from historical action-plan ILMP fields', () => {
    const { caseContext, changedFields } = mergeBackloadActionPlanParticipantDetails(
      {
        employmentBarriers: [],
        socialAssistance: '',
      },
      {
        summary: 'Complete training and return to work.',
        educationLevel: '8',
        educationProvince: '11',
        socialAssistanceRecipient: '0',
        EIClaimant: '2',
        actionPlanPreviousEmployment: '2',
        actionPlanPreviousEmploymentScheduleType: '2',
        actionPlanChildcareNeed: '1',
        actionPlanChildcareFundedCode: '5',
        BarrierToEmployment: ['7', '8', '10', '12'],
        otherBarrier: 'Needs a local training option.',
      }
    );

    expect(caseContext).toMatchObject({
      employmentGoals: 'Complete training and return to work.',
      educationLevel: 'college',
      educationProvince: 'bc',
      socialAssistance: 'no',
      eiClaimant: '2',
      employmentInsurance: 'yes',
      employmentStatus: 'employed-part-time',
      childcareNeed: 'yes',
      childcareFunding: ['no-funding-received'],
      employmentBarriers: ['education', 'funding', 'lack-of-job-opportunities', 'other'],
      otherBarrier: 'Needs a local training option.',
    });
    expect(changedFields).toEqual([
      'employmentGoals',
      'educationLevel',
      'educationProvince',
      'socialAssistance',
      'eiClaimant',
      'employmentInsurance',
      'employmentStatus',
      'childcareNeed',
      'childcareFunding',
      'employmentBarriers',
      'otherBarrier',
    ]);
  });

  test('does not overwrite staff-entered participant detail values', () => {
    const { caseContext, changedFields } = mergeBackloadActionPlanParticipantDetails(
      {
        employmentGoals: 'Staff-entered goal',
        employmentBarriers: ['funding'],
        otherBarrier: 'Staff note',
        socialAssistance: 'yes',
        childcareFunding: ['fnicci'],
      },
      {
        summary: 'Plan notes',
        socialAssistanceRecipient: '0',
        actionPlanChildcareNeed: '1',
        actionPlanChildcareFundedCode: '5',
        BarrierToEmployment: ['12'],
        otherBarrier: 'Imported note',
      }
    );

    expect(caseContext).toMatchObject({
      employmentGoals: 'Staff-entered goal',
      employmentBarriers: ['funding'],
      otherBarrier: 'Staff note',
      socialAssistance: 'yes',
      childcareFunding: ['fnicci'],
      childcareNeed: 'yes',
    });
    expect(changedFields).toEqual(['childcareNeed']);
  });

  test('converts legacy numeric participant-detail codes to widget values', () => {
    const { caseContext, changedFields } = mergeBackloadActionPlanParticipantDetails(
      {
        educationLevel: '8',
        educationProvince: '11',
        childcareFunding: '5',
        employmentBarriers: ['7', '12'],
      },
      {
        educationLevel: '8',
        educationProvince: '11',
        actionPlanChildcareFundedCode: '5',
        BarrierToEmployment: ['7', '12'],
      }
    );

    expect(caseContext.educationLevel).toBe('college');
    expect(caseContext.educationProvince).toBe('bc');
    expect(caseContext.childcareFunding).toEqual(['no-funding-received']);
    expect(caseContext.employmentBarriers).toEqual(['education', 'other']);
    expect(changedFields).toEqual([
      'educationLevel',
      'educationProvince',
      'childcareFunding',
      'employmentBarriers',
    ]);
  });

  test('seeds program NOC from historical intervention without touching existing values', () => {
    expect(
      mergeBackloadInterventionParticipantDetails({}, { noc: '42201', nocVersion: '2021' }).caseContext
    ).toMatchObject({
      programNoc: '42201',
      programNocVersion: '2021',
    });

    expect(
      mergeBackloadInterventionParticipantDetails(
        { programNoc: '33109', programNocVersion: '2021' },
        { noc: '42201', nocVersion: '2021' }
      ).changedFields
    ).toEqual([]);
  });
});
