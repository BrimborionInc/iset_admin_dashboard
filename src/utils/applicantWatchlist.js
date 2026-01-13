const normalizeText = value => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const pickFirst = (...values) => {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return null;
};

export const cleanSin = value => {
  const text = normalizeText(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  return digits ? digits : null;
};

export const formatSinDisplay = value => {
  const digits = cleanSin(value);
  if (!digits) return null;
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
};

export const toDateOnlyString = value => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

export const buildApplicantWatchlistIdentity = ({
  caseContext,
  answers,
  payload,
  fallbackName,
  client,
}) => {
  const safeContext = caseContext && typeof caseContext === 'object' ? caseContext : {};
  const contextPersonal =
    safeContext.applicationPersonal && typeof safeContext.applicationPersonal === 'object'
      ? safeContext.applicationPersonal
      : {};
  const contextAnswers =
    safeContext.applicationAnswers && typeof safeContext.applicationAnswers === 'object'
      ? safeContext.applicationAnswers
      : {};
  const payloadPersonal = payload?.personal && typeof payload.personal === 'object' ? payload.personal : {};
  const mergedAnswers = {
    ...contextAnswers,
    ...(answers && typeof answers === 'object' ? answers : {}),
  };

  const firstName = pickFirst(
    contextPersonal.first_name,
    contextPersonal.firstName,
    contextPersonal.given_name,
    contextPersonal.givenName,
    payloadPersonal.first_name,
    payloadPersonal.firstName,
    mergedAnswers['first-name'],
    mergedAnswers['first_name'],
    mergedAnswers['given-name'],
    mergedAnswers['given_name'],
    mergedAnswers['personal-first-name'],
    mergedAnswers['personal_first_name'],
    mergedAnswers['personal-given-name'],
    mergedAnswers['personal_given_name']
  );

  const lastName = pickFirst(
    contextPersonal.last_name,
    contextPersonal.lastName,
    contextPersonal.family_name,
    contextPersonal.familyName,
    payloadPersonal.last_name,
    payloadPersonal.lastName,
    mergedAnswers['last-name'],
    mergedAnswers['last_name'],
    mergedAnswers['family-name'],
    mergedAnswers['family_name'],
    mergedAnswers['personal-last-name'],
    mergedAnswers['personal_last_name'],
    mergedAnswers['personal-family-name'],
    mergedAnswers['personal_family_name']
  );

  const preferredName = pickFirst(
    contextPersonal.preferred_name,
    contextPersonal.preferredName,
    safeContext.preferredName,
    mergedAnswers['preferred-name'],
    mergedAnswers['preferred_name'],
    mergedAnswers['preferredName']
  );

  const fullName = pickFirst(
    fallbackName,
    [firstName, lastName].filter(Boolean).join(' ') || null,
    preferredName,
    client?.name
  );

  const dob = toDateOnlyString(
    pickFirst(
      contextPersonal.date_of_birth,
      contextPersonal.dateOfBirth,
      safeContext.dateOfBirth,
      mergedAnswers['date-of-birth'],
      mergedAnswers['dob'],
      mergedAnswers['birth-date'],
      mergedAnswers['birthdate'],
      mergedAnswers['personal-date-of-birth'],
      payloadPersonal.date_of_birth,
      payloadPersonal.dateOfBirth,
      client?.dateOfBirth,
      client?.dob
    )
  );

  const sin = cleanSin(
    pickFirst(
      safeContext.sin,
      safeContext.socialInsuranceNumber,
      contextPersonal.sin,
      contextPersonal.social_insurance_number,
      contextPersonal.socialInsuranceNumber,
      mergedAnswers['social-insurance-number'],
      mergedAnswers['social_insurance_number'],
      mergedAnswers['sin-number'],
      mergedAnswers['sin_number'],
      payloadPersonal.sin,
      payloadPersonal.social_insurance_number,
      payloadPersonal.socialInsuranceNumber,
      mergedAnswers.sin,
      mergedAnswers['personal-sin'],
      mergedAnswers['personal_sin'],
      mergedAnswers['identity_sin']
    )
  );

  return {
    fullName,
    firstName,
    lastName,
    preferredName,
    dob,
    sin,
  };
};
