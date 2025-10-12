import React, { useState, useEffect } from 'react';
import { Header, ButtonDropdown, Link, Button, SpaceBetween, Alert, Box, KeyValuePairs } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import SessionInfoHelp from '../helpPanelContents/SessionInfoHelp';

const SessionInfoWidget = ({ toggleHelpPanel, activeUserId }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activeUserId) return;

    const fetchSession = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/counter-session/active?userId=${activeUserId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch session info');
        }
        const data = await response.json();
        setSession(data);
      } catch (err) {
        setError('Error loading session info');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [activeUserId]);

  const handleSignOut = async () => {
    if (!session?.counterId) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/counter-session/${session.counterId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to sign out');
      }

      setSession(null);
    } catch (err) {
      setError('Error signing out');
    }
  };

  return (
    <BoardItem
      header={
        <Header
          description="View details about the current session."
          actions={
            <Button
              variant="primary"
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          }
          info={
            <Link
              variant="info"
              onFollow={() => toggleHelpPanel(<SessionInfoHelp />, "Session Info Help")}
            >
              Info
            </Link>
          }
        >
          (Demo) Session Info
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
        />
      }
    >
      <SpaceBetween size="m">
        {loading && <Box>Loading session info…</Box>}
        {error && <Alert type="error" dismissible onDismiss={() => setError(null)}>{error}</Alert>}
        {!loading && !error && (
          session ? (
            <KeyValuePairs
              columns={2}
              items={[
                { label: 'User ID', value: activeUserId },
                { label: 'Counter Name', value: session.counterName },
                { label: 'Login Time', value: new Date(session.loginTime).toLocaleString() },
              ]}
            />
          ) : (
            <Box>No active session</Box>
          )
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default SessionInfoWidget;
