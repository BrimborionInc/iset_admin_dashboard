import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import Avatar from "@cloudscape-design/chat-components/avatar";
import ChatBubble from "@cloudscape-design/chat-components/chat-bubble";
import PromptInput from "@cloudscape-design/components/prompt-input";
import SupportPromptGroup from "@cloudscape-design/chat-components/support-prompt-group";
import SideNavigation from './layouts/SideNavigation.js';
import AppRoutes from './routes/AppRoutes.js'; // Ensure this matches the export in AppRoutes.js
import { helpMessages } from './utils/helpMessages.js';
import CustomSplitPanel from './layouts/CustomSplitPanel.js';
import { LocationProvider } from './context/LocationContext';
import { useLocation } from 'react-router-dom'; // Import useLocation from react-router-dom
import { applyMode, Mode } from "@cloudscape-design/global-styles";
import { useDarkMode } from './context/DarkModeContext'; // Import global dark mode
import ExpandableSection from "@cloudscape-design/components/expandable-section"; // Import ExpandableSection
import AdminDashboardHelp from './helpPanelContents/adminDashboardHelp.js';

const AppContent = () => {
  const [currentHelpContent, setCurrentHelpContent] = useState(helpMessages.overview);
  const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false);
  const [helpPanelTitle, setHelpPanelTitle] = useState("Help Panel");
  const [isNavigationOpen, setIsNavigationOpen] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState([{ text: 'Home', href: '/' }, { text: 'Admin Console', href: '#' }]);
  const [splitPanelOpen, setSplitPanelOpen] = useState(false); // State for SplitPanel, initially closed
  const [splitPanelSize, setSplitPanelSize] = useState(360); // State for SplitPanel size
  const [splitPanelPreferences, setSplitPanelPreferences] = useState({ position: 'side' }); // State for SplitPanel preferences
  const [availableItems, setAvailableItems] = useState([]); // State for available items
  const location = useLocation(); // Get the current location
  const [value, setValue] = React.useState("");
  const [flashbarItems, setFlashbarItems] = useState([
    {
      type: 'info',
      dismissible: true,
      content: 'Operating in DEMO environment. Servers: CLOUD, Serverless?: NO, Security: OFF',
      id: 'message_1',
      onDismiss: () => setFlashbarItems([]),
    },
  ]);

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
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer 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",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Admin Dashboard Assistant"
          },
          body: JSON.stringify({
            model: "mistralai/mistral-7b-instruct",
            messages: [
              {
                role: "system",
                content: `
                  You are a helpful assistant for the Admin Dashboard.
                  Provide assistance with navigation, feature usage, and troubleshooting common issues.
                  Limit responses to topics relevant to this context:
                  ${aiContext}
                `
              },
              { role: "user", content: promptValue }
            ]
          })
        });

        const data = await response.json();
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

  return (
    <LocationProvider>
      <AppLayout
        navigationOpen={isNavigationOpen}
        onNavigationChange={({ detail }) => setIsNavigationOpen(detail.open)}
        navigation={<SideNavigation />}
        notifications={
          <Flashbar
            items={flashbarItems}
          />
        }
        toolsOpen={isHelpPanelOpen}
        onToolsChange={({ detail }) => setIsHelpPanelOpen(detail.open)}
        tools={
          <HelpPanel
            header={
              <SpaceBetween size="l">
                <h2 style={{ marginLeft: "8px" }}>{helpPanelTitle}</h2>
                <Box>
                  <SpaceBetween size="l">
                    <Button
                      onClick={() => setChatVisible(!chatVisible)}
                      variant="primary"
                    >
                      {chatVisible ? "Close Chat" : "Start Chat"}
                    </Button>
                    {chatVisible && (
                      <div style={{ marginTop: '10px' }}>
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
                                  <Avatar
                                    ariaLabel="You"
                                    tooltipText="You"
                                    initials="You"
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
                            style={{ width: "80%", padding: "10px", marginRight: "10px", marginBottom: "10px" }} // Added marginBottom for spacing
                          />
                          <Button onClick={handleSendMessage} variant="primary">
                            Send
                          </Button>
                        </div>
                      </div>
                    )}
                  </SpaceBetween>
                </Box>
              </SpaceBetween>
            }
          >
            {currentHelpContent}
            <div>
              <h3>
                Learn more <Icon name="external" size="inherit" />
              </h3>
              <ul>
                <li>
                  <a href="">Link to documentation</a>
                </li>
                <li>
                  <a href="">Link to documentation</a>
                </li>
              </ul>
            </div>
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
