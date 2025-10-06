import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  AppLayout,
  Flashbar,
  HelpPanel,
  Box,
  Button,
  Header,
  SpaceBetween,
  Container
} from '@cloudscape-design/components';
import { ItemsPalette, BoardItem } from '@cloudscape-design/board-components';
import Avatar from "@cloudscape-design/chat-components/avatar";
import ChatBubble from "@cloudscape-design/chat-components/chat-bubble";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SideNavigation from './layouts/SideNavigation.js';
import { apiFetch } from './auth/apiClient';
import AppRoutes from './routes/AppRoutes.js'; // Ensure this matches the export in AppRoutes.js
import { helpMessages } from './utils/helpMessages.js';
import CustomSplitPanel from './layouts/CustomSplitPanel.js';
import { LocationProvider } from './context/LocationContext';
import AdminDashboardHelp from './helpPanelContents/adminDashboardHelp.js';

const MAX_HISTORY_MESSAGES = 10;
const MAX_STORED_MESSAGES = 24;

const CONTEXT_FACTS = {
  'iset-application-assessment': `
- This workspace combines widgets: Application Overview (case summary), ISET Application Form (editable intake submission), Application Assessment (funding decision workflow), Supporting Documents, Secure Messaging, Case Notes, and Application Events (timeline).
- To correct applicant data, open the ISET Application Form widget and choose **Edit**. Confirm the modal, adjust fields inline, then choose **Save**. Saving creates a new version entry that is accessible via **View versions**; the original submission stays intact.
- Editing is blocked if the case status is already Approved or Rejected. Otherwise, coordinators may update answers on the applicant's behalf when they have source evidence.
- Log the change in Case Notes and, if the applicant must be informed, send a Secure Message from the same board before leaving the page.
- After changes, refresh the Application Overview or Application Events widgets to confirm downstream automations recorded the update.
`
};

