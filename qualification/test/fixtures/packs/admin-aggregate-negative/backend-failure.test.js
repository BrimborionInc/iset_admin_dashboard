'use strict';

test('qualification-owned backend sentinel fails deliberately', () => {
  expect('backend-phase').toBe('deliberate-failure');
});
