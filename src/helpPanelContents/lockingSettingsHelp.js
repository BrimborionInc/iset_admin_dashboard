import React from 'react';

const LockingSettingsHelp = () => (
  <div>
    <h3>Record Locking</h3>
    <p>
      The admin dashboard layers optimistic version checks with an optional pessimistic lock. Optimistic locking prevents silent overwrites. When
      pessimistic mode is enabled the API also records an owner and timeout in the database so only one editor can change a record at a time.
    </p>
    <ul>
      <li><strong>Optimistic only:</strong> rely on <code>row_version</code> checks (default, no lock table writes).</li>
      <li><strong>Optimistic + Pessimistic:</strong> require writers to acquire a lock; the UI keeps it alive with a heartbeat until the user saves/cancels.</li>
    </ul>
    <p>
      Adjust the lock timeout to control how long an inactive session may hold the record. Set a heartbeat interval if you want the UI to refresh
      the lock automatically while the editor stays open. Leave the heartbeat blank to skip auto-renewal and rely solely on the timeout.
    </p>
    <p>The settings are persisted via <code>/api/config/runtime/locking</code> and take effect immediately for new edits.</p>
  </div>
);

LockingSettingsHelp.aiContext = 'Widget help: Explains optimistic vs pessimistic locking options and how administrators can tune lock duration.';

export default LockingSettingsHelp;
