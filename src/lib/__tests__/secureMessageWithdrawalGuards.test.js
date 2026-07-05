const fs = require('fs');
const path = require('path');

const readSource = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('secure message withdrawal safeguards', () => {
  test('admin backend has an explicit audit-preserving withdrawal path', () => {
    const source = readSource('isetadminserver.js');

    expect(source).toContain("app.post('/api/admin/messages/:id/withdraw'");
    expect(source).toContain('WITHDRAWN_SECURE_MESSAGE_BODY');
    expect(source).toContain('canWithdrawCaseSecureMessage');
    expect(source).toContain('message_attachment');
    expect(source).toContain('message_signing_request');
    expect(source).toContain("JSON_SET(payload_json, '$.message_subject'");
    expect(source).toContain('STAFF_SECURE_MESSAGE_WITHDRAWN_EVENT_TYPE');
    expect(source).toContain('original_body_sha256');
  });

  test('case-message fetch classifies master-deleted messages as deleted', () => {
    const source = readSource('isetadminserver.js');

    expect(source).toContain("CASE WHEN COALESCE(m.deleted, 0) = 1 OR mi.folder = 'deleted' THEN 1 ELSE 0 END AS deleted");
    expect(source).toContain("WHEN COALESCE(m.deleted, 0) = 1 THEN 'deleted'");
    expect(source).toContain('can_withdraw: baseCanWithdraw ? 1 : 0');
  });

  test('staff compose locks the routed recipient display and requires confirmation', () => {
    const source = readSource('src/widgets/SecureMessageComposePanel.jsx');

    expect(source).toContain('const [recipientConfirmed, setRecipientConfirmed] = useState(false)');
    expect(source).toContain('Confirm the recipient and case before sending.');
    expect(source).toContain('!recipientConfirmed');
    expect(source).toContain('readOnly');
    expect(source).toContain('I have checked the recipient and case.');
  });

  test('staff messaging UI exposes withdrawal separately from local deleted-items cleanup', () => {
    const source = readSource('src/widgets/SecureMessagingWidget.js');

    expect(source).toContain('canWithdrawMessage');
    expect(source).toContain('/withdraw');
    expect(source).toContain('Withdraw sent message');
    expect(source).toContain('Move to Deleted');
    expect(source).toContain('It does not withdraw the message for');
    expect(source).not.toContain('Delete All Permanently');
  });
});
