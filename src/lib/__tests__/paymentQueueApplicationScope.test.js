const { resolvePaymentPacketApplicationScope } = require('../paymentQueueApplicationScope');

describe('payment queue application scope', () => {
  test('keeps one exact application when every packet line resolves to it', () => {
    expect(resolvePaymentPacketApplicationScope([
      { applicationId: 11, trackingId: 'APP-11' },
      { applicationId: 11, trackingId: 'APP-11' },
    ])).toEqual({ applicationId: 11, trackingId: 'APP-11', ambiguous: false });
  });

  test.each([
    [
      [{ applicationId: 11, trackingId: 'APP-11' }, { applicationId: null }],
      'one exact and one unscoped line',
    ],
    [
      [{ applicationId: 11, trackingId: 'APP-11' }, { applicationId: 22, trackingId: 'APP-22' }],
      'lines from sibling applications',
    ],
  ])('fails closed for %s (%s)', lines => {
    expect(resolvePaymentPacketApplicationScope(lines)).toEqual({
      applicationId: null,
      trackingId: null,
      ambiguous: true,
    });
  });
});
