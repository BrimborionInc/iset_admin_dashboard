async function validatePaymentFollowUpEvidence({
  validateDocument,
  validatePacketDocument,
} = {}) {
  if (typeof validateDocument !== 'function' || typeof validatePacketDocument !== 'function') {
    throw new TypeError('payment follow-up evidence validators are required');
  }
  const documentAccessError = await validateDocument();
  if (documentAccessError) return documentAccessError;
  return (await validatePacketDocument()) || null;
}

module.exports = { validatePaymentFollowUpEvidence };
