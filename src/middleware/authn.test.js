const { TextDecoder, TextEncoder } = require('util');

global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

const { extractAuthFromClaims } = require('./authn');

describe('extractAuthFromClaims', () => {
  it('maps staff roles from Cognito groups', () => {
    const auth = extractAuthFromClaims({
      sub: 'staff-sub',
      email: 'staff@example.org',
      'cognito:groups': ['Regional_Manager'],
    }, 'staff');

    expect(auth.role).toBe('Regional Manager');
    expect(auth.subjectType).toBe('staff');
  });

  it('does not use legacy Cognito region claims for staff scope', () => {
    const auth = extractAuthFromClaims({
      sub: 'staff-sub',
      region_id: 9,
      'custom:region_id': '10',
      'cognito:groups': ['Regional_Manager'],
    }, 'staff');

    expect(auth.regionId).toBeNull();
  });

  it('does not use legacy Cognito user-id claims for staff identity', () => {
    const auth = extractAuthFromClaims({
      sub: 'staff-sub',
      user_id: '123',
      'custom:user_id': '456',
      'cognito:groups': ['ISET_Coordinator'],
    }, 'staff');

    expect(auth.userId).toBeNull();
  });

  it('preserves user-id claims for non-staff token contexts', () => {
    const auth = extractAuthFromClaims({
      sub: 'applicant-sub',
      'custom:user_id': '789',
    }, 'applicant');

    expect(auth.userId).toBe('789');
  });
});
