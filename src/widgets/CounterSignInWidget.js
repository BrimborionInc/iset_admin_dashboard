import React, { useState, useEffect } from 'react';
import { Header, Button, Select, SpaceBetween, Alert, Box, Link, ButtonDropdown } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import CounterSignInHelp from '../helpPanelContents/CounterSignInHelp';

const CounterSignInWidget = ({ toggleHelpPanel, actions, setActiveUserId }) => {
  const [users, setUsers] = useState([]);
  const [counters, setCounters] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedCounterId, setSelectedCounterId] = useState(null);
  const [message, setMessage] = useState(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    // Fetch users and counters on component mount
    const fetchData = async () => {
      try {
        const usersRes = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/users`);
        const countersRes = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/counters`);
        const usersData = await usersRes.json();
        const countersData = await countersRes.json();
        setUsers(usersData.map(user => ({ label: user.name, value: user.id })));
        setCounters(countersData.map(counter => ({ label: counter.name, value: counter.id })));
      } catch (error) {
        console.error('Error fetching users or counters:', error);
        setMessage('Failed to load users or counters.');
      }
    };
    fetchData();
  }, []);

  const handleSignIn = async () => {
    if (!selectedUserId || !selectedCounterId) {
      setMessage('Please select both a user and a counter.');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/counter-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: parseInt(selectedUserId, 10),
          counterId: parseInt(selectedCounterId, 10),
        }),
      });

      if (response.status === 201) {
        const selectedUser = users.find(user => user.value === parseInt(selectedUserId, 10));
        const selectedCounter = counters.find(counter => counter.value === parseInt(selectedCounterId, 10));
        setMessage({ type: 'success', text: `Signed in as ${selectedUser.label} at ${selectedCounter.label}.` });
        setIsSignedIn(true);

        // Notify parent component of the active user
        if (setActiveUserId) {
          setActiveUserId(selectedUserId);
        }
      } else if (response.status === 409) {
        setMessage('This counter is already in use.');
      } else {
        setMessage('Failed to sign in. Please try again.');
      }
    } catch (error) {
      console.error('Error during sign-in:', error);
      setMessage('Failed to sign in. Please try again.');
    }
  };

  return (
    <BoardItem
      header={
        <Header
          description="Sign in to a counter to start your session."
          info={
            <Link
              variant="info"
              onFollow={() => toggleHelpPanel(<CounterSignInHelp />, "Counter Sign-In Help")}
            >
              Info
            </Link>
          }
        >
          (Demo) Counter Sign-In
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
          onItemClick={() => actions.removeItem()}
        />
      }
    >
      <SpaceBetween size="m">
        {message && (
          <Alert
            type={message.type || 'info'}
            dismissible
            onDismiss={() => setMessage(null)}
          >
            {message.text || message}
          </Alert>
        )}
        <Select
          selectedOption={users.find(user => user.value === selectedUserId) || null}
          onChange={({ detail }) => setSelectedUserId(detail.selectedOption.value)}
          options={users}
          placeholder="Select a user"
        />
        <Select
          selectedOption={counters.find(counter => counter.value === selectedCounterId) || null}
          onChange={({ detail }) => setSelectedCounterId(detail.selectedOption.value)}
          options={counters}
          placeholder="Select a counter"
        />
        <Button variant={isSignedIn ? "normal" : "primary"} onClick={handleSignIn}>
          Sign In
        </Button>
      </SpaceBetween>
    </BoardItem>
  );
};

export default CounterSignInWidget;
