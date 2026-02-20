import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const MessagingContext = createContext({
  pinnedMessage: null,
  composeMode: null,
  pinMessage: () => {},
  unpinMessage: () => {},
  startNewMessage: () => {},
  startReply: () => {},
  startReplyAll: () => {},
  startForward: () => {},
  cancelCompose: () => {},
});

export const MessagingProvider = ({ children }) => {
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [composeMode, setComposeMode] = useState(null);

  const pinMessage = useCallback((message) => {
    if (!message) return;
    setPinnedMessage(message);
    setComposeMode(null);
  }, []);

  const unpinMessage = useCallback(() => {
    setPinnedMessage(null);
    setComposeMode(null);
  }, []);

  const startNewMessage = useCallback(() => {
    setPinnedMessage(null);
    setComposeMode('new');
  }, []);

  const startReply = useCallback(() => {
    if (!pinnedMessage) return;
    setComposeMode('reply');
  }, [pinnedMessage]);

  const startReplyAll = useCallback(() => {
    if (!pinnedMessage) return;
    setComposeMode('replyAll');
  }, [pinnedMessage]);

  const startForward = useCallback(() => {
    if (!pinnedMessage) return;
    setComposeMode('forward');
  }, [pinnedMessage]);

  const cancelCompose = useCallback(() => {
    setComposeMode(null);
  }, []);

  const value = useMemo(() => ({
    pinnedMessage,
    composeMode,
    pinMessage,
    unpinMessage,
    startNewMessage,
    startReply,
    startReplyAll,
    startForward,
    cancelCompose,
  }), [pinnedMessage, composeMode, pinMessage, unpinMessage, startNewMessage, startReply, startReplyAll, startForward, cancelCompose]);

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
};

export const useMessaging = () => useContext(MessagingContext);
