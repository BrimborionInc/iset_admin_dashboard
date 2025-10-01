import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  AppLayout,
  Flashbar,
  HelpPanel,
  Icon,
  Box,
  Button,
  Header,
  SpaceBetween,
  ButtonDropdown,
  Container
} from '@cloudscape-design/components';
import { ItemsPalette, BoardItem } from '@cloudscape-design/board-components';
import Avatar from "@cloudscape-design/chat-components/avatar";
import ChatBubble from "@cloudscape-design/chat-components/chat-bubble";
import PromptInput from "@cloudscape-design/components/prompt-input";
import SupportPromptGroup from "@cloudscape-design/chat-components/support-prompt-group";
import SideNavigation from './layouts/SideNavigation.js';
import { apiFetch } from './auth/apiClient';
import AppRoutes from './routes/AppRoutes.js'; // Ensure this matches the export in AppRoutes.js
import { helpMessages } from './utils/helpMessages.js';
import CustomSplitPanel from './layouts/CustomSplitPanel.js';
import { LocationProvider } from './context/LocationContext';
import { useLocation } from 'react-router-dom'; // Import useLocation from react-router-dom
import { applyMode, Mode } from "@cloudscape-design/global-styles";
import { useDarkMode } from './context/DarkModeContext'; // Import global dark mode
import ExpandableSection from "@cloudscape-design/components/expandable-section"; // Import ExpandableSection
import AdminDashboardHelp from './helpPanelContents/adminDashboardHelp.js';

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
  const location = useLocation(); // Get the current location
  const [value, setValue] = React.useState("");

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

  const { useDarkMode: isDarkMode, setUseDarkMode } = useDarkMode(); // ✅ Corrected

  const [aiContext, setAiContext] = useState(""); // State to hold AI context

  const toggleHelpPanel = (content, title = "Help and Tutorials", context = "") => {
    setCurrentHelpContent(content);
    setHelpPanelTitle(title);
    setAiContext(context); // Set the AI context
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

  const resetToDefaultLayout = () => {
    // Logic to reset the layout to default
    console.log('Resetting to default layout');
    setAvailableItems([]); // Reset available items
    // Add more logic as needed
  };

  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [promptValue, setPromptValue] = useState("");
  const chatContainerRef = useRef(null);

  const handleSendMessage = async () => {
    if (promptValue.trim()) {
      const userMessage = {
        type: "outgoing",
        text: promptValue,
        timestamp: new Date().toLocaleTimeString(),
      };
      setChatMessages((prev) => [...prev, userMessage]);
      setPromptValue("");
      setLoading(true);

      try {
        const response = await apiFetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'mistralai/mistral-7b-instruct',
            messages: [
              { role: 'system', content: `You are a helpful assistant for the Admin Dashboard. Limit responses to this context: ${aiContext}` },
              { role: 'user', content: promptValue }
            ]
          })
        });

        const data = await response.json();
        if (!response.ok) {
          const msg = data?.message || data?.details?.message || 'AI assistant is disabled or unavailable.';
          setChatMessages((prev) => [...prev, { type: 'incoming', text: msg, timestamp: new Date().toLocaleTimeString() }]);
          setLoading(false);
          return;
        }
        const aiReply = data.choices?.[0]?.message?.content;

        setChatMessages((prev) => [
          ...prev,
          {
            type: "incoming",
            text: aiReply || "Sorry, I didn’t understand that.",
            timestamp: new Date().toLocaleTimeString(),
          }
        ]);
      } catch (err) {
        console.error("AI error:", err);
        setChatMessages((prev) => [
          ...prev,
          {
            type: "incoming",
            text: "Something went wrong. Please try again later.",
            timestamp: new Date().toLocaleTimeString(),
          }
        ]);
      }

      setLoading(false);
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

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
  }, []);  return (
    <LocationProvider>
      <AppLayout
        navigationOpen={isNavigationOpen}
        onNavigationChange={({ detail }) => setIsNavigationOpen(detail.open)}
        navigation={<SideNavigation currentRole={currentRole} />}
        notifications={<Flashbar items={notificationFlashbarItems} />}
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
                      {chatVisible ? "Close Chat" : "Start Chat"}
                    </Button>
                  }
                >
                  {helpPanelTitle}
                </Header>
              }
            >
              {currentHelpContent}
              {chatVisible && (
                <Box margin={{ top: 's' }}>
                  <div
                    ref={chatContainerRef}
                    style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "10px" }}
                  >
                    {chatMessages.map((message, index) => (
                      <ChatBubble
                        key={index}
                        ariaLabel={`${message.type === "outgoing" ? "You" : "AI"} at ${message.timestamp}`}
                        type={message.type}
                        avatar={
                          message.type === "outgoing" ? (
                            <Avatar ariaLabel="You" tooltipText="You" initials="You" />
                          ) : (
                            <Avatar color="gen-ai" iconName="gen-ai" ariaLabel="Generative AI assistant" tooltipText="Generative AI assistant" />
                          )
                        }
                      >
                        {message.text}
                      </ChatBubble>
                    ))}
                    {loading && <p>Generating a response...</p>}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={promptValue}
                      onChange={(e) => setPromptValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask your question here..."
                      style={{ width: "80%", padding: "10px", marginRight: "10px", marginBottom: "10px" }}
                    />
                    <Button onClick={handleSendMessage} variant="primary">Send</Button>
                  </div>
                </Box>
              )}
              <div>
                <h3>
                  Learn more <Icon name="external" size="inherit" />
                </h3>
                <ul>
                  <li><a href="">Link to documentation</a></li>
                  <li><a href="">Link to documentation</a></li>
                </ul>
              </div>
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




