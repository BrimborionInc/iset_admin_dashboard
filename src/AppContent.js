import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  AppLayout,
  Flashbar,
  HelpPanel,
  Box,
  Button,
  Modal,
  Header,
  SpaceBetween,
  Container,
  AnnotationContext
} from '@cloudscape-design/components';
import Link from '@cloudscape-design/components/link';
import Avatar from "@cloudscape-design/chat-components/avatar";
import ChatBubble from "@cloudscape-design/chat-components/chat-bubble";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SideNavigation from './layouts/SideNavigation.js';
import { apiFetch } from './auth/apiClient';
import AppRoutes from './routes/AppRoutes.js'; // Ensure this matches the export in AppRoutes.js
import { helpMessages } from './utils/helpMessages.js';
import CustomSplitPanel from './layouts/CustomSplitPanel.js';
import { useAuth } from './context/AuthContext.js';
import { LocationProvider } from './context/LocationContext';
import { TutorialsContext } from './context/TutorialsContext';
import AdminDashboardHelp from './helpPanelContents/adminDashboardHelp.js';
	import AdminConsoleIntroHelp from './helpPanelContents/adminConsoleIntroHelp.js';
	import IsetCoordinatorIntroTourHelp from './helpPanelContents/isetCoordinatorIntroTourHelp.js';
	import ApplicationCaseDashboardHelp from './helpPanelContents/applicationCaseDashboardHelp.js';
	import ApplicationAssessmentHelp, { NwacAssessmentHelp } from './helpPanelContents/applicationAssessmentHelp.js';
	import CaseWorkspaceHelp from './helpPanelContents/caseWorkspaceHelp.js';
	import { MessagingProvider } from './pages/messages/MessagingContext.js';
	import FloatingMessageWindow from './pages/messages/FloatingMessageWindow.jsx';
	import { buildApplicationWorkspaceTutorials, APPLICATION_WORKSPACE_TUTORIAL_ID } from './tutorials/applicationWorkspaceTutorials';
	import { buildCaseWorkspaceTutorials, CASE_WORKSPACE_TUTORIAL_ID } from './tutorials/caseWorkspaceTutorials';
	import {
	  buildIsetCoordinatorIntroTutorials,
	} from './tutorials/isetCoordinatorIntroTutorials';
	import { buildNwacAssessmentTutorials, NWAC_ASSESSMENT_TUTORIAL_ID } from './tutorials/nwacAssessmentTutorials';
	import { getHomeIntroTutorialIdForRole, isHomeIntroTutorial } from './tutorials/tutorialPlatform';
	import { annotationContextI18nStrings } from './tutorials/tutorialI18n';
	import { useHistory, useLocation } from 'react-router-dom';

const MAX_HISTORY_MESSAGES = 10;
const MAX_STORED_MESSAGES = 24;
const MAX_PROMPT_CHARS = 1000;
const TUTORIAL_COMPLETION_STORAGE_KEY = 'iset-tutorials.completed.v1';
const TUTORIAL_APP_LAYOUT_RESET_FLAG = 'iset.tutorial.resetApplicationLayout';
const TUTORIAL_CASE_LAYOUT_RESET_FLAG = 'iset.tutorial.resetCaseWorkspaceLayout';
const normalizeRoleKey = value => String(value ?? '').trim().toLowerCase();
const APPLICATION_WORKSPACE_PROMPT_ROLE_KEYS = new Set([
  'iset coordinator',
  'iset coordinator',
  'nwac administrator',
  'program admin',
  'nwac administrator',
  'regional manager',
  'regional manager'
]);
const NWAC_DECISION_PROMPT_ROLE_KEYS = new Set([
  'nwac administrator',
  'program admin',
  'nwac administrator',
  'system administrator'
]);

