import React, { useCallback, useEffect, useMemo } from 'react';
import { Button, Container, Header } from '@cloudscape-design/components';
import { useMessaging } from './MessagingContext';
import PinnedMessagePanel from './PinnedMessagePanel';

const FloatingMessageWindow = ({ chatVisible = false }) => {
  const { pinnedMessage, composeMode, unpinMessage } = useMessaging();

  const visible = Boolean(pinnedMessage || composeMode);

  const title = useMemo(() => {
    if (composeMode === 'reply') return 'Reply';
    if (composeMode === 'new') return 'New message';
    if (pinnedMessage) return 'Pinned message';
    return 'Messages';
  }, [composeMode, pinnedMessage]);

  const handleClose = useCallback(() => {
    unpinMessage();
  }, [unpinMessage]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose, visible]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Secure message window"
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: chatVisible ? 'calc(2rem + 440px)' : '2rem',
        width: 'min(520px, calc(100vw - 3rem))',
        maxWidth: '100%',
        maxHeight: 'calc(100vh - 4rem)',
        zIndex: 1950,
        pointerEvents: visible ? 'auto' : 'none',
        display: visible ? 'block' : 'none',
      }}
      aria-hidden={!visible}
    >
      <Container
        header={(
          <Header
            variant="h2"
            actions={(
              <Button
                iconName="close"
                variant="icon"
                ariaLabel="Close message window"
                onClick={handleClose}
              />
            )}
          >
            {title}
          </Header>
        )}
        style={{
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.35)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            maxHeight: 'min(520px, calc(100vh - 12rem))',
            overflowY: 'auto',
            paddingRight: '0.5rem',
          }}
        >
          <PinnedMessagePanel />
        </div>
      </Container>
    </div>
  );
};

export default FloatingMessageWindow;

