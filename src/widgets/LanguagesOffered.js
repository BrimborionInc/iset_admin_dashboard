import React, { useState, useEffect } from 'react';
import {
  Table,
  SpaceBetween,
  Box,
  Header,
  Button,
  Select,
  Flashbar,
  ButtonDropdown,
  Link,
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { LocationContext } from '../context/LocationContext'; // Import LocationContext

const LanguagesOffered = ({ locationId, toggleHelpPanel }) => {
  const [languages, setLanguages] = useState([]);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [initialAvailableLanguages, setInitialAvailableLanguages] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [isChanged, setIsChanged] = useState(false);

  const fetchLanguages = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations/${locationId}/languages`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Fetched languages:', data); // Add logging
      setLanguages(data);
    } catch (error) {
      console.error('Error fetching languages:', error);
      setFlashMessages([{ type: 'error', content: 'Failed to fetch languages', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
    }
  };

  const fetchAvailableLanguages = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations/${locationId}/available-languages`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Fetched available languages:', data); // Add logging
      setAvailableLanguages(data);
      setInitialAvailableLanguages(data); // Store the initial state
    } catch (error) {
      console.error('Error fetching available languages:', error);
      setFlashMessages([{ type: 'error', content: 'Failed to fetch available languages', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
    }
  };

  useEffect(() => {
    fetchLanguages();
    fetchAvailableLanguages();
  }, [locationId]);

  const handleSave = async () => {
    try {
      // Save changes to the backend
      const savePromises = languages.map(language => {
        if (language.isNew) {
          // New language association
          console.log('Saving new language association:', language); // Add logging
          return fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations/${locationId}/languages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ languageId: language.id, status: language.status }),
          }).then(response => {
            if (!response.ok) {
              return response.text().then(text => {
                console.error('Error response text:', text); // Add logging
                throw new Error(`HTTP error! status: ${response.status}`);
              });
            }
            return response.json();
          }).then(data => {
            console.log('New language association saved:', data); // Add logging
            return data;
          });
        } else {
          // Existing language association
          console.log('Updating existing language association:', language); // Add logging
          return fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations/${locationId}/languages/${language.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: language.status }),
          }).then(response => {
            if (!response.ok) {
              return response.text().then(text => {
                console.error('Error response text:', text); // Add logging
                throw new Error(`HTTP error! status: ${response.status}`);
              });
            }
            return response.json();
          }).then(data => {
            console.log('Existing language association updated:', data); // Add logging
            return data;
          });
        }
      });

      const results = await Promise.all(savePromises);
      console.log('All changes saved:', results); // Add logging

      setFlashMessages([{ type: 'success', content: 'Languages saved successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
      setIsChanged(false);
    } catch (error) {
      console.error('Error saving languages:', error);
      setFlashMessages([{ type: 'error', content: 'Failed to save languages', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
    }
  };

  const handleCancel = () => {
    console.log('Cancel clicked, re-fetching languages'); // Add logging
    fetchLanguages();
    setAvailableLanguages(initialAvailableLanguages); // Reset available languages
    setIsChanged(false);
  };

  const handleInputChange = (id, field, value) => {
    console.log(`Input change for language ID ${id}, field ${field}, value ${value}`); // Add logging
    setLanguages(prevLanguages => {
      const updatedLanguages = prevLanguages.map(language =>
        language.id === id ? { ...language, [field]: value } : language
      );
      setIsChanged(true);
      return updatedLanguages;
    });
  };

  const handleAddLanguage = (languageId) => {
    const language = availableLanguages.find(l => l.id === parseInt(languageId));
    if (!language) return;
    
    console.log('Adding language association:', language); // Add logging
    const newLanguage = {
      id: language.id,
      name: language.name,
      code: language.code,
      status: 'Additional',
      isNew: true
    };
    setLanguages(prevLanguages => [...prevLanguages, newLanguage]);
    setAvailableLanguages(prevAvailableLanguages => prevAvailableLanguages.filter(l => l.id !== language.id));
    setIsChanged(true);
  };

  const handleDeleteLanguage = async (id) => {
    try {
      const language = languages.find(language => language.id === id);
      if (!language.isNew) {
        // Delete from the backend
        console.log('Deleting language association from backend, ID:', id); // Add logging
        await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations/${locationId}/languages/${id}`, {
          method: 'DELETE',
        }).then(response => {
          if (!response.ok) {
            return response.text().then(text => {
              console.error('Error response text:', text); // Add logging
              throw new Error(`HTTP error! status: ${response.status}`);
            });
          }
          return response.json();
        }).then(data => {
          console.log('Language association deleted:', data); // Add logging
          return data;
        });
      }
      // Remove from the state
      console.log('Deleting language association from state, ID:', id); // Add logging
      const updatedLanguages = languages.filter(language => language.id !== id);
      setLanguages(updatedLanguages);
      setIsChanged(true);
    } catch (error) {
      console.error('Error deleting language association:', error);
      setFlashMessages([{ type: 'error', content: 'Failed to delete language association', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
    }
  };

  const helpPanelContent = (
    <div>
      <h2>Languages Offered Help</h2>
      <p>This widget displays the languages offered at the selected location. You can add, update, or delete languages as needed.</p>
      <ul>
        <li><strong>Language:</strong> The name of the language offered.</li>
        <li><strong>Status:</strong> The status of the language (Mandatory, Local, Additional).</li>
        <li><strong>Actions:</strong> Options to delete a language.</li>
      </ul>
      <p>Use the "Add Language" button to associate a new language with the location.</p>
    </div>
  );

  return (
    <BoardItem
      i18nStrings={{
        dragHandleAriaLabel: "Drag handle",
        dragHandleAriaDescription: "Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.",
        resizeHandleAriaLabel: "Resize handle",
        resizeHandleAriaDescription: "Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard."
      }}
      header={
        <Header
          description="Languages offered at this location"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={handleSave} disabled={!isChanged}>Save</Button>
              <Button variant="link" onClick={handleCancel}>Cancel</Button>
            </SpaceBetween>
          }
          info={
            <Link variant="info" onFollow={() => toggleHelpPanel(helpPanelContent, "Languages Offered Help")}>
              Info
            </Link>
          }
        >
          Languages
        </Header>
      }
    >
      <Flashbar items={flashMessages} />
      <Box margin={{ bottom: 's' }} /> {/* Add small space after Flashbar */}
      <Box padding="0">
        <Table
          columnDefinitions={[
            {
              id: 'name',
              header: 'Language',
              cell: item => item.name, // Display language name as plain text
            },
            {
              id: 'status',
              header: 'Status',
              cell: item => (
                <Select
                  expandToViewport
                  selectedOption={{ label: item.status, value: item.status }}
                  onChange={e => handleInputChange(item.id, 'status', e.detail.selectedOption.value)}
                  options={[
                    { label: 'Mandatory', value: 'Mandatory' },
                    { label: 'Local', value: 'Local' },
                    { label: 'Additional', value: 'Additional' },
                  ]}
                />
              ),
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: item => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="inline-link"
                    ariaLabel={`Delete ${item.name}`}
                    onClick={() => handleDeleteLanguage(item.id)}
                  >
                    Delete
                  </Button>
                </SpaceBetween>
              ),
            },
          ]}
          items={languages}
          empty={
            <b>No languages</b>
          }
          footer={
            <Box>
              <ButtonDropdown
                expandToViewport
                items={availableLanguages.map(language => ({
                  id: language.id.toString(),
                  text: language.name,
                }))}
                onItemClick={({ detail }) => handleAddLanguage(detail.id)}
              >
                Add Language
              </ButtonDropdown>
            </Box>
          }
        />
      </Box>
    </BoardItem>
  );
};

export default LanguagesOffered;
