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
  const [evaluators, setEvaluators] = useState([]);
  const [error, setError] = useState(null); // State for error handling
  const [items, setItems] = useState([
    {
      id: 'users',
      rowSpan: 4,
      columnSpan: 4,
      data: { title: 'System Users', content: null }
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

    // Fetch evaluators data
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/intake-officers`)
      .then(response => response.json())
      .then(data => setEvaluators(data))
      .catch(error => {
        console.error('Error fetching evaluators:', error);
        setError('Error fetching evaluators');
      });
  }, []);

  const userColumns = [
    { id: 'userId', header: 'User ID', cell: item => item.id },
    { id: 'userName', header: 'User Name', cell: item => item.name },
    { id: 'userEmail', header: 'Email', cell: item => item.email },
    { id: 'userRole', header: 'Role(s)', cell: item => item.role },
    { id: 'modify', header: '', cell: item => <Link href={`/admin-modify-user/${item.id}`}>Modify</Link> },
  ];

  const roleColumns = [
    { id: 'roleValue', header: 'Role Value', cell: item => item.value },
    { id: 'roleLabel', header: 'Role Name', cell: item => item.label },
  ];

  const evaluatorColumns = [
    { id: 'evaluatorId', header: 'Evaluator ID', cell: item => item.evaluator_id || item.id },
    { id: 'evaluatorName', header: 'Name', cell: item => item.evaluator_name || item.name },
    { id: 'evaluatorEmail', header: 'Email', cell: item => item.evaluator_email || item.email },
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
        items={items} // FIX: Pass items prop to Board
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
            {/* Modularize board item rendering for robustness */}
            {item.id === 'users' && (
              <UserBoardItem users={users} evaluators={evaluators} error={error} />
            )}
            {item.id === 'roles' && (
              <RolesBoardItem roles={roles} error={error} />
            )}
          </BoardItem>
        )}
      />
    </ContentLayout>
  );
};

// Modular board item components for robustness and maintainability
function UserBoardItem({ users, evaluators, error }) {
  const userColumns = [
    { id: 'userId', header: 'User ID', cell: item => item.id },
    { id: 'userName', header: 'User Name', cell: item => item.name },
    { id: 'userEmail', header: 'Email', cell: item => item.email },
    { id: 'userRole', header: 'Role(s)', cell: item => item.role },
    { id: 'modify', header: '', cell: item => <Link href={`/admin-modify-user/${item.id}`}>Modify</Link> },
  ];

  const evaluatorColumns = [
    { id: 'evaluatorId', header: 'Evaluator ID', cell: item => item.evaluator_id || item.id },
    { id: 'evaluatorName', header: 'Name', cell: item => item.evaluator_name || item.name },
    { id: 'evaluatorEmail', header: 'Email', cell: item => item.evaluator_email || item.email },
  ];

  return (
    <>
      <Box variant="small" margin={{ bottom: 's' }}>
        This section lists all registered users and regional coordinators in the system. Use the search and filter options to find users or coordinators, and use the Modify link to edit user details.
      </Box>
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
            Registered Applicants
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
      <Box margin={{ top: 'l' }} />
      <Table
        columnDefinitions={evaluatorColumns}
        items={evaluators}
        ariaLabels={{
          selectionGroupLabel: "Evaluators selection",
          allItemsSelectionLabel: () => "select all",
          itemSelectionLabel: ({ selectedItems }, item) => item.evaluator_name || item.name,
        }}
        renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
          `Displaying evaluators ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
        }
        loadingText="Loading evaluators"
        selectionType="multi"
        trackBy="evaluator_id"
        empty={
          <Box margin={{ vertical: "xs" }} textAlign="center" color="inherit">
            <SpaceBetween size="m">
              <b>No evaluators</b>
            </SpaceBetween>
          </Box>
        }
        filter={
          <TextFilter
            filteringPlaceholder="Find evaluators"
            filteringText=""
            countText="0 matches"
          />
        }
        header={<Header>Regional Coordinators</Header>}
        pagination={
          <Pagination currentPageIndex={1} pagesCount={Math.ceil(evaluators.length / 10)} />
        }
      />
    </>
  );
}

function RolesBoardItem({ roles, error }) {
  const roleColumns = [
    { id: 'roleId', header: 'Role ID', cell: item => item.id },
    { id: 'roleName', header: 'Role Name', cell: item => item.name },
    { id: 'roleDescription', header: 'Description', cell: item => item.description },
  ];

  return (
    <>
      <Box variant="small" margin={{ bottom: 's' }}>
        This section displays all available roles in the system. Roles determine user permissions and access levels.
      </Box>
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
            Available Roles
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
              }
            }}
          />
        }
      />
    </>
  );
}

export default UserManagementDashboard;
