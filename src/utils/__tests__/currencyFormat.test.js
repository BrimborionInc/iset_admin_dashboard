import {
  formatCurrencyDisplay,
  hasCurrencyPrecision,
  isCurrencyAmountInRange,
  normalizeCurrencyAmount,
  parseCurrencyAmount,
} from "../currencyFormat.js";

describe("currencyFormat", () => {
  test("parses formatted dollar amounts with cents", () => {
    expect(parseCurrencyAmount("$24,606.62")).toBe(24606.62);
    expect(normalizeCurrencyAmount("$24,606.62")).toBe(24606.62);
    expect(formatCurrencyDisplay("$24,606.62")).toBe("$24,606.62");
  });

  test("accepts whole dollars and one or two decimal places", () => {
    expect(isCurrencyAmountInRange("4200")).toBe(true);
    expect(isCurrencyAmountInRange("4200.6")).toBe(true);
    expect(isCurrencyAmountInRange("4200.67")).toBe(true);
  });

  test("rejects more than two decimal places", () => {
    expect(hasCurrencyPrecision("4200.678")).toBe(false);
    expect(isCurrencyAmountInRange("4200.678")).toBe(false);
  });

  test("rejects malformed currency strings", () => {
    expect(Number.isNaN(parseCurrencyAmount("42,00.00"))).toBe(true);
    expect(isCurrencyAmountInRange("abc123")).toBe(false);
  });
});
