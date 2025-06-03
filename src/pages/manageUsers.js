import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Header,
  Table,
  Box,
  SpaceBetween,
  Button,
  Link,
  TextFilter,
  Pagination,
  CollectionPreferences,
  Flashbar,
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import BoardItem from '@cloudscape-design/board-components/board-item';
import { helpMessages } from '../utils/helpMessages'; // Import help messages

const UserManagementDashboard = ({ header, headerInfo, toggleHelpPanel }) => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState(null); // State for error handling
  const [items, setItems] = useState([
    {
      id: 'users',
      rowSpan: 4,
      columnSpan: 4,
      data: { title: 'Users', content: null }
    },
    {
      id: 'roles',
      rowSpan: 4,
      columnSpan: 4,
      data: { title: 'Roles', content: null }
    }
  ]);

  useEffect(() => {
    // Fetch users data
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/users`)
      .then(response => response.json())
      .then(data => setUsers(data))
      .catch(error => {
        console.error('Error fetching users:', error);
        setError('Error fetching users');
      });

    // Fetch roles data
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/roles`)
      .then(response => response.json())
      .then(data => setRoles(data))
      .catch(error => {
        console.error('Error fetching roles:', error);
        setError('Error fetching roles');
      });
  }, []);

  const userColumns = [
    { id: 'userId', header: 'User ID', cell: item => item.id },
    { id: 'userName', header: 'User Name', cell: item => item.name },
    { id: 'userEmail', header: 'Email', cell: item => item.email },
    { id: 'userRole', header: 'Role', cell: item => item.role },
    { id: 'modify', header: '', cell: item => <Link href={`/admin-modify-user/${item.id}`}>Modify</Link> },
  ];

  const roleColumns = [
    { id: 'roleId', header: 'Role ID', cell: item => item.id },
    { id: 'roleName', header: 'Role Name', cell: item => item.name },
    { id: 'roleDescription', header: 'Description', cell: item => item.description },
    { id: 'modify', header: '', cell: item => <Link href={`/admin-modify-role/${item.id}`}>Modify</Link> },
  ];

  return (
    <ContentLayout
      header={
        <Header variant="h1">
          {header}
        </Header>
      }
    >
      {error && <Flashbar items={[{ type: 'error', content: error, dismissible: true }]} />}
      <Board
        renderItem={(item) => (
          <BoardItem
            key={item.id}
            {...item}
            header={
              <Header variant="h2" info={<Link variant="info" onClick={() => toggleHelpPanel(item.id)}>Info</Link>}>
                {item.data.title}
              </Header>
            }
            dragHandleAriaLabel={item.dragHandleAriaLabel}
            i18nStrings={{
              dragHandleAriaLabel: 'Drag handle',
              dragHandleAriaDescription:
                'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to submit, or Escape to discard.',
              resizeHandleAriaLabel: 'Resize handle',
              resizeHandleAriaDescription:
                'Use Space or Enter to activate resize, arrow keys to move, Space or Enter to submit, or Escape to discard.',
            }}
          >
            {item.id === 'users' && (
              <Table
                columnDefinitions={userColumns}
                items={users}
                ariaLabels={{
                  selectionGroupLabel: "Users selection",
                  allItemsSelectionLabel: () => "select all",
                  itemSelectionLabel: ({ selectedItems }, item) => item.name,
                }}
                renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
                  `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
                }
                loadingText="Loading users"
                selectionType="multi"
                trackBy="id"
                empty={
                  <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
                    <SpaceBetween size="m">
                      <b>No users</b>
                      <Button>Create user</Button>
                    </SpaceBetween>
                  </Box>
                }
                filter={
                  <TextFilter
                    filteringPlaceholder="Find users"
                    filteringText=""
                    countText="0 matches"
                  />
                }
                header={
                  <Header
                    counter={
                      users.length
                        ? `(${users.length})`
                        : ''
                    }
                    actions={
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button variant="primary">Create user</Button>
                      </SpaceBetween>
                    }
                  >
                    Users
                  </Header>
                }
                pagination={
                  <Pagination currentPageIndex={1} pagesCount={Math.ceil(users.length / 10)} />
                }
                preferences={
                  <CollectionPreferences
                    title="Preferences"
                    confirmLabel="Confirm"
                    cancelLabel="Cancel"
                    preferences={{
                      pageSize: 10,
                      contentDisplay: [
                        { id: "userId", visible: true },
                        { id: "userName", visible: true },
                        { id: "userEmail", visible: true },
                        { id: "userRole", visible: true },
                      ],
                    }}
                    pageSizePreference={{
                      title: "Page size",
                      options: [
                        { value: 10, label: "10 users" },
                        { value: 20, label: "20 users" },
                      ],
                    }}
                    wrapLinesPreference={{}}
                    stripedRowsPreference={{}}
                    contentDensityPreference={{}}
                    contentDisplayPreference={{
                      options: [
                        { id: "userId", label: "User ID", alwaysVisible: true },
                        { id: "userName", label: "User Name" },
                        { id: "userEmail", label: "Email" },
                        { id: "userRole", label: "Role" },
                      ],
                    }}
                    stickyColumnsPreference={{
                      firstColumns: {
                        title: "Stick first column(s)",
                        description: "Keep the first column(s) visible while horizontally scrolling the table content.",
                        options: [
                          { label: "None", value: 0 },
                          { label: "First column", value: 1 },
                          { label: "First two columns", value: 2 },
                        ],
                      },
                      lastColumns: {
                        title: "Stick last column",
                        description: "Keep the last column visible while horizontally scrolling the table content.",
                        options: [
                          { label: "None", value: 0 },
                          { label: "Last column", value: 1 },
                        ],
                      }}
                    }
                  />
                }
              />
            )}
            {item.id === 'roles' && (
              <Table
                columnDefinitions={roleColumns}
                items={roles}
                ariaLabels={{
                  selectionGroupLabel: "Roles selection",
                  allItemsSelectionLabel: () => "select all",
                  itemSelectionLabel: ({ selectedItems }, item) => item.name,
                }}
                renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
                  `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
                }
                loadingText="Loading roles"
                selectionType="multi"
                trackBy="id"
                empty={
                  <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
                    <SpaceBetween size="m">
                      <b>No roles</b>
                      <Button>Create role</Button>
                    </SpaceBetween>
                  </Box>
                }
                filter={
                  <TextFilter
                    filteringPlaceholder="Find roles"
                    filteringText=""
                    countText="0 matches"
                  />
                }
                header={
                  <Header
                    counter={
                      roles.length
                        ? `(${roles.length})`
                        : ''
                    }
                    actions={
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button variant="primary">Create role</Button>
                      </SpaceBetween>
                    }
                  >
                    Roles
                  </Header>
                }
                pagination={
                  <Pagination currentPageIndex={1} pagesCount={Math.ceil(roles.length / 10)} />
                }
                preferences={
                  <CollectionPreferences
                    title="Preferences"
                    confirmLabel="Confirm"
                    cancelLabel="Cancel"
                    preferences={{
                      pageSize: 10,
                      contentDisplay: [
                        { id: "roleId", visible: true },
                        { id: "roleName", visible: true },
                        { id: "roleDescription", visible: true },
                      ],
                    }}
                    pageSizePreference={{
                      title: "Page size",
                      options: [
                        { value: 10, label: "10 roles" },
                        { value: 20, label: "20 roles" },
                      ],
                    }}
                    wrapLinesPreference={{}}
                    stripedRowsPreference={{}}
                    contentDensityPreference={{}}
                    contentDisplayPreference={{
                      options: [
                        { id: "roleId", label: "Role ID", alwaysVisible: true },
                        { id: "roleName", label: "Role Name" },
                        { id: "roleDescription", label: "Description" },
                      ],
                    }}
                    stickyColumnsPreference={{
                      firstColumns: {
                        title: "Stick first column(s)",
                        description: "Keep the first column(s) visible while horizontally scrolling the table content.",
                        options: [
                          { label: "None", value: 0 },
                          { label: "First column", value: 1 },
                          { label: "First two columns", value: 2 },
                        ],
                      },
                      lastColumns: {
                        title: "Stick last column",
                        description: "Keep the last column visible while horizontally scrolling the table content.",
                        options: [
                          { label: "None", value: 0 },
                          { label: "Last column", value: 1 },
                        ],
                      }}
                    }
                  />
                }
              />
            )}
          </BoardItem>
        )}
        items={items}
        onItemsChange={(event) => setItems(event.detail.items)}
        i18nStrings={{
          liveAnnouncementDndStarted: (operationType) =>
            operationType === 'resize' ? 'Resizing' : 'Dragging',
          liveAnnouncementDndItemReordered: (operation) => {
            const columns = `column ${operation.placement.x + 1}`;
            const rows = `row ${operation.placement.y + 1}`;
            return `Item moved to ${
              operation.direction === 'horizontal' ? columns : rows
            }.`;
          },
          liveAnnouncementDndItemResized: (operation) => {
            const columnsConstraint = operation.isMinimalColumnsReached
              ? ' (minimal)'
              : '';
            const rowsConstraint = operation.isMinimalRowsReached
              ? ' (minimal)'
              : '';
            const sizeAnnouncement =
              operation.direction === 'horizontal'
                ? `columns ${operation.placement.width}${columnsConstraint}`
                : `rows ${operation.placement.height}${rowsConstraint}`;
            return `Item resized to ${sizeAnnouncement}.`;
          },
          liveAnnouncementDndItemInserted: (operation) => {
            const columns = `column ${operation.placement.x + 1}`;
            const rows = `row ${operation.placement.y + 1}`;
            return `Item inserted to ${columns}, ${rows}.`;
          },
          liveAnnouncementDndCommitted: (operationType) =>
            `${operationType} committed`,
          liveAnnouncementDndDiscarded: (operationType) =>
            `${operationType} discarded`,
          liveAnnouncementItemRemoved: (op) =>
            `Removed item ${op.item.data.title}.`,
          navigationAriaLabel: 'Board navigation',
          navigationAriaDescription:
            'Click on non-empty item to move focus over',
          navigationItemAriaLabel: (item) => (item ? item.data.title : 'Empty'),
        }}
      />
    </ContentLayout>
  );
};

export default UserManagementDashboard;
