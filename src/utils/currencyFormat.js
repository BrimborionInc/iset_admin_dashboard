const defaultOptions = {
  locale: "en-CA",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

export const formatCurrencyDisplay = (value, options = {}) => {
  if (value === "" || value === null || typeof value === "undefined") return "";
  const opts = { ...defaultOptions, ...options };
  const num = Number(value);
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
