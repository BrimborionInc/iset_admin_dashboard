import {
  buildPendingCompletionApplicationSummary,
  isPendingCompletionApplicationRow,
  resolvePendingCompletionApplicationStep,
} from '../homeQueueCompletion';

describe('homeQueueCompletion', () => {
  it('keeps approved decision-recorded applications pending completion until funding docs are done', () => {
    expect(
      isPendingCompletionApplicationRow({
        application_lifecycle_status: 'decision_recorded',
        decision_outcome: 'approved',
        approval_decision_letter_sent: 1,
      })
    ).toBe(true);
    expect(
      resolvePendingCompletionApplicationStep({
        decision_outcome: 'approved',
        approval_decision_letter_sent: 1,
      })
    ).toBe('fundingDocs');
  });

  it('keeps denied applications pending completion only until the denial letter is sent', () => {
    expect(
      isPendingCompletionApplicationRow({
        application_lifecycle_status: 'decision_recorded',
        decision_outcome: 'denied',
        denial_decision_letter_sent: 0,
      })
    ).toBe(true);
    expect(
      isPendingCompletionApplicationRow({
        application_lifecycle_status: 'decision_recorded',
        decision_outcome: 'denied',
        denial_decision_letter_sent: 1,
      })
    ).toBe(false);
  });

  it('describes denied completion work as the denial letter send only', () => {
    expect(
      buildPendingCompletionApplicationSummary({
        decision_outcome: 'denied',
        application_status: 'rejected',
      })
    ).toBe('Denied file is waiting for the denial letter before completion.');
  });
});
