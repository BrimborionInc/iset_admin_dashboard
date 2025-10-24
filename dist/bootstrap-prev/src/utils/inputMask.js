// Lightweight input masking utilities (advisory formatting; value normalization on submit)
// Supported masks: phone-na, sin-ca, postal-code-ca, postal-code-us, date-iso, time-hm, currency
// Usage: attachMask(element, maskType)

function formatPhoneNa(digits) {
  // Keep up to 10 digits
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}

function formatSinCa(digits) {
  const d = digits.slice(0,9);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)} ${d.slice(3)}`;
  return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6)}`;
}

function formatPostalCa(raw) {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
  // Pattern A1A1A1 -> insert space after 3 chars for readability when length >3
  if (v.length <=3) return v;
  return v.slice(0,3) + ' ' + v.slice(3);
}

function formatPostalUs(digits) {
  const d = digits.slice(0,9);
  if (d.length <=5) return d;
  return d.slice(0,5) + '-' + d.slice(5);
}

function formatDateIso(digits) { // YYYYMMDD -> YYYY-MM-DD
  const d = digits.slice(0,8);
  if (d.length <=4) return d;
  if (d.length <=6) return d.slice(0,4) + '-' + d.slice(4);
  return d.slice(0,4) + '-' + d.slice(4,6) + '-' + d.slice(6);
}

function formatTimeHm(digits) { // HHMM -> HH:MM (24h partial tolerant)
  const d = digits.slice(0,4);
  if (d.length <=2) return d;
  return d.slice(0,2) + ':' + d.slice(2);
}

function formatCurrency(digits) { // just group with commas, no decimals; up to 15 digits
  const d = digits.replace(/^0+(?=\d)/,'').slice(0,15);
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}


function cleanDigits(value) { return (value || '').replace(/\D+/g,''); }

export function applyMask(value, mask, opts={}) {
  const digits = cleanDigits(value);
  switch(mask) {
    case 'phone-na': return formatPhoneNa(digits);
    case 'sin-ca': return formatSinCa(digits);
    case 'postal-code-ca': return formatPostalCa(value);
    case 'postal-code-us': return formatPostalUs(digits);
    case 'date-iso': return formatDateIso(digits);
    case 'time-hm': return formatTimeHm(digits);
    case 'currency': return formatCurrency(digits);
    default: return value;
  }
}

export function normalizeMasked(value, mask) {
  switch(mask) {
    case 'phone-na':
    case 'sin-ca':
    case 'postal-code-us':
    case 'date-iso':
    case 'time-hm':
    case 'currency':
      return cleanDigits(value);
    case 'postal-code-ca':
      return value.replace(/\s+/g,'').toUpperCase();
    default:
      return value;
  }
}

export function attachMask(el, mask) {
  if (!el || !mask) return;
  const handler = () => {
    const caretEnd = el.selectionEnd;
    const before = el.value;
  el.value = applyMask(el.value, mask);
    // Basic caret preservation: move to end if formatting changed length before caret unpredictably
    if (document.activeElement === el) {
      const delta = el.value.length - before.length;
      el.setSelectionRange(Math.max(0, caretEnd + delta), Math.max(0, caretEnd + delta));
    }
  };
  el.addEventListener('input', handler);
  // Store cleanup for potential future use
  el._maskCleanup = () => el.removeEventListener('input', handler);
}

export default { applyMask, normalizeMasked, attachMask };
