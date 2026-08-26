import { beginRetainedSecureMessageSendAttempt } from '../../pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx';

jest.mock('@cloudscape-design/board-components', () => ({
  BoardItem: () => null,
}));
jest.mock('@cloudscape-design/components', () => ({}));

describe('intervention decision-letter retained send attempt', () => {
  test('same-tick double activation posts once and a later retry reuses the exact operation payload', async () => {
    const inFlightRef = { current: false };
    const attemptRef = { current: null };
    let nextOperation = 1;
    let rejectFirstPost;
    const pendingFirstPost = new Promise((resolve, reject) => {
      rejectFirstPost = reject;
    });
    const postPayload = jest
      .fn()
      .mockReturnValueOnce(pendingFirstPost)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    const invokeSend = async fingerprint => {
      const sendAttempt = beginRetainedSecureMessageSendAttempt({
        inFlightRef,
        attemptRef,
        fingerprint,
        createPayload: () => ({
          clientOperationId: `intervention-operation-${nextOperation++}`,
          body: fingerprint,
        }),
      });
      if (!sendAttempt) return { ok: false, reason: 'in_flight' };
      try {
        const response = await postPayload(sendAttempt.payload);
        sendAttempt.finish({ committed: true });
        return response;
      } catch (error) {
        return { ok: false, error };
      } finally {
        sendAttempt.finish();
      }
    };

    const firstSend = invokeSend('unchanged approval intent');
    const duplicateSend = await invokeSend('unchanged approval intent');

    expect(duplicateSend).toEqual({ ok: false, reason: 'in_flight' });
    expect(postPayload).toHaveBeenCalledTimes(1);
    const originalPayload = postPayload.mock.calls[0][0];

    rejectFirstPost(new Error('response lost after commit'));
    await expect(firstSend).resolves.toMatchObject({ ok: false });

    await expect(invokeSend('unchanged approval intent')).resolves.toEqual({ ok: true });
    expect(postPayload).toHaveBeenCalledTimes(2);
    expect(postPayload.mock.calls[1][0]).toEqual(originalPayload);

    await expect(invokeSend('unchanged approval intent')).resolves.toEqual({ ok: true });
    expect(postPayload).toHaveBeenCalledTimes(3);
    expect(postPayload.mock.calls[2][0].clientOperationId)
      .not.toBe(originalPayload.clientOperationId);
  });
});
