function normalized(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function dateOnly(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function selectedClientIdentityMismatches(selectedClient, applicantSeed) {
  if (!selectedClient || !applicantSeed) return [];
  const mismatches = [];
  const selectedEmail = normalized(
    selectedClient.identity_email ||
    selectedClient.applicant_account_email ||
    selectedClient.user_email
  );
  const submittedEmail = normalized(applicantSeed.email);
  if (selectedEmail && submittedEmail && selectedEmail !== submittedEmail) mismatches.push('email');

  const selectedDob = dateOnly(selectedClient.dob);
  const submittedDob = dateOnly(applicantSeed.dateOfBirth);
  if (selectedDob && submittedDob && selectedDob !== submittedDob) mismatches.push('date_of_birth');
  return mismatches;
}

function assertManualSelectedClientIdentity({ strategy, selectedClient, applicantSeed }) {
  if (strategy !== 'link_selected_client') {
    if (selectedClient) {
      const error = new Error('A selected client is only valid with the link-selected-client strategy.');
      error.code = 'manual_selected_client_strategy_mismatch';
      error.statusCode = 409;
      throw error;
    }
    return;
  }
  if (!selectedClient) {
    const error = new Error('Select a current client/account match before linking this application.');
    error.code = 'manual_selected_client_required';
    error.statusCode = 422;
    throw error;
  }
  const mismatches = selectedClientIdentityMismatches(selectedClient, applicantSeed);
  if (mismatches.length) {
    const error = new Error('The selected client no longer matches the submitted applicant identity. Search again and select the correct current record.');
    error.code = 'manual_selected_client_identity_mismatch';
    error.statusCode = 409;
    error.mismatches = mismatches;
    throw error;
  }
}

module.exports = {
  assertManualSelectedClientIdentity,
  selectedClientIdentityMismatches,
};
