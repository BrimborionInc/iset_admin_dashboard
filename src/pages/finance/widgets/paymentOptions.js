export const findOptionByValue = (options, value) => {
  const match = options.find(option => option.value === value);
  if (match) return match;
  if (value === null || typeof value === "undefined" || value === "") return null;
  // Keep legacy/stored values visible even when not present in current options.
  return { value: String(value), label: String(value) };
};
