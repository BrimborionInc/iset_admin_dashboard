// Lightweight input masking utilities for the public portal (mirrors admin side)
// Supported masks: phone-na, sin-ca, status-rn, postal-code-ca, postal-code-us, date-iso, time-hm, currency

function formatPhoneNa(digits: string) {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function formatSinCa(digits: string) {
  const d = digits.slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

function formatStatusRn(digits: string) {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  return `${d.slice(0, 3)} ${d.slice(3)}`;
}

function formatPostalCa(raw: string) {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (v.length <= 3) return v;
  return `${v.slice(0, 3)} ${v.slice(3)}`;
}

function formatPostalUs(digits: string) {
  const d = digits.slice(0, 9);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatDateIso(digits: string) {
  const d = digits.slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

function formatTimeHm(digits: string) {
  const d = digits.slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

function formatCurrency(digits: string) {
  const d = digits.replace(/^0+(?=\d)/, "").slice(0, 15);
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function cleanDigits(value: string) {
  return (value || "").replace(/\D+/g, "");
}

export function applyMask(value: string, mask: string) {
  const digits = cleanDigits(value);
  switch (mask) {
    case "phone-na":
      return formatPhoneNa(digits);
    case "sin-ca":
      return formatSinCa(digits);
    case "status-rn":
      return formatStatusRn(digits);
    case "postal-code-ca":
      return formatPostalCa(value);
    case "postal-code-us":
      return formatPostalUs(digits);
    case "date-iso":
      return formatDateIso(digits);
    case "time-hm":
      return formatTimeHm(digits);
    case "currency":
      return formatCurrency(digits);
    default:
      return value;
  }
}
