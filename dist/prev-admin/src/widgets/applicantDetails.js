import React, { useState, useEffect } from 'react';
import { Box, Header, ButtonDropdown, FormField, Input, Table, Button } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const ApplicantDetails = ({ actions, onBookNow, onUserSelect, onSelectUser }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);

    useEffect(() => {
        const handleSearch = async () => {
            if (searchQuery.trim() === '') {
                setSearchResults([]);
                return;
            }
            try {
                const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/search-users?query=${searchQuery}`);
                const data = await response.json();
                setSearchResults(data);
            } catch (error) {
                console.error('Error searching users:', error);
            }
        };

        const delayDebounceFn = setTimeout(() => {
            handleSearch();
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        console.log('Selected user:', user);
    };

    const handleInputChange = (e) => {
        setSearchQuery(e.detail.value);
        if (selectedUser) {
            setSelectedUser(null);
        }
    };

    const handleSelectUserClick = () => {
        if (selectedUser && onSelectUser) {
            console.log('Selected user:', selectedUser); // Debugging log
            const userOption = { label: selectedUser.email, value: selectedUser.id };
            console.log('User option:', userOption); // Debugging log
            onSelectUser(userOption);
        }
    };

    return (
        <BoardItem
            header={
                <Header
                    variant="h2"
                    actions={
                        <Button key="register" variant="normal">Register New User</Button>
                    }
                >
                    Find Registered User
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
            <Box display="flex" flexDirection="column">
                <Box display="flex" alignItems="center" gap="s" width="100%">
                    <Box flexGrow={1}>
                        <FormField label="Search For User Account">
                            <Input
                                placeholder="Enter name, email, or phone number"
                                value={searchQuery}
                                onChange={handleInputChange}
                            />
                        </FormField>
                    </Box>
                </Box>
                <Box margin={{ top: 'm' }}>
                    <Table
                        variant="embedded"
                        stripedRows
                        columnDefinitions={[
                            {
                                id: 'name',
                                cell: e => (
                                    <a href="#" onClick={(ev) => { ev.preventDefault(); handleSelectUser(e); }} style={{ textDecoration: 'none', color: 'black', display: 'block', cursor: 'pointer' }}>
                                        {e.name} ({e.email})
                                    </a>
                                )
                            }
                        ]}
                        items={searchResults}
                        empty={
                            <Box textAlign="center" color="inherit">
                                <b>No results found</b>
                                <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                                    No user accounts match your search criteria.
                                </Box>
                            </Box>
                        }
                    />
                </Box>
            </Box>
            {selectedUser && (
                <Table
                    variant="embedded"
                    stripedRows
                    columnDefinitions={[
                        {
                            id: 'label',
                            cell: e => e.label,
                        },
                        {
                            id: 'value',
                            cell: e => e.value,
                        }
                    ]}
                    items={[
                        { label: 'Name:', value: selectedUser.name },
                        { label: 'Email:', value: selectedUser.email },
                        { label: 'Phone:', value: selectedUser.phone_number }
                    ]}
                    empty={
                        <Box textAlign="center" color="inherit">
                            <b>No details available</b>
                        </Box>
                    }
                />
            )}
            {selectedUser && (
                <Box padding="m" textAlign="center">
                    <Button variant="primary" onClick={handleSelectUserClick} disabled={!selectedUser}>Select User</Button>
                </Box>
            )}
        </BoardItem>
    );
};

export default ApplicantDetails;