const normaliseKey = (value = '') => value
  .toLowerCase()
  .replace(/&amp;/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const buildSystemPrompt = ({ focusTitle, aiContext }) => {
  const safeContext = (aiContext || '').trim();
  const sections = [
    'You are "Admin Copilot", an embedded assistant inside the ISET Admin Dashboard powered by AWS Cloudscape.',
    `Focus area for this session: ${focusTitle || 'General admin dashboard guidance'}.`
  ];

  if (safeContext) {
    sections.push(`Key contextual hints: ${safeContext}`);
  } else {
    sections.push('No additional AI context was provided. Ask for specifics when the request is ambiguous.');
  }

  const hintCandidates = [focusTitle, safeContext]
    .filter(Boolean)
    .map(normaliseKey);
  const matchedHints = hintCandidates
    .map(key => CONTEXT_FACTS[key])
    .find(Boolean);
  if (matchedHints) {
    sections.push('', 'Workflow specifics:', matchedHints.trim());
  }

  sections.push(
    '',
    'Guidelines:',
    '1. Stay on topic—only address the admin dashboard, its workflows, or related operations.',
    '2. Ask clarifying questions when the goal or data is unclear before proposing a solution.',
    '3. Provide actionable, step-by-step guidance or concise bullet points. Reference UI labels, routes, or file names when possible.',
    '4. Format lists, tables, and code samples using GitHub-flavored Markdown.',
    '5. Keep responses focused and under roughly eight sentences unless additional depth is requested.',
    '6. Never fabricate data, credentials, or system behavior. If uncertain, say so and suggest next steps.',
    `Current date: ${new Date().toISOString().split('T')[0]}.`
  );

  return sections.join('\n');
};

const createChatMessage = (type, content) => {
  const now = new Date();
  const text = typeof content === 'string' ? content : String(content ?? '');
  return {
    id: `${type}-${now.getTime()}-${Math.random().toString(16).slice(2, 10)}`,
    type,
    text,
    timestamp: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
};

const mapChatToOpenAi = (message) => {
  const safeText = typeof message.text === 'string' ? message.text : String(message.text ?? '');
  return {
    role: message.type === 'incoming' ? 'assistant' : 'user',
    content: safeText
  };
};

const FloatingChat = React.memo(function FloatingChat({
  visible,
  aiContext,
  onClose,
  title
}) {
  const [chatMessages, setChatMessages] = useState([]);
  const [promptValue, setPromptValue] = useState('');
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef(null);
  const chatInputRef = useRef(null);

  const markdownPlugins = useMemo(() => [remarkGfm], []);
  const markdownComponents = useMemo(() => ({
    a: ({ children, ...props }) => (
      <a
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--color-text-link-default, #2563eb)' }}
      >
        {children}
      </a>
    ),
    code: ({ inline, children, ...props }) => {
      const codeContent = String(children).replace(/\n$/, '');
      if (inline) {
        return (
          <code
            {...props}
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.06)',
              padding: '0.15rem 0.35rem',
              borderRadius: '4px',
              fontSize: '0.95em',
              fontFamily: 'var(--font-family-monospace, "Source Code Pro", monospace)'
            }}
          >
            {codeContent}
          </code>
        );
      }
      return (
        <pre
          {...props}
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.08)',
            borderRadius: '10px',
            padding: '0.75rem',
            overflowX: 'auto',
            margin: '0.5rem 0',
            fontFamily: 'var(--font-family-monospace, "Source Code Pro", monospace)'
          }}
        >
          <code>{codeContent}</code>
        </pre>
      );
    },
    ul: ({ children }) => (
      <ul style={{ paddingLeft: '1.2rem', margin: '0.35rem 0 0.6rem' }}>{children}</ul>
    ),
    ol: ({ children }) => (
      <ol style={{ paddingLeft: '1.2rem', margin: '0.35rem 0 0.6rem' }}>{children}</ol>
    ),
    li: ({ children }) => (
      <li style={{ marginBottom: '0.25rem' }}>{children}</li>
    ),
    strong: ({ children }) => (
      <strong style={{ fontWeight: 600 }}>{children}</strong>
    ),
    blockquote: ({ children }) => (
      <blockquote
        style={{
          borderLeft: '4px solid rgba(15, 23, 42, 0.15)',
          margin: '0.5rem 0',
          padding: '0.25rem 0 0.25rem 0.75rem',
          color: 'var(--color-text-body-secondary, #475569)'
        }}
      >
        {children}
      </blockquote>
    )
  }), []);

  const appendMessage = useCallback((message) => {
    setChatMessages(prev => {
      const next = [...prev, message];
      return next.length > MAX_STORED_MESSAGES ? next.slice(next.length - MAX_STORED_MESSAGES) : next;
    });
  }, []);

  const handleSendMessage = useCallback(async () => {
    const trimmed = promptValue.trim();
    if (!trimmed || loading) {
      return;
    }

    const recentHistory = chatMessages.slice(-MAX_HISTORY_MESSAGES);
    const userMessage = createChatMessage('outgoing', trimmed);

    appendMessage(userMessage);
    setPromptValue('');
    setLoading(true);

    try {
      const payloadMessages = [
        { role: 'system', content: buildSystemPrompt({ focusTitle: title, aiContext }) },
        ...recentHistory.map(mapChatToOpenAi),
        { role: 'user', content: trimmed }
      ];

      const response = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistralai/mistral-7b-instruct',
          temperature: 0.4,
          messages: payloadMessages
        })
      });

      const data = await response.json();
      const messageText = response.ok
        ? data.choices?.[0]?.message?.content || 'Sorry, I didn’t understand that.'
        : data?.message || data?.details?.message || 'AI assistant is disabled or unavailable.';

      appendMessage(createChatMessage('incoming', messageText));
    } catch (error) {
      console.error('AI error:', error);
      appendMessage(createChatMessage('incoming', 'Something went wrong. Please try again later.'));
    } finally {
      setLoading(false);
    }
  }, [promptValue, loading, chatMessages, aiContext, title, appendMessage]);

  useEffect(() => {
    if (visible && chatInputRef.current) {
      const timeout = window.requestAnimationFrame(() => {
        chatInputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(timeout);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const node = chatContainerRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [chatMessages, visible]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="AI assistant chat"
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        width: 'min(420px, calc(100vw - 3rem))',
        maxWidth: '100%',
        maxHeight: 'calc(100vh - 4rem)',
        zIndex: 2000,
        pointerEvents: visible ? 'auto' : 'none',
        display: visible ? 'block' : 'none'
      }}
      aria-hidden={!visible}
    >
      <Container
        header={
          <Header
            variant="h2"
            actions={
              <Button iconName="close" variant="icon" ariaLabel="Close AI chat" onClick={onClose} />
            }
          >
            Ask the AI
          </Header>
        }
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <textarea
              ref={chatInputRef}
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask your question here..."
              rows={3}
              style={{
                flexGrow: 1,
                width: '100%',
                padding: '0.75rem',
                resize: 'vertical',
                borderRadius: '8px',
                border: '1px solid var(--color-border-input-default, #aab7b8)'
              }}
            />
            <Button
              onClick={handleSendMessage}
              variant="primary"
              disabled={loading || !promptValue.trim()}
            >
              {loading ? 'Sending…' : 'Send'}
            </Button>
          </div>
        }
        style={{
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.35)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}
      >
        <Box margin={{ bottom: 's' }}>
          <SpaceBetween size="s">
            <div
              ref={chatContainerRef}
              style={{
                height: 'min(420px, calc(100vh - 12rem))',
                overflowY: 'auto',
                paddingRight: '0.5rem'
              }}
            >
              {chatMessages.length === 0 && !loading && (
                <Box variant="p" style={{ color: 'var(--color-text-body-secondary, #4b5563)' }}>
                  Share what you’re working on or paste an error message—responses stay scoped to the current help topic.
                </Box>
              )}
              {chatMessages.map((message, index) => {
                const timeLabel = message.displayTime || message.timestamp || '';
                return (
                  <ChatBubble
                    key={message.id || `${message.timestamp}-${index}`}
                    ariaLabel={`${message.type === 'outgoing' ? 'You' : 'AI'} at ${timeLabel}`}
                    type={message.type}
                    avatar={
                      message.type === 'outgoing' ? (
                        <Avatar ariaLabel="You" tooltipText="You" initials="You" />
                      ) : (
                        <Avatar
                          color="gen-ai"
                          iconName="gen-ai"
                          ariaLabel="Generative AI assistant"
                          tooltipText="Generative AI assistant"
                        />
                      )
                    }
                  >
                    <div
                      style={{
                        display: 'block',
                        color: 'var(--color-text-body-default, #0f172a)',
                        fontSize: '0.95rem',
                        lineHeight: 1.55
                      }}
                    >
                      <ReactMarkdown
                        remarkPlugins={markdownPlugins}
                        components={markdownComponents}
                      >
                        {message.text}
                      </ReactMarkdown>
                    </div>
                  </ChatBubble>
                );
              })}
              {loading && (
                <Box variant="p" style={{ color: 'var(--color-text-body-secondary, #4b5563)' }}>
                  Generating a response...
                </Box>
              )}
            </div>
            <Box variant="p" style={{ fontSize: '0.85rem', color: 'var(--color-text-body-secondary, #4b5563)' }}>
              Tip: Shift + Enter adds a newline. Markdown works for lists and code. Responses stay focused on this help topic.
            </Box>
          </SpaceBetween>
        </Box>
      </Container>
    </div>
  );
});

