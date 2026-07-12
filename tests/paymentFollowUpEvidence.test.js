const { validatePaymentFollowUpEvidence } = require('../src/lib/paymentFollowUpEvidence');

describe('payment follow-up evidence containment', () => {
  test('requires packet containment even when ordinary document access succeeds', async () => {
    const validateDocument = jest.fn(async () => null);
    const validatePacketDocument = jest.fn(async () => ({
      status: 409,
      body: { error: 'client_id_mismatch' },
    }));

    await expect(validatePaymentFollowUpEvidence({
      validateDocument,
      validatePacketDocument,
    })).resolves.toEqual({ status: 409, body: { error: 'client_id_mismatch' } });
    expect(validateDocument).toHaveBeenCalledTimes(1);
    expect(validatePacketDocument).toHaveBeenCalledTimes(1);
  });

  test('stops before packet containment when the actor cannot access the document', async () => {
    const validateDocument = jest.fn(async () => ({ status: 403, body: { error: 'forbidden' } }));
    const validatePacketDocument = jest.fn(async () => null);

    await expect(validatePaymentFollowUpEvidence({
      validateDocument,
      validatePacketDocument,
    })).resolves.toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(validatePacketDocument).not.toHaveBeenCalled();
  });

  test('accepts evidence only when both validators succeed', async () => {
    await expect(validatePaymentFollowUpEvidence({
      validateDocument: async () => null,
      validatePacketDocument: async () => null,
    })).resolves.toBeNull();
  });
});
