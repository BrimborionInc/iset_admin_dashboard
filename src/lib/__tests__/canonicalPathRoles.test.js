const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');
const roleMatrixSource = fs.readFileSync(
  path.join(process.cwd(), 'src/context/RoleMatrixContext.js'),
  'utf8'
);

const REAL_ROLES = [
  'System Administrator',
  'NWAC Administrator',
  'Regional Manager',
  'ISET Coordinator',
];

describe('canonical PATH staff roles', () => {
  test('backend role and payment allowlists contain only the four real roles', () => {
    const accessStart = serverSource.indexOf('const ACCESS_MATRIX_ROLE_ORDER');
    const accessEnd = serverSource.indexOf('const ACCESS_MATRIX_ROLE_ALIASES', accessStart);
    const accessRoles = serverSource.slice(accessStart, accessEnd);
    const paymentStart = serverSource.indexOf('const PAYMENTS_ROLE_ALLOWLIST');
    const paymentEnd = serverSource.indexOf('const PAYMENT_ADMIN_ROLE_ALLOWLIST', paymentStart);
    const paymentRoles = serverSource.slice(paymentStart, paymentEnd);
    REAL_ROLES.forEach(role => {
      expect(accessRoles).toContain(`'${role}'`);
      expect(paymentRoles).toContain(`'${role}'`);
    });
    expect(`${accessRoles}\n${paymentRoles}`).not.toMatch(/Finance (?:Approver|Reviewer|Ops)|AP\/Ops/u);
    expect(serverSource).not.toMatch(/requireFinanceRole|isFinancePaymentsRole|finance_role_required/u);
  });

  test('unknown and retired roles are dropped by backend and frontend normalizers', () => {
    expect(serverSource).toContain('return ACCESS_MATRIX_ROLE_ALIASES[normalized] || null;');
    expect(serverSource).not.toContain('Array.from(set).sort().forEach');
    expect(roleMatrixSource).toContain('return ROLE_ALIASES[normalized] || null;');
    expect(roleMatrixSource).not.toContain('ordered.push(...Array.from(remaining).sort())');
    expect(roleMatrixSource).not.toMatch(/Finance (?:Approver|Reviewer|Ops)|AP\/Ops/u);
  });

  test('payment finalization remains restricted to System and NWAC administrators', () => {
    const start = serverSource.indexOf('const PAYMENT_ADMIN_ROLE_ALLOWLIST');
    const end = serverSource.indexOf('const isPaymentAdministratorRole', start);
    const roles = serverSource.slice(start, end);
    expect(roles).toContain("'System Administrator'");
    expect(roles).toContain("'NWAC Administrator'");
    expect(roles).not.toContain("'Regional Manager'");
    expect(roles).not.toContain("'ISET Coordinator'");
    expect(serverSource).toContain("error: 'payment_finalization_not_allowed'");
  });
});