const AppContent = ({ currentRole }) => {
  const [currentHelpContent, setCurrentHelpContent] = useState(helpMessages.overview);
  const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false);
  const [helpPanelTitle, setHelpPanelTitle] = useState("Help Panel");
  const [isNavigationOpen, setIsNavigationOpen] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState([{ text: 'Home', href: '/' }, { text: 'Admin Console', href: '#' }]);
  const [splitPanelOpen, setSplitPanelOpen] = useState(false); // State for SplitPanel, initially closed
  const [splitPanelSize, setSplitPanelSize] = useState(360); // State for SplitPanel size
  const [splitPanelPreferences, setSplitPanelPreferences] = useState({ position: 'side' }); // State for SplitPanel preferences
  const [availableItems, setAvailableItems] = useState([]); // State for available items (palette)
  const [toolsMode, setToolsMode] = useState('help'); // 'help' | 'palette'

  // Notifications state (moved inside component)
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await apiFetch('/api/me/notifications');
      let data = [];
      try { data = await response.json(); } catch { data = []; }
      if (!response.ok) {
        const message = Array.isArray(data) ? 'Failed to load notifications' : (data?.error || 'Failed to load notifications');
        throw new Error(message);
      }
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('[notifications] load failed', error);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const handleAuthChange = () => {
      loadNotifications();
    };
    window.addEventListener('auth:session-changed', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('auth:session-changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [loadNotifications]);

  const handleDismissNotification = useCallback(async (notificationId) => {
    try {
      const response = await apiFetch(`/api/me/notifications/${notificationId}/dismiss`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Failed to dismiss notification (${response.status})`);
      }
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('[notifications] dismiss failed', error);
    }
  }, []);

  const mapSeverityToType = useCallback((severity = 'info') => {
    const normalised = String(severity).toLowerCase();
    if (normalised === 'critical' || normalised === 'error') return 'error';
    if (normalised === 'warning' || normalised === 'warn') return 'warning';
    if (normalised === 'success') return 'success';
    return 'info';
  }, []);

  const notificationFlashbarItems = useMemo(() =>
    notifications
      .filter(n => n && n.dismissible !== false)
      .map(n => ({
        type: mapSeverityToType(n.severity),
        header: n.title || undefined,
        content: n.message,
        dismissible: true,
        onDismiss: () => handleDismissNotification(n.id),
        id: `notification-${n.id}`,
      })),
  [notifications, handleDismissNotification, mapSeverityToType]);

  const [aiContext, setAiContext] = useState(AdminDashboardHelp.aiContext || ""); // State to hold AI context

  const toggleHelpPanel = (content, title = "Help and Tutorials", context = "") => {
    setCurrentHelpContent(content);
    setHelpPanelTitle(title);
    const fallbackContext = AdminDashboardHelp.aiContext || "";
    const nextContext = typeof context === 'string' && context.trim() ? context : fallbackContext;
    setAiContext(nextContext); // Set the AI context
    setIsHelpPanelOpen(true);
  };

  const updateBreadcrumbs = useCallback((newBreadcrumbs) => {
    const breadcrumbsChanged = JSON.stringify(newBreadcrumbs) !== JSON.stringify(breadcrumbs);
    if (breadcrumbsChanged) {
      console.log('Updating breadcrumbs:', newBreadcrumbs);
      setBreadcrumbs(newBreadcrumbs);
    }
  }, [breadcrumbs]);

  const handleSplitPanelPreferencesChange = (newPreferences) => {
    setSplitPanelPreferences(newPreferences);
  };

  const handleItemSelect = (item) => {
    setAvailableItems((prevItems) => prevItems.filter((availableItem) => availableItem.id !== item.id));
  };

  const [chatVisible, setChatVisible] = useState(false);

  const openPaletteInTools = useCallback((items) => {
    try { setAvailableItems(items || []); } catch {}
    setToolsMode('palette');
    setIsHelpPanelOpen(true);
  }, []);

  // Listen for page requests to open the tools palette (avoids prop drilling)
  useEffect(() => {
    const onOpenPalette = (e) => {
      try {
        const items = (e && e.detail && e.detail.items) || [];
        setAvailableItems(items);
        setToolsMode('palette');
        setIsHelpPanelOpen(true);
      } catch {}
    };
    window.addEventListener('tools:open-palette', onOpenPalette);
    return () => window.removeEventListener('tools:open-palette', onOpenPalette);
  }, []);

  return (
    <LocationProvider>
      <FloatingChat
        visible={chatVisible}
        aiContext={aiContext}
        onClose={() => setChatVisible(false)}
        title={helpPanelTitle}
      />
      <AppLayout
        navigationOpen={isNavigationOpen}
        onNavigationChange={({ detail }) => setIsNavigationOpen(detail.open)}
        navigation={<SideNavigation currentRole={currentRole} />}
  notifications={<Flashbar stackItems items={notificationFlashbarItems} />}
        toolsOpen={isHelpPanelOpen}
        onToolsChange={({ detail }) => setIsHelpPanelOpen(detail.open)}
        tools={
          toolsMode === 'palette' ? (
            <ItemsPalette
              items={availableItems}
              i18nStrings={{ header: 'Available widgets' }}
              renderItem={item => (
                <BoardItem
                  key={item.id}
                  header={<Header>{item.data?.title || 'Widget'}</Header>}
                  i18nStrings={{
                    dragHandleAriaLabel: 'Drag handle',
                    dragHandleAriaDescription:
                      'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.',
                  }}
                >
                  <Box variant="p">{item.data?.description || ''}</Box>
                </BoardItem>
              )}
            />
          ) : (
            <HelpPanel
              header={
                <Header
                  variant="h2"
                  actions={
                    <Button
                      onClick={() => setChatVisible(!chatVisible)}
                      variant="primary"
                    >
                      {chatVisible ? "Close AI" : "Ask the AI"}
                    </Button>
                  }
                >
                  {helpPanelTitle}
                </Header>
              }
            >
              {currentHelpContent}
            </HelpPanel>
          )
        }
        splitPanelOpen={splitPanelOpen}
        onSplitPanelToggle={({ detail }) => setSplitPanelOpen(detail.open)}
        splitPanel={
          <CustomSplitPanel
            availableItems={availableItems}
            handleItemSelect={handleItemSelect}
            splitPanelSize={splitPanelSize}
            setSplitPanelSize={setSplitPanelSize}
            splitPanelOpen={splitPanelOpen}
            setSplitPanelOpen={setSplitPanelOpen}
          />
        }
        splitPanelPreferences={splitPanelPreferences}
        onSplitPanelPreferencesChange={handleSplitPanelPreferencesChange}
        content={
          <SpaceBetween size="l">
            <AppRoutes
              toggleHelpPanel={toggleHelpPanel}
              updateBreadcrumbs={updateBreadcrumbs}
              setSplitPanelOpen={setSplitPanelOpen}
              splitPanelOpen={splitPanelOpen}
              setSplitPanelSize={setSplitPanelSize}
              splitPanelSize={splitPanelSize}
              setAvailableItems={setAvailableItems}
              openPaletteInTools={openPaletteInTools}
              breadcrumbs={breadcrumbs}
              helpMessages={helpMessages}
              aiContext={AdminDashboardHelp.aiContext} // Use the static aiContext property
            />

          </SpaceBetween>
        }
      />
    </LocationProvider>
  );
};

export default AppContent;




