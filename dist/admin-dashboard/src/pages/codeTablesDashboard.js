import React, { useState, useEffect } from 'react';
import { Board, BoardItem, ItemsPalette } from '@cloudscape-design/board-components';
import { Header, Table, Button, SpaceBetween, Flashbar, Box, Input, Icon } from '@cloudscape-design/components';

const CountryTable = ({ editedCountries, handleInlineEdit, handleDeleteCountry, handleAddCountry, handleSaveChanges, handleCancelChanges, isChanged, flashMessages }) => (
  <BoardItem
    i18nStrings={{
      dragHandleAriaLabel: 'Drag handle',
      dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.',
      resizeHandleAriaLabel: 'Resize handle',
      resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.'
    }}
    header={
      <Header
        actions={
          <SpaceBetween direction="horizontal" size="s">
            <Button variant="primary" onClick={handleSaveChanges} disabled={!isChanged}>Save</Button>
            <Button variant="link" onClick={handleCancelChanges}>Cancel</Button>
          </SpaceBetween>
        }
      >
        Country Table
      </Header>
    }
  >
    <Flashbar items={flashMessages} />
    <Table
      columnDefinitions={[
        {
          id: 'name',
          header: 'Country Name',
          cell: item => (
            <Input
              value={item.name}
              onChange={e => handleInlineEdit(item.id, e.detail.value)}
            />
          ),
          sortingField: 'name',
          isRowHeader: true,
        },
        {
          id: 'actions',
          header: 'Actions',
          cell: item => (
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" iconName="close" onClick={() => handleDeleteCountry(item.id)} />
            </SpaceBetween>
          ),
        },
      ]}
      items={editedCountries}
      trackBy="id"
      variant="embedded"
      loadingText="Loading resources"
      empty={
        <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
          <SpaceBetween size="m">
            <b>No resources</b>
            <Button>Create resource</Button>
          </SpaceBetween>
        </Box>
      }
      footer={
        <Box textAlign="center">
          <Button variant="primary" onClick={handleAddCountry}>New Country</Button>
        </Box>
      }
    />
  </BoardItem>
);

const CodeTablesDashboard = () => {
  const [items, setItems] = useState([]);
  const [countries, setCountries] = useState([]);
  const [editedCountries, setEditedCountries] = useState([]);
  const [flashMessages, setFlashMessages] = useState([]);
  const [isChanged, setIsChanged] = useState(false);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/countries`)
      .then(response => response.json())
      .then(data => {
        setCountries(data);
        setEditedCountries(data);
      })
      .catch(error => console.error('Error fetching countries:', error));
  }, []);

  const handleInlineEdit = (countryId, newName) => {
    setEditedCountries(editedCountries.map(country => (country.id === countryId ? { ...country, name: newName } : country)));
    setIsChanged(true);
  };

  const handleSaveChanges = () => {
    // Save all changes to the backend
    const savePromises = editedCountries.map(country => {
      if (country.id) {
        return fetch(`${process.env.REACT_APP_API_BASE_URL}/api/countries/${country.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: country.name }),
        });
      } else {
        return fetch(`${process.env.REACT_APP_API_BASE_URL}/api/countries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: country.name }),
        });
      }
    });

    Promise.all(savePromises)
      .then(responses => Promise.all(responses.map(res => res.json())))
      .then(data => {
        setCountries(data);
        setEditedCountries(data);
        setIsChanged(false);
        setFlashMessages([{ type: 'success', content: 'Changes saved successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
      })
      .catch(error => {
        setFlashMessages([{ type: 'error', content: 'Error saving changes', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
        console.error('Error saving changes:', error);
      });
  };

  const handleCancelChanges = () => {
    setEditedCountries(countries);
    setIsChanged(false);
  };

  const handleAddCountry = () => {
    setEditedCountries([...editedCountries, { id: null, name: '' }]);
    setIsChanged(true);
  };

  const handleDeleteCountry = (countryId) => {
    setEditedCountries(editedCountries.filter(country => country.id !== countryId));
    setIsChanged(true);
  };

  const availableItems = [
    {
      id: 'country-table',
      data: { title: 'Country Table' },
    },
    {
      id: 'code-table-2',
      data: { title: 'Code Table 2' },
    },
  ];

  const i18nStrings = {
    dragHandleAriaLabel: 'Drag handle',
    dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.',
    resizeHandleAriaLabel: 'Resize handle',
    resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.',
    liveAnnouncementDndStarted: (operationType) =>
      operationType === 'resize' ? 'Resizing' : 'Dragging',
    liveAnnouncementDndItemReordered: (operation) => {
      const columns = `column ${operation.placement.x + 1}`;
      const rows = `row ${operation.placement.y + 1}`;
      return `Item moved to ${operation.direction === 'horizontal' ? columns : rows}.`;
    },
    liveAnnouncementDndItemResized: (operation) => {
      const columnsConstraint = operation.isMinimalColumnsReached ? ' (minimal)' : '';
      const rowsConstraint = operation.isMinimalRowsReached ? ' (minimal)' : '';
      const sizeAnnouncement = operation.direction === 'horizontal'
        ? `columns ${operation.placement.width}${columnsConstraint}`
        : `rows ${operation.placement.height}${rowsConstraint}`;
      return `Item resized to ${sizeAnnouncement}.`;
    },
    liveAnnouncementDndItemInserted: (operation) => {
      const columns = `column ${operation.placement.x + 1}`;
      const rows = `row ${operation.placement.y + 1}`;
      return `Item inserted to ${columns}, ${rows}.`;
    },
    liveAnnouncementDndCommitted: (operationType) => `${operationType} committed`,
    liveAnnouncementDndDiscarded: (operationType) => `${operationType} discarded`,
    liveAnnouncementItemRemoved: (op) => `Removed item ${op.item.data.title}.`,
    navigationAriaLabel: 'Board navigation',
    navigationAriaDescription: 'Click on non-empty item to move focus over',
    navigationItemAriaLabel: (item) => (item ? item.data.title : 'Empty'),
  };

  return (
    <div>
      <ItemsPalette
        items={availableItems}
        onItemSelect={(item) => setItems([...items, { ...item, rowSpan: 2, columnSpan: 12 }])}
        i18nStrings={{
          itemAriaLabel: (item) => `Add ${item.data.title}`,
          itemAriaDescription: 'Use Space or Enter to add this item to the board.',
        }}
      />
      <Board
        renderItem={(item) => {
          if (item.id === 'country-table') {
            return (
              <CountryTable
                editedCountries={editedCountries}
                handleInlineEdit={handleInlineEdit}
                handleDeleteCountry={handleDeleteCountry}
                handleAddCountry={handleAddCountry}
                handleSaveChanges={handleSaveChanges}
                handleCancelChanges={handleCancelChanges}
                isChanged={isChanged}
                flashMessages={flashMessages}
              />
            );
          }
          return (
            <BoardItem
              key={item.id}
              {...item}
              i18nStrings={i18nStrings}
              header={
                <Header>
                  {item.data.title}
                </Header>
              }
            >
              Content for {item.data.title}
            </BoardItem>
          );
        }}
        items={items}
        onItemsChange={(event) => setItems(event.detail.items)}
        i18nStrings={i18nStrings}
        columnCount={12} // Set the board to use a 12-column grid
      />
    </div>
  );
};

export default CodeTablesDashboard;
