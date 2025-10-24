/**
 * ILMP participant field validation specification.
 *
 * Sourced from:
 * - docs/data/ESDC/ILMP-standard-data-file/content.extracted.txt
 * - docs/data/ESDC/ILMP-data-exchange-guide/content.extracted.txt
 *
 * The structure is intentionally data-driven so the validation helper can
 * iterate over rules without embedding business logic inline.
 */

const CANADIAN_POSTAL_CODE_PATTERN = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
const US_POSTAL_CODE_PATTERN = /^\d{5}(?:-\d{4})?$/;
const GENERIC_DIGIT_POSTAL_PATTERN = /^\d{5,9}$/;

const PROVINCE_CODES = [
  { code: 'NL', name: 'Newfoundland / Labrador' },
  { code: 'NS', name: 'Nova Scotia' },
  { code: 'NB', name: 'New Brunswick' },
  { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' },
  { code: 'ON', name: 'Ontario' },
  { code: 'MB', name: 'Manitoba' },
  { code: 'SK', name: 'Saskatchewan' },
  { code: 'AB', name: 'Alberta' },
  { code: 'BC', name: 'British Columbia' },
  { code: 'NT', name: 'Northwest Territories' },
  { code: 'YT', name: 'Yukon' },
  { code: 'NU', name: 'Nunavut' },
  { code: 'US', name: 'United States' },
  { code: 'OT', name: 'Other country' }
];

const POSTAL_PREFIX_BY_PROVINCE = {
  NL: ['A'],
  NS: ['B'],
  PE: ['C'],
  NB: ['E'],
  QC: ['G', 'H', 'J'],
  ON: ['K', 'L', 'M', 'N', 'P'],
  MB: ['R'],
  SK: ['S'],
  AB: ['T'],
  BC: ['V'],
  NT: ['X'],
  NU: ['X'],
  YT: ['Y']
  // United States / Other country are exempt from Canadian prefix constraints.
};

const ILMP_PARTICIPANT_RULES = {
  fields: {
    socialInsuranceNumber: {
      label: 'Social Insurance Number',
      required: true,
      tests: [
        {
          id: 'sin-format',
          description: 'Must contain exactly 9 digits (ILMP Data Exchange Guide, rows 94-103).',
          severity: 'error',
          validate: value => typeof value === 'string' && /^\d{9}$/.test(value)
        },
        {
          id: 'sin-not-all-zero',
          description: 'Must not contain all 0s (ILMP Data Exchange Guide, row 103).',
          severity: 'error',
          validate: value => typeof value === 'string' && value !== '000000000'
        },
        {
          id: 'sin-mod10',
          description: 'SIN Number checksum is invalid (ILMP Data Exchange Guide, row 101).',
          severity: 'error',
          validate: value => {
            if (typeof value !== 'string' || !/^\d{9}$/.test(value)) return false;
            let sum = 0;
            for (let i = 0; i < value.length; i += 1) {
              let digit = Number(value[i]);
              if (i % 2 === 1) {
                digit *= 2;
                if (digit > 9) digit -= 9;
              }
              sum += digit;
            }
            return sum % 10 === 0;
          }
        }
      ]
    },
    dateOfBirth: {
      label: 'Date of Birth',
      required: true,
      tests: [
        {
          id: 'dob-not-future',
          description: 'Must not be a future date (ILMP Data Exchange Guide, row 140).',
          severity: 'error',
          validate: value => {
            if (!value) return false;
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return false;
            const now = new Date();
            return date <= now;
          }
        },
        {
          id: 'dob-age-range',
          description: 'Participant age must be between 1 and 100 years inclusive (ILMP Data Exchange Guide, row 141).',
          severity: 'error',
          validate: value => {
            if (!value) return false;
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return false;
            const now = new Date();
            let age = now.getFullYear() - date.getFullYear();
            const m = now.getMonth() - date.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < date.getDate())) {
              age -= 1;
            }
            return age >= 1 && age <= 100;
          }
        }
      ]
    },
    gender: {
      label: 'Gender',
      required: true,
      allowedValues: [
        { code: 'male', label: 'Male' },
        { code: 'female', label: 'Female' },
        { code: 'unspecified', label: 'Unspecified' }
      ],
      description: 'Must be one of Male, Female, or Unspecified (ILMP Data Exchange Guide, rows 142-149).'
    },
    aboriginalGroup: {
      label: 'Indigenous Identity',
      required: true,
      allowedValues: [
        { code: 'registered-indian', label: 'Registered Indian' },
        { code: 'non-status-indian', label: 'Non-status Indian' },
        { code: 'metis', label: 'Métis' },
        { code: 'inuit', label: 'Inuit' }
      ],
      description: 'Based on self-identification or contribution agreement (ILMP Standard Data File, rows 27-32).'
    },
    addressStreet: {
      label: 'Postal Address - Street',
      required: true,
      tests: [
        {
          id: 'street-length',
          description: 'Must be between 2 and 150 characters or the literal "No Address" (ILMP Data Exchange Guide, row 231).',
          severity: 'error',
          validate: value => {
            if (typeof value !== 'string') return false;
            const trimmed = value.trim();
            if (trimmed.toLowerCase() === 'no address') return true;
            return trimmed.length >= 2 && trimmed.length <= 150;
          }
        }
      ],
      normalise: value => (typeof value === 'string' ? value.trim() : value)
    },
    addressCity: {
      label: 'Postal Address - City',
      required: true,
      tests: [
        {
          id: 'city-length',
          description: 'Must be between 3 and 100 characters (ILMP Data Exchange Guide, row 240).',
          severity: 'error',
          validate: value => {
            if (typeof value !== 'string') return false;
            const trimmed = value.trim();
            return trimmed.length >= 3 && trimmed.length <= 100;
          }
        }
      ],
      normalise: value => (typeof value === 'string' ? value.trim() : value)
    },
    addressProvince: {
      label: 'Postal Address - Province',
      required: true,
      allowedValues: PROVINCE_CODES,
      description: 'Province or country of residence at application (ILMP Standard Data File, rows 63-80).'
    },
    postalCode: {
      label: 'Postal Code',
      required: true,
      tests: [
        {
          id: 'postal-format',
          description: 'Must be Canadian format A1B2C3, US ZIP, 5-9 digits, or "No Postal Code" (ILMP Data Exchange Guide, rows 272-276).',
          severity: 'error',
          validate: value => {
            if (typeof value !== 'string') return false;
            const trimmed = value.trim();
            if (!trimmed) return false;
            if (trimmed.toLowerCase() === 'no postal code') return true;
            return (
              CANADIAN_POSTAL_CODE_PATTERN.test(trimmed) ||
              GENERIC_DIGIT_POSTAL_PATTERN.test(trimmed) ||
              US_POSTAL_CODE_PATTERN.test(trimmed)
            );
          }
        },
        {
          id: 'postal-prefix-against-province',
          description: 'When province is Canadian (codes 1-12,16), first letter must match province prefix (ILMP Data Exchange Guide, row 272).',
          severity: 'error',
          validate: (value, context) => {
            if (!value || typeof value !== 'string') return false;
            const trimmed = value.trim();
            if (trimmed.toLowerCase() === 'no postal code') return true;
            const province = context?.addressProvince;
            if (!province) return false;
            const prefixes = POSTAL_PREFIX_BY_PROVINCE[province];
            if (!prefixes) {
              // Non-Canadian provinces (US/Other) are exempt.
              return true;
            }
            const canonical = trimmed.toUpperCase().replace(/\s+/g, '');
            return prefixes.some(prefix => canonical.startsWith(prefix));
          }
        }
      ]
    }
  }
};

module.exports = {
  ILMP_PARTICIPANT_RULES,
  PROVINCE_CODES,
  POSTAL_PREFIX_BY_PROVINCE
};
