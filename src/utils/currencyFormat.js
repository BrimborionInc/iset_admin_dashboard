const defaultOptions = {
  locale: "en-CA",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

const normalizeCurrencyInput = value => {
  if (value === null || typeof value === "undefined" || value === "") {
    return { empty: true, valid: true, normalized: "", fractionDigits: 0 };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { empty: false, valid: false, normalized: "", fractionDigits: 0 };
    }
    const normalized = String(value);
    const fractionDigits = normalized.includes(".") ? normalized.split(".")[1].length : 0;
    return { empty: false, valid: true, normalized, fractionDigits };
  }

  const compact = String(value)
    .trim()
    .replace(/[$]/g, "")
    .replace(/\s+/g, "");
  if (!compact) {
    return { empty: true, valid: true, normalized: "", fractionDigits: 0 };
  }
  const currencyPattern = /^[+-]?(?:(?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d*)?|\.\d+)$/;
  if (!currencyPattern.test(compact)) {
    return { empty: false, valid: false, normalized: "", fractionDigits: 0 };
  }
  const normalized = compact.replace(/,/g, "");
  const fractionDigits = normalized.includes(".") ? normalized.split(".")[1].length : 0;
  return { empty: false, valid: true, normalized, fractionDigits };
};

export const parseCurrencyAmount = value => {
  const normalized = normalizeCurrencyInput(value);
  if (normalized.empty) return null;
  if (!normalized.valid) return NaN;
  const numeric = Number(normalized.normalized);
  return Number.isFinite(numeric) ? numeric : NaN;
};

export const hasCurrencyPrecision = (value, maxFractionDigits = 2) => {
  const normalized = normalizeCurrencyInput(value);
  if (normalized.empty) return true;
  return normalized.valid && normalized.fractionDigits <= maxFractionDigits;
};

export const normalizeCurrencyAmount = value => {
  const numeric = parseCurrencyAmount(value);
  if (numeric === null) return null;
  if (!Number.isFinite(numeric)) return NaN;
  return Number(numeric.toFixed(2));
};

export const isCurrencyAmountInRange = (value, { min = 0, max = 999999, maxFractionDigits = 2 } = {}) => {
  const numeric = parseCurrencyAmount(value);
  if (numeric === null) return true;
  if (!Number.isFinite(numeric) || !hasCurrencyPrecision(value, maxFractionDigits)) return false;
  if (min !== null && numeric < min) return false;
  if (max !== null && numeric > max) return false;
  return true;
};

export const formatCurrencyDisplay = (value, options = {}) => {
  if (value === "" || value === null || typeof value === "undefined") return "";
  const opts = { ...defaultOptions, ...options };
  const num = parseCurrencyAmount(value);
  if (!Number.isFinite(num)) return String(value);
  try {
    return new Intl.NumberFormat(opts.locale, {
      style: "currency",
      currency: opts.currency,
      minimumFractionDigits: opts.minimumFractionDigits,
      maximumFractionDigits: opts.maximumFractionDigits,
    }).format(num);
  } catch (err) {
    const decimals =
      typeof opts.maximumFractionDigits === "number" && Number.isFinite(opts.maximumFractionDigits)
        ? opts.maximumFractionDigits
        : 2;
    return `$${num.toFixed(decimals)}`;
  }
};

export const getCurrencyInputDisplayValue = (value, isEditing, options = {}) =>
  isEditing ? value ?? "" : formatCurrencyDisplay(value, options);

export default formatCurrencyDisplay;
