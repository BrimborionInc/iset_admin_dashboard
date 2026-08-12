'use strict';

test('qualification-owned frontend sentinel fails deliberately', () => {
  expect('frontend-phase').toBe('deliberate-failure');
});