const CONTEXT_FACTS = {
  'iset-application-assessment': `
- This workspace combines widgets: Application Overview (case summary), ISET Application Form (editable intake submission), Application Assessment (funding decision workflow), Supporting Documents, Secure Messaging, Case Notes, and Application Events (timeline).
- To correct applicant data, open the ISET Application Form widget and choose **Edit**. Confirm the modal, adjust fields inline, then choose **Save**. Saving creates a new version entry that is accessible via **View versions**; the original submission stays intact.
- Editing is blocked if the case status is already Approved or Not Approved, except for reporting-only eligibility denials that remain editable for ILMP corrections. Otherwise, coordinators may update answers on the applicant's behalf when they have source evidence.
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

const loadTutorialCompletionMapFromLocalStorage = () => {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage?.getItem(TUTORIAL_COMPLETION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.reduce((acc, entry) => {
        if (typeof entry === 'string' && entry.trim()) {
          acc[entry] = true;
        }
        return acc;
      }, {});
    }
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (_) {
    return {};
  }
  return {};
};

const clearTutorialCompletionMapInLocalStorage = () => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage?.removeItem(TUTORIAL_COMPLETION_STORAGE_KEY);
  } catch (_) {
    // Ignore persistence failures (private mode, quota, etc.)
  }
};

const getTutorialId = (tutorial) => {
  if (!tutorial) return '';
  if (typeof tutorial.tutorialId === 'string' && tutorial.tutorialId.trim()) {
    return tutorial.tutorialId.trim();
  }
  if (typeof tutorial.title === 'string' && tutorial.title.trim()) {
    return tutorial.title.trim();
  }
  return '';
};

const cloneTutorialForRun = (tutorial) => {
  if (!tutorial || typeof tutorial !== 'object') return null;
  return {
    ...tutorial,
    completed: false,
    tasks: (tutorial.tasks || []).map((task) => ({
      ...task,
      steps: (task.steps || []).map((step) => ({ ...step }))
    }))
  };
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

const sanitizeAssistantText = (rawText) => {
  if (typeof rawText !== 'string') {
    return '';
  }

  return rawText
    .replace(/<\/?s>/gi, '')
    .replace(/\[\/?(?:out|in|sys|inst)\]/gi, '')
    .replace(/^\s*::(?:out|in):/i, '')
    .trim();
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
  const [inputFocused, setInputFocused] = useState(false);
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

      appendMessage(createChatMessage('incoming', sanitizeAssistantText(messageText)));
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

  const sendDisabled = loading || !promptValue.trim();

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
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSendMessage();
            }}
            style={{ width: '100%' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '0.5rem',
                backgroundColor: 'var(--color-background-input-default, #ffffff)',
                border: '1px solid var(--color-border-input-default, #aab7b8)',
                borderRadius: '999px',
                padding: '0.35rem 0.75rem',
                transition: 'box-shadow 120ms ease, border-color 120ms ease',
                boxShadow: inputFocused ? '0 0 0 2px rgba(9, 114, 211, 0.35)' : 'none'
              }}
            >
              <textarea
                ref={chatInputRef}
                value={promptValue}
                maxLength={MAX_PROMPT_CHARS}
                onChange={(event) => setPromptValue(event.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask me anything about this page..."
                rows={1}
                style={{
                  flexGrow: 1,
                  resize: 'vertical',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--color-text-body-default, #0f172a)',
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                  padding: '0.35rem 0',
                  minHeight: '2.5rem',
                  maxHeight: '8rem',
                  width: '100%'
                }}
              />
              <Button
                type="submit"
                variant="icon"
                iconName="send"
                loading={loading}
                disabled={sendDisabled}
                ariaLabel="Send message"
                style={{
                  backgroundColor: sendDisabled ? 'var(--color-background-button-icon-disabled, #f2f3f3)' : 'var(--color-background-button-primary-default, #0972d3)',
                  color: sendDisabled ? 'var(--color-text-button-icon-disabled, #aab7b8)' : '#ffffff',
                  borderRadius: '999px',
                  width: '2.75rem',
                  height: '2.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              />
            </div>
            <div
              style={{
                marginTop: '0.25rem',
                fontSize: '0.75rem',
                color: 'var(--color-text-body-secondary, #6b7280)',
                textAlign: 'right'
              }}
            >
              Max {MAX_PROMPT_CHARS.toLocaleString()} characters
            </div>
          </form>
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
                        <Avatar
                          ariaLabel="You"
                          tooltipText="You"
                          iconName="user-profile"
                          color="default"
                        />
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

const AppContent = () => {
  const { role } = useAuth();
  const [currentHelpContent, setCurrentHelpContent] = useState(helpMessages.overview);
  const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false);
  const [helpPanelTitle, setHelpPanelTitle] = useState("Help Panel");
  const [isNavigationOpen, setIsNavigationOpen] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState([{ text: 'Home', href: '/' }, { text: 'Admin Console', href: '#' }]);
  const [splitPanelOpen, setSplitPanelOpen] = useState(false); // State for SplitPanel, initially closed
  const [splitPanelSize, setSplitPanelSize] = useState(360); // State for SplitPanel size
  const [splitPanelPreferences, setSplitPanelPreferences] = useState({ position: 'side' }); // State for SplitPanel preferences
	const [availableItems, setAvailableItems] = useState([]); // State for available items (palette)
	const location = useLocation();
	const history = useHistory();
	const [tutorialStatusMap, setTutorialStatusMap] = useState({});
  const [tutorialProgressLoading, setTutorialProgressLoading] = useState(true);
  const migrateTutorialProgressRef = useRef(false);
  const [currentTutorial, setCurrentTutorial] = useState(null);
  const currentTutorialRef = useRef(null);
	  const [introPromptVisible, setIntroPromptVisible] = useState(false);
	  const introPromptShownRef = useRef(false);
	  const [pageTutorialPrompt, setPageTutorialPrompt] = useState({ visible: false, tutorialId: null });
	  const pageTutorialPromptShownRef = useRef(new Set());

  const effectiveRole = role || '';
  const normalizedEffectiveRole = useMemo(
    () => normalizeRoleKey(effectiveRole),
    [effectiveRole]
  );

  const homeIntroTutorialId = useMemo(
    () => getHomeIntroTutorialIdForRole(effectiveRole),
    [effectiveRole]
  );

  const completedTutorials = useMemo(() => {
    const next = {};
    Object.entries(tutorialStatusMap || {}).forEach(([tutorialId, status]) => {
      if (status === 'completed') {
        next[tutorialId] = true;
      }
    });
    return next;
  }, [tutorialStatusMap]);

  const tutorials = useMemo(
    () => [
      ...buildIsetCoordinatorIntroTutorials({ completedMap: completedTutorials }),
      ...buildApplicationWorkspaceTutorials({ completedMap: completedTutorials }),
      ...buildCaseWorkspaceTutorials({ completedMap: completedTutorials }),
      ...buildNwacAssessmentTutorials({ completedMap: completedTutorials })
    ],
    [completedTutorials]
  );

  const loadTutorialProgress = useCallback(async () => {
    setTutorialProgressLoading(true);
    try {
      const response = await apiFetch('/api/me/tutorial-progress');
      let data = null;
      try { data = await response.json(); } catch { data = null; }
      if (!response.ok) {
        const message = data?.error || 'Failed to load tutorial progress';
        throw new Error(message);
      }
      const items = Array.isArray(data?.items) ? data.items : [];
      const map = items.reduce((acc, item) => {
        const tutorialId = typeof item?.tutorialId === 'string' ? item.tutorialId.trim() : '';
        const status = typeof item?.status === 'string' ? item.status.trim().toLowerCase() : '';
        if (tutorialId && (status === 'completed' || status === 'dismissed')) {
          acc[tutorialId] = status;
        }
        return acc;
      }, {});
      setTutorialStatusMap(map);
      return map;
    } catch (error) {
      console.error('[tutorials] load progress failed', error);
      setTutorialStatusMap({});
      return null;
    } finally {
      setTutorialProgressLoading(false);
    }
  }, []);

  const persistTutorialStatus = useCallback(async (tutorialId, status) => {
    const id = typeof tutorialId === 'string' ? tutorialId.trim() : '';
    const normalisedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
    if (!id) return false;
    if (!['completed', 'dismissed'].includes(normalisedStatus)) return false;
    try {
      const response = await apiFetch('/api/me/tutorial-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorialId: id, status: normalisedStatus })
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Failed to persist tutorial status (${response.status})`);
      }
      setTutorialStatusMap(prev => ({ ...(prev || {}), [id]: normalisedStatus }));
      return true;
    } catch (error) {
      console.error('[tutorials] persist failed', error);
      return false;
    }
  }, []);

  useEffect(() => {
    loadTutorialProgress();
  }, [loadTutorialProgress]);

  useEffect(() => {
    const handleAuthChange = () => {
      loadTutorialProgress();
    };
    window.addEventListener('auth:session-changed', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('auth:session-changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [loadTutorialProgress]);

  useEffect(() => {
    const handler = () => {
      introPromptShownRef.current = false;
      pageTutorialPromptShownRef.current = new Set();
      loadTutorialProgress();
    };
    window.addEventListener('tutorials:refresh', handler);
    return () => window.removeEventListener('tutorials:refresh', handler);
  }, [loadTutorialProgress]);

  useEffect(() => {
    if (!homeIntroTutorialId) return;
    const status = tutorialStatusMap[homeIntroTutorialId];
    if (status !== 'completed' && status !== 'dismissed') {
      introPromptShownRef.current = false;
    }
  }, [homeIntroTutorialId, tutorialStatusMap]);

  useEffect(() => {
    if (tutorialProgressLoading) return;
    if (migrateTutorialProgressRef.current) return;
    migrateTutorialProgressRef.current = true;

    const localCompletedMap = loadTutorialCompletionMapFromLocalStorage();
    const localIds = Object.keys(localCompletedMap || {}).filter((key) => localCompletedMap[key]);
    if (!localIds.length) {
      clearTutorialCompletionMapInLocalStorage();
      return;
    }

    const missing = localIds.filter((id) => tutorialStatusMap[id] !== 'completed');
    if (!missing.length) {
      clearTutorialCompletionMapInLocalStorage();
      return;
    }

    (async () => {
      try {
        const response = await apiFetch('/api/me/tutorial-progress/bulk-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tutorialIds: missing })
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `Failed to migrate tutorial progress (${response.status})`);
        }
        clearTutorialCompletionMapInLocalStorage();
        await loadTutorialProgress();
      } catch (error) {
        console.error('[tutorials] migration failed', error);
      }
    })();
  }, [tutorialProgressLoading, tutorialStatusMap, loadTutorialProgress]);

	  useEffect(() => {
	    if (introPromptShownRef.current) return;
	    if (tutorialProgressLoading) return;
	    if ((location?.pathname || '/') !== '/') return;
	    if (!homeIntroTutorialId) return;
	    const status = tutorialStatusMap[homeIntroTutorialId];
	    if (status === 'completed' || status === 'dismissed') return;
	    introPromptShownRef.current = true;
	    setIntroPromptVisible(true);
	  }, [homeIntroTutorialId, location?.pathname, tutorialProgressLoading, tutorialStatusMap]);

	  useEffect(() => {
	    if (introPromptVisible) return;
	    if (pageTutorialPrompt.visible) return;
	    if (tutorialProgressLoading) return;
      if (currentTutorial) return;

	    const path = location?.pathname || '/';
	    const match = path.match(/^\/application-case\/(\d+)/);
	    if (!match) return;
	    const caseId = match[1];
	    const maybePromptApplicationWorkspaceTutorial = () => {
	      if (!APPLICATION_WORKSPACE_PROMPT_ROLE_KEYS.has(normalizedEffectiveRole)) return;
	      const status = tutorialStatusMap[APPLICATION_WORKSPACE_TUTORIAL_ID];
	      if (status === 'completed' || status === 'dismissed') return;
	      const key = `${APPLICATION_WORKSPACE_TUTORIAL_ID}:${caseId}`;
	      if (pageTutorialPromptShownRef.current.has(key)) return;
	      pageTutorialPromptShownRef.current.add(key);
	      setPageTutorialPrompt({ visible: true, tutorialId: APPLICATION_WORKSPACE_TUTORIAL_ID });
	    };

	    // NWAC decision tutorial: prompt NWAC reviewers only when the case is in pending approval.
	    if (NWAC_DECISION_PROMPT_ROLE_KEYS.has(normalizedEffectiveRole)) {
	      const nwacStatus = tutorialStatusMap[NWAC_ASSESSMENT_TUTORIAL_ID];
	      const nwacKey = `${NWAC_ASSESSMENT_TUTORIAL_ID}:${caseId}`;
	      if (nwacStatus === 'completed' || nwacStatus === 'dismissed' || pageTutorialPromptShownRef.current.has(nwacKey)) {
	        maybePromptApplicationWorkspaceTutorial();
	        return;
	      }

	      let cancelled = false;
	      (async () => {
	        try {
	          const resp = await apiFetch(`/api/cases/${caseId}`);
	          const json = await resp.json().catch(() => null);
	          if (cancelled || !resp.ok) return;
	          const caseStatus = json?.status || json?.case?.status || null;
	          const appStatus = json?.application_status || json?.applicationStatus || null;
	          const normalizedStatus = String(appStatus || caseStatus || '').trim().toLowerCase();
	          if (normalizedStatus === 'pending_approval') {
	            pageTutorialPromptShownRef.current.add(nwacKey);
	            setPageTutorialPrompt({ visible: true, tutorialId: NWAC_ASSESSMENT_TUTORIAL_ID });
	            return;
	          }
	          maybePromptApplicationWorkspaceTutorial();
	        } catch (_) {
	          // If we cannot determine NWAC state, still allow the workspace overview tutorial prompt.
	          maybePromptApplicationWorkspaceTutorial();
	        }
	      })();

	      return () => { cancelled = true; };
	    }

	    maybePromptApplicationWorkspaceTutorial();
	  }, [
	    introPromptVisible,
	    pageTutorialPrompt.visible,
      currentTutorial,
	    normalizedEffectiveRole,
	    location?.pathname,
	    tutorialProgressLoading,
	    tutorialStatusMap,
	  ]);

  useEffect(() => {
    if (introPromptVisible) return;
    if (pageTutorialPrompt.visible) return;
    if (tutorialProgressLoading) return;
    if (currentTutorial) return;

    const path = location?.pathname || '/';
    const match = path.match(/^\/cases\/(\d+)/);
    if (!match) return;
    const caseId = match[1];

    const status = tutorialStatusMap[CASE_WORKSPACE_TUTORIAL_ID];
    if (status === 'completed' || status === 'dismissed') return;
    const key = `${CASE_WORKSPACE_TUTORIAL_ID}:${caseId}`;
    if (pageTutorialPromptShownRef.current.has(key)) return;
    pageTutorialPromptShownRef.current.add(key);
    setPageTutorialPrompt({ visible: true, tutorialId: CASE_WORKSPACE_TUTORIAL_ID });
  }, [
    introPromptVisible,
    pageTutorialPrompt.visible,
    currentTutorial,
    location?.pathname,
    tutorialProgressLoading,
    tutorialStatusMap
  ]);

  // Notifications state (moved inside component)
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const flashbarRef = useRef(null);

  const notificationScope = useMemo(() => {
    const path = location?.pathname || '/';
    const caseMatch = path.match(/^\/cases\/(\d+)(?:\/|$)/);
    if (caseMatch) {
      return { type: 'case', id: caseMatch[1] };
    }
    const appMatch = path.match(/^\/application-case\/([^/]+)(?:\/|$)/);
    if (appMatch) {
      return { type: 'application', id: appMatch[1] };
    }
    return { type: 'all', id: null };
  }, [location?.pathname]);

  const scopedNotifications = useMemo(() => {
    if (!Array.isArray(notifications) || notifications.length === 0) return [];
    if (!notificationScope || notificationScope.type === 'all' || !notificationScope.id) return notifications;

    const id = String(notificationScope.id);
    const isNumericId = /^\d+$/.test(id);

    const parseMetadata = (value) => {
      try {
        if (!value) return {};
        if (typeof value === 'string') return JSON.parse(value) || {};
        if (typeof value === 'object') return value || {};
      } catch (_) {}
      return {};
    };

    return notifications.filter((n) => {
      if (!n) return false;
      const metadata = parseMetadata(n.metadata);
      const metaCaseId = metadata.caseId != null ? String(metadata.caseId) : null;
      const metaTrackingId = metadata.trackingId != null ? String(metadata.trackingId) : null;
      const metaAppRef = metadata.applicationReference != null ? String(metadata.applicationReference) : null;

      if (notificationScope.type === 'case') {
        // Only notifications tied to this case.
        return metaCaseId === id;
      }

      // Application workspace: route parameter is typically iset_case.id (numeric),
      // but we also support tracking-id routes if they exist.
      if (isNumericId) {
        return metaCaseId === id;
      }
      return metaTrackingId === id || metaAppRef === id;
    });
  }, [notifications, notificationScope]);

  const loadNotifications = useCallback(async ({ scrollIntoView = false } = {}) => {
    setNotificationsLoading(true);
    try {
      const response = await apiFetch('/api/me/notifications');
      let data = [];
      try { data = await response.json(); } catch { data = []; }
      if (!response.ok) {
        const message = Array.isArray(data) ? 'Failed to load notifications' : (data?.error || 'Failed to load notifications');
        throw new Error(message);
      }
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      if (scrollIntoView && list.length > 0) {
        window.requestAnimationFrame(() => {
          if (flashbarRef.current) {
            try {
              flashbarRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch {}
          }
        });
      }
      return list;
    } catch (error) {
      console.error('[notifications] load failed', error);
      return null;
    } finally {
      setNotificationsLoading(false);
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

  const daysSinceUtc = useCallback((from) => {
    if (!from) return null;
    const start = (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    };
    const fromStart = start(from);
    const todayStart = start(new Date());
    if (fromStart === null || todayStart === null) return null;
    const diff = Math.floor((todayStart - fromStart) / (24 * 60 * 60 * 1000));
    return diff >= 0 ? diff : null;
  }, []);

  const notificationFlashbarItems = useMemo(() =>
    scopedNotifications
      .filter(n => n && n.dismissible !== false)
      .map(n => {
        let metadata = {};
        try {
          metadata = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : (n.metadata || {});
        } catch (_) {
          metadata = {};
        }
        const eventKey = n.event_key || metadata.event_key || metadata.eventKey || null;
        const typeFromSeverity = mapSeverityToType(n.severity);
        const flashType = eventKey === 'reminder_overdue' ? 'error' : typeFromSeverity;
        const daysOverdue = (() => {
          if (Number.isFinite(metadata.overdue_days) && metadata.overdue_days > 0) return Math.floor(metadata.overdue_days);
          const days = daysSinceUtc(metadata.due_at || metadata.dueAt);
          return days && days > 0 ? days : null;
        })();
        const caseId = metadata.caseId || null;
        const trackingId = metadata.trackingId || null;
        const caseNumber = metadata.caseNumber || null;
        const appReference = metadata.applicationReference || null;
        const isCaseManaged = metadata.isCaseManaged === true;
        const href =
          isCaseManaged && caseId
            ? `/cases/${caseId}`
            : caseId
              ? `/application-case/${caseId}`
              : trackingId
                ? `/application-case/${trackingId}`
                : null;
        const linkColor = (flashType === 'info' || flashType === 'success') ? 'inverted' : 'normal';
        const openApplicationTarget = caseNumber || appReference || trackingId || null;
        const linkLabel = eventKey === 'document_signed'
          ? (openApplicationTarget ? `Open application ${openApplicationTarget}` : 'Open application')
          : caseId
            ? (caseNumber ? `View case ${caseNumber}` : 'View case')
            : appReference
              ? `View application ${appReference}`
              : 'View application';
        const overdueSuffix = eventKey === 'reminder_overdue' && daysOverdue
          ? ` • ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`
          : '';
        const content = href ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span>{n.message}{overdueSuffix}</span>
            <Link href={href} color={linkColor}>{linkLabel}</Link>
          </div>
        ) : `${n.message || ''}${overdueSuffix}`;
        return {
          type: flashType,
          header: n.title || undefined,
          content,
          dismissible: true,
          onDismiss: () => handleDismissNotification(n.id),
          id: `notification-${n.id}`,
        };
      }),
  [scopedNotifications, handleDismissNotification, mapSeverityToType, daysSinceUtc]);

  const refreshNotifications = useCallback(() => loadNotifications({ scrollIntoView: true }), [loadNotifications]);

  const [aiContext, setAiContext] = useState(AdminDashboardHelp.aiContext || ""); // State to hold AI context

  const toggleHelpPanel = useCallback((content, title = "Help and Tutorials", context = "") => {
    setCurrentHelpContent(content);
    setHelpPanelTitle(title);
    const fallbackContext = AdminDashboardHelp.aiContext || "";
    const nextContext = typeof context === 'string' && context.trim() ? context : fallbackContext;
    setAiContext(nextContext); // Set the AI context
    setIsHelpPanelOpen(true);
  }, []);

  const markTutorialCompleted = useCallback((tutorial) => {
    const tutorialId = getTutorialId(tutorial);
    if (!tutorialId) return;
    persistTutorialStatus(tutorialId, 'completed');
  }, [persistTutorialStatus]);

  const endTutorial = useCallback((tutorial) => {
    const tutorialId = getTutorialId(tutorial);
    if (tutorialId) {
      persistTutorialStatus(tutorialId, 'dismissed');
    }
    setCurrentTutorial(null);
  }, [persistTutorialStatus]);

	  const handleIntroNotNow = useCallback(() => {
	    setIntroPromptVisible(false);
	    if (homeIntroTutorialId) {
	      persistTutorialStatus(homeIntroTutorialId, 'dismissed');
	    }
	  }, [homeIntroTutorialId, persistTutorialStatus]);

	  const handleIntroStartTour = useCallback(() => {
	    setIntroPromptVisible(false);
	    const introTutorial = (tutorials || []).find(tutorial => getTutorialId(tutorial) === homeIntroTutorialId);
      const runnableTutorial = cloneTutorialForRun(introTutorial);
	    toggleHelpPanel(
	      <IsetCoordinatorIntroTourHelp
	        tutorial={runnableTutorial}
	        onRestartTutorial={() => {
	          if (!runnableTutorial) return;
	          setCurrentTutorial(null);
	          window.setTimeout(() => setCurrentTutorial(cloneTutorialForRun(runnableTutorial)), 0);
	        }}
	        onEndTutorial={() => endTutorial(runnableTutorial)}
	      />,
	      'Take a tour'
	    );
	    if (runnableTutorial) {
	      setCurrentTutorial(runnableTutorial);
	    }
	  }, [endTutorial, homeIntroTutorialId, toggleHelpPanel, tutorials]);

	  const handleRestartTutorial = useCallback((tutorial) => {
	    const tutorialId = getTutorialId(tutorial);
	    if (!tutorialId) return;
	    setCurrentTutorial(null);
	    window.setTimeout(() => {
	      window.dispatchEvent(
	        new CustomEvent('tutorials:start', {
	          detail: { tutorialId }
	        })
	      );
	    }, 0);
	  }, []);

		  const resolveTutorialStartPath = useCallback(async (tutorial) => {
		    const category = tutorial?.category || null;
        const currentPath = location?.pathname || "/";

	    if (isHomeIntroTutorial(tutorial)) {
	      return '/';
	    }

	    // Tutorials that depend on hotspots inside the application workspace need a case context.
	    if (category === 'application-workspace' || category === 'nwac-assessment' || category === 'case-workspace') {
          if (category === 'application-workspace' && /^\/application-case\/\d+/.test(currentPath)) {
            return currentPath;
          }
          if (category === 'nwac-assessment' && /^\/application-case\/\d+/.test(currentPath)) {
            return currentPath;
          }
          if (category === 'case-workspace' && /^\/cases\/\d+/.test(currentPath)) {
            return currentPath;
          }

	      const fetchFirstCaseIdFromCases = async (statusList) => {
	        const params = new URLSearchParams({
	          page: '1',
	          pageSize: '1',
	          sort: 'updatedAt',
	          direction: 'desc',
	        });
	        if (statusList) params.set('status', statusList);
	        const resp = await apiFetch(`/api/cases?${params.toString()}`);
	        if (!resp.ok) return null;
	        const json = await resp.json().catch(() => null);
	        const items = Array.isArray(json?.items) ? json.items : [];
	        if (!items.length) return null;
	        const row = items[0] || {};
	        const caseId = row.id || row.caseId || row.case_id || null;
	        const n = Number(caseId);
	        return Number.isFinite(n) && n > 0 ? n : null;
	      };
	
	      if (category === 'case-workspace') {
	        const anyCaseId = await fetchFirstCaseIdFromCases(null);
	        if (anyCaseId) return `/cases/${anyCaseId}`;
	        return '/iset/cases';
	      }

	      // Prefer an actual pending-approval file for NWAC tutorials when possible.
	      if (category === 'nwac-assessment') {
	        const pending = await fetchFirstCaseIdFromCases('pending_approval');
	        if (pending) return `/application-case/${pending}`;
	      }
	
	      const any = await fetchFirstCaseIdFromCases(null);
	      if (any) return `/application-case/${any}`;
	
	      // Fallback: at least bring them to the place where they can open an application.
	      return '/case-assignment-dashboard';
	    }
	
	    return null;
	  }, [location?.pathname]);
	
	  const openHelpForTutorial = useCallback((tutorial) => {
	    const category = tutorial?.category || null;
	
	    if (isHomeIntroTutorial(tutorial)) {
	      toggleHelpPanel(
	        <IsetCoordinatorIntroTourHelp
	          tutorial={tutorial}
	          onRestartTutorial={() => handleRestartTutorial(tutorial)}
	          onEndTutorial={() => endTutorial(tutorial)}
	        />,
	        'Take a tour'
	      );
	      return;
	    }
	    if (category === 'application-workspace') {
	      toggleHelpPanel(
	        <ApplicationCaseDashboardHelp
	          tutorial={tutorial}
	          onRestartTutorial={() => handleRestartTutorial(tutorial)}
	          onEndTutorial={() => endTutorial(tutorial)}
	        />,
	        'Application workspace tour',
	        ApplicationCaseDashboardHelp.aiContext || ''
	      );
	      return;
	    }
	    if (category === 'case-workspace') {
	      toggleHelpPanel(
	        <CaseWorkspaceHelp
	          tutorial={tutorial}
	          onRestartTutorial={() => handleRestartTutorial(tutorial)}
	          onEndTutorial={() => endTutorial(tutorial)}
	        />,
	        'Case workspace tour',
	        CaseWorkspaceHelp.aiContext || ''
	      );
	      return;
	    }
	    if (category === 'nwac-assessment') {
	      toggleHelpPanel(
	        <NwacAssessmentHelp
	          tutorial={tutorial}
	          onRestartTutorial={() => handleRestartTutorial(tutorial)}
	          onEndTutorial={() => endTutorial(tutorial)}
	        />,
	        'NWAC assessment tour',
	        NwacAssessmentHelp.aiContext || ''
	      );
	      return;
	    }
	
	    // Default: open the general help panel, but keep the tutorial running.
	    toggleHelpPanel(<ApplicationAssessmentHelp />, 'Help and Tutorials', ApplicationAssessmentHelp.aiContext || '');
	  }, [endTutorial, handleRestartTutorial, toggleHelpPanel]);

	  const requestApplicationWorkspaceLayoutReset = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage?.setItem(TUTORIAL_APP_LAYOUT_RESET_FLAG, '1');
      }
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('applicationAssessment:resetLayout'));
    } catch (_) {}
	  }, []);

  const requestCaseWorkspaceLayoutReset = useCallback(() => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage?.setItem(TUTORIAL_CASE_LAYOUT_RESET_FLAG, '1');
      }
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('iset-case-workspace:resetLayout'));
    } catch (_) {}
  }, []);

	  const activePagePromptTutorial = useMemo(() => {
	    const id = pageTutorialPrompt?.tutorialId;
	    if (!id) return null;
	    return (tutorials || []).find(t => getTutorialId(t) === id) || null;
	  }, [pageTutorialPrompt?.tutorialId, tutorials]);

	  const handlePageTutorialSkip = useCallback(() => {
	    const id = pageTutorialPrompt?.tutorialId;
	    setPageTutorialPrompt({ visible: false, tutorialId: null });
	    if (id) {
	      persistTutorialStatus(id, 'dismissed');
	    }
	  }, [pageTutorialPrompt?.tutorialId, persistTutorialStatus]);

	  const handlePageTutorialStart = useCallback(() => {
	    const tutorial = activePagePromptTutorial;
	    setPageTutorialPrompt({ visible: false, tutorialId: null });
	    if (!tutorial) return;
      const runnableTutorial = cloneTutorialForRun(tutorial);
      if (!runnableTutorial) return;
      const category = tutorial?.category || null;
      const requiresApplicationWorkspaceLayout =
        category === 'application-workspace' || category === 'nwac-assessment';
      if (requiresApplicationWorkspaceLayout) {
        requestApplicationWorkspaceLayoutReset();
      }
      if (category === 'case-workspace') {
        requestCaseWorkspaceLayoutReset();
      }
      (async () => {
        try {
          openHelpForTutorial(runnableTutorial);
          const target = await resolveTutorialStartPath(runnableTutorial);
          if (target && (location?.pathname || '/') !== target) {
            try { history.push(target); } catch (_) {}
          }
        } finally {
          setCurrentTutorial(runnableTutorial);
        }
      })();
	  }, [
      activePagePromptTutorial,
      history,
      location?.pathname,
      openHelpForTutorial,
      requestApplicationWorkspaceLayoutReset,
      requestCaseWorkspaceLayoutReset,
      resolveTutorialStartPath
    ]);
	
	  const handleStartTutorial = useCallback(({ detail }) => {
	    const tutorial = detail?.tutorial || null;
	    if (!tutorial) {
	      setCurrentTutorial(null);
	      return;
	    }
      const runnableTutorial = cloneTutorialForRun(tutorial);
      if (!runnableTutorial) {
        setCurrentTutorial(null);
        return;
      }
      const category = tutorial?.category || null;
      const requiresApplicationWorkspaceLayout =
        category === 'application-workspace' || category === 'nwac-assessment';
      if (requiresApplicationWorkspaceLayout) {
        requestApplicationWorkspaceLayoutReset();
      }
      if (category === 'case-workspace') {
        requestCaseWorkspaceLayoutReset();
      }
	
	    (async () => {
	      try {
	        openHelpForTutorial(runnableTutorial);
	        const target = await resolveTutorialStartPath(runnableTutorial);
	        if (target && (location?.pathname || '/') !== target) {
	          try { history.push(target); } catch (_) {}
	        }
	      } finally {
	        setCurrentTutorial(runnableTutorial);
	      }
	    })();
	  }, [history, location?.pathname, openHelpForTutorial, requestApplicationWorkspaceLayoutReset, requestCaseWorkspaceLayoutReset, resolveTutorialStartPath]);

  useEffect(() => {
    const handler = (event) => {
      const tutorialId = event?.detail?.tutorialId;
      if (!tutorialId) return;
      const tutorial = (tutorials || []).find(t => getTutorialId(t) === tutorialId);
      if (!tutorial) return;
      handleStartTutorial({ detail: { tutorial } });
    };
    window.addEventListener('tutorials:start', handler);
    return () => window.removeEventListener('tutorials:start', handler);
  }, [handleStartTutorial, tutorials]);

  useEffect(() => {
    const handler = () => {
      const active = currentTutorialRef.current;
      if (active) {
        endTutorial(active);
      }
    };
    window.addEventListener('tutorials:end', handler);
    return () => window.removeEventListener('tutorials:end', handler);
  }, [endTutorial]);

	  const handleExitTutorial = useCallback(() => {
	    endTutorial(currentTutorial);
	  }, [currentTutorial, endTutorial]);

  const handleFinishTutorial = useCallback(() => {
    if (currentTutorial) {
      markTutorialCompleted(currentTutorial);
    }
    setCurrentTutorial(null);
  }, [currentTutorial, markTutorialCompleted]);

  useEffect(() => {
    currentTutorialRef.current = currentTutorial;
  }, [currentTutorial]);

  useEffect(() => {
    const handleTutorialDismissClick = (event) => {
      const target = event?.target;
      if (!(target instanceof Element)) return;
      const dismissButton = target.closest('button[aria-label="Close tutorial"]');
      if (!dismissButton) return;
      const activeTutorial = currentTutorialRef.current;
      if (!activeTutorial) return;
      window.setTimeout(() => {
        const latestTutorial = currentTutorialRef.current;
        if (latestTutorial) {
          endTutorial(latestTutorial);
        }
      }, 0);
    };
    document.addEventListener('click', handleTutorialDismissClick, true);
    return () => document.removeEventListener('click', handleTutorialDismissClick, true);
  }, [endTutorial]);

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

  useEffect(() => {
    setIsHelpPanelOpen(false);
    setChatVisible(false);
  }, [location?.pathname, location?.search]);

  const openPaletteInTools = useCallback((items) => {
    try { setAvailableItems(items || []); } catch {}
    setSplitPanelOpen(true);
  }, [setSplitPanelOpen]);

  useEffect(() => {
    const handleTopNavHelp = (event) => {
      const detail = event?.detail || {};
      const content = detail.content || <AdminConsoleIntroHelp />;
      const title = detail.title || 'Admin Console Help';
      const context = detail.context || AdminConsoleIntroHelp.aiContext || AdminDashboardHelp.aiContext || '';
      toggleHelpPanel(content, title, context);
    };
    window.addEventListener('help:open-topnav', handleTopNavHelp);
    return () => window.removeEventListener('help:open-topnav', handleTopNavHelp);
  }, [toggleHelpPanel]);

  // Listen for page requests to open the tools palette (avoids prop drilling)
  useEffect(() => {
    const onOpenPalette = (e) => {
      try {
        const items = (e && e.detail && e.detail.items) || [];
        setAvailableItems(items);
        setSplitPanelOpen(true);
      } catch {}
    };
    window.addEventListener('tools:open-palette', onOpenPalette);
    return () => window.removeEventListener('tools:open-palette', onOpenPalette);
  }, [setSplitPanelOpen]);

  return (
    <LocationProvider>
      <MessagingProvider>
        <FloatingMessageWindow chatVisible={chatVisible} />
        <FloatingChat
          visible={chatVisible}
          aiContext={aiContext}
          onClose={() => setChatVisible(false)}
          title={helpPanelTitle}
        />
        <TutorialsContext.Provider value={{ tutorials }}>
          <AnnotationContext
            currentTutorial={currentTutorial}
            onStartTutorial={handleStartTutorial}
            onExitTutorial={handleExitTutorial}
            onFinish={handleFinishTutorial}
            i18nStrings={annotationContextI18nStrings}
          >
	            {introPromptVisible && (
	              <Modal
	                visible={introPromptVisible}
	                header="Take a tour"
	                closeAriaLabel="Close tour prompt"
	                onDismiss={handleIntroNotNow}
                footer={
                  <SpaceBetween size="xs" direction="horizontal">
                    <Button onClick={handleIntroNotNow}>Not now</Button>
                    <Button variant="primary" onClick={handleIntroStartTour}>Start tour</Button>
                  </SpaceBetween>
                }
              >
                <SpaceBetween size="m">
                  <Box>
                    Welcome to PATH. This quick tour will walk you through the home page, the main widgets, and how to find help. You can reset tutorial progress from the "Tutorials" dashboard under "Support" in the side navigation.
                  </Box>
                  <Box>
                    You can also replay tutorials from the help panel, which you can open by clicking dashboard and widget "Info" links.
                  </Box>
                </SpaceBetween>
	              </Modal>
	            )}
	            {pageTutorialPrompt.visible && activePagePromptTutorial && (
	              <Modal
	                visible={pageTutorialPrompt.visible}
	                header={activePagePromptTutorial.title || 'Take a tour'}
	                closeAriaLabel="Close tutorial prompt"
	                onDismiss={handlePageTutorialSkip}
	                footer={
	                  <SpaceBetween size="xs" direction="horizontal">
	                    <Button onClick={handlePageTutorialSkip}>Skip</Button>
	                    <Button variant="primary" onClick={handlePageTutorialStart}>Start tutorial</Button>
	                  </SpaceBetween>
	                }
	              >
	                <SpaceBetween size="m">
	                  <Box variant="p">
	                    Welcome to this workspace tour. It will walk you through the main widgets, where to complete key actions, and how to move through this page efficiently.
	                  </Box>
	                  <Box variant="p">
	                    You can replay tutorials from dashboard and widget Info links in the help panel, and reset tutorial progress from the Tutorials dashboard under Support.
	                  </Box>
	                </SpaceBetween>
	              </Modal>
	            )}
	            <AppLayout
	              navigationOpen={isNavigationOpen}
	              onNavigationChange={({ detail }) => setIsNavigationOpen(detail.open)}
	              navigation={
	                <SideNavigation
                  showTutorialHotspots={isHomeIntroTutorial(currentTutorial)}
                  notificationCount={scopedNotifications.length}
                  refreshNotifications={refreshNotifications}
                  notificationsLoading={notificationsLoading}
                />
              }
              notifications={
                <div ref={flashbarRef}>
                  <Flashbar stackItems items={notificationFlashbarItems} />
                </div>
              }
              toolsOpen={isHelpPanelOpen}
              onToolsChange={({ detail }) => setIsHelpPanelOpen(detail.open)}
              tools={
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
          </AnnotationContext>
        </TutorialsContext.Provider>
      </MessagingProvider>
    </LocationProvider>
  );
};

export default AppContent;




