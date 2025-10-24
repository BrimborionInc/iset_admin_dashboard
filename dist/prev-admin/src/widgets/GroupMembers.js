import React, { useState } from 'react';
import { Box, Container, Header, FormField, Input, Button, Select, AttributeEditor, Alert } from '@cloudscape-design/components';
import axios from 'axios'; // Import axios for making API calls

const GroupMembers = ({ appointmentData, setAppointmentData }) => {
    const [bilReferenceInput, setBilReferenceInput] = useState('');
    const [bilReferenceError, setBilReferenceError] = useState(''); // State for BIL reference error message
    const [bilReferenceSuccess, setBilReferenceSuccess] = useState(''); // State for BIL reference success message

    const handleAddMember = async () => {
        const newMembers = [...appointmentData.members];
        const lastMember = newMembers[newMembers.length - 1];

        // Validation
        let hasError = false;
        if (newMembers.length > 0) {
            if (!lastMember.name) {
                lastMember.nameError = 'Member name is required.';
                hasError = true;
            } else {
                lastMember.nameError = '';
            }

            if (!lastMember.relationship) {
                lastMember.relationshipError = 'Relationship is required.';
                hasError = true;
            } else {
                lastMember.relationshipError = '';
            }

            if (String(appointmentData.serviceType) === '1') {
                const duplicateBil = newMembers.some((member, index) => member.bilReference === lastMember.bilReference && index !== newMembers.length - 1);
                if (duplicateBil) {
                    lastMember.bilReferenceError = 'Duplicate BIL Reference with other member!';
                    hasError = true;
                } else if (lastMember.bilReference === appointmentData.bilReference) {
                    lastMember.bilReferenceError = 'BIL Reference same as the main booking!';
                    hasError = true;
                } else if (lastMember.bilReference.length !== 13) {
                    lastMember.bilReferenceError = 'BIL Reference must be 13 digits long!';
                    hasError = true;
                } else {
                    // Server-side validation
                    try {
                        const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/check-bil-usage`, { bilReference: lastMember.bilReference });
                        if (response.data.message === 'BIL Reference already used') {
                            lastMember.bilReferenceError = 'BIL Reference already used.';
                            hasError = true;
                        } else {
                            lastMember.bilReferenceError = '';
                        }
                    } catch (error) {
                        if (error.response && error.response.status === 400) {
                            lastMember.bilReferenceError = error.response.data.message; // Display the error message from the server
                        } else {
                            lastMember.bilReferenceError = 'Failed to validate BIL Reference.';
                        }
                        hasError = true;
                    }
                }
            }

            setAppointmentData(prev => ({ ...prev, members: newMembers }));
        }

        if (!hasError) {
            const newMember = {
                name: '',
                relationship: null,
                bilReference: ''
            };

            setAppointmentData(prev => ({
                ...prev,
                members: [...prev.members, newMember]
            }));
        }
    };

    const handleRemoveMember = (index) => {
        setAppointmentData(prev => ({
            ...prev,
            members: prev.members.filter((_, i) => i !== index)
        }));
    };

    const handleBilReferenceInputChange = (e) => {
        setBilReferenceInput(e.detail.value);
    };

    const handleBilReferenceSubmit = async () => {
        // Client-side validation
        const bilReferencePattern = /^[0-9]{13}$/;
        if (!bilReferencePattern.test(bilReferenceInput)) {
            setBilReferenceError('BIL Reference must be a 13-digit number.');
            setBilReferenceSuccess('');
            return;
        }

        // Server-side validation
        try {
            const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/check-bil-usage`, { bilReference: bilReferenceInput });
            if (response.data.message === 'BIL Reference already used') {
                setBilReferenceError('BIL Reference already used.');
                setBilReferenceSuccess('');
                return;
            }
            setBilReferenceSuccess('BIL Reference is valid.');
            setBilReferenceError('');
            setAppointmentData(prev => ({ ...prev, memberBilReference: bilReferenceInput }));
        } catch (error) {
            if (error.response && error.response.status === 400) {
                setBilReferenceError(error.response.data.message); // Display the error message from the server
            } else {
                setBilReferenceError('Failed to validate BIL Reference.');
            }
            setBilReferenceSuccess('');
        }
    };

    const handleMemberNameChange = (e, index) => {
        const newMembers = [...appointmentData.members];
        newMembers[index].name = e.detail.value;
        setAppointmentData(prev => ({ ...prev, members: newMembers }));
    };

    const handleRelationshipChange = (e, index) => {
        const newMembers = [...appointmentData.members];
        newMembers[index].relationship = e.detail.selectedOption;
        setAppointmentData(prev => ({ ...prev, members: newMembers }));
    };

    const handleBilReferenceChange = (e, index) => {
        const newMembers = [...appointmentData.members];
        newMembers[index].bilReference = e.detail.value;
        setAppointmentData(prev => ({ ...prev, members: newMembers }));
    };

    const maxMembers = 5;
    const disableAddButton = appointmentData.members.length >= maxMembers;

    return (
        <Container display="flex" flexDirection="column">
            <Header variant="h2">Group Members</Header>
            <AttributeEditor
                removeButtonText="X"
                items={appointmentData.members ?? []} // Ensures the array is always valid
                onAddButtonClick={() => handleAddMember()}
                onRemoveButtonClick={({ detail: { itemIndex } }) => handleRemoveMember(itemIndex)}
                addButtonText="Add new member"
                disableAddButton={disableAddButton}
                gridLayout={[
                    {
                      rows: [String(appointmentData.serviceType) === '1' ? [1, 1, 1] : [1, 1]],
                      removeButton: { ownRow: false, width: "auto" },
                    }
                  ]}
                definition={[
                    {
                        label: 'Member Name',
                        control: (item, index) => (
                            <FormField errorText={item.nameError}>
                                <Input
                                    value={item.name}
                                    onChange={(e) => handleMemberNameChange(e, index)}
                                    placeholder="Enter member name"
                                />
                            </FormField>
                        ),
                    },
                    {
                        label: 'Relationship',
                        control: (item, index) => (
                            <FormField errorText={item.relationshipError}>
                                <Select
                                    selectedOption={item.relationship}
                                    onChange={(e) => handleRelationshipChange(e, index)}
                                    options={[
                                        { label: 'Group Member', value: 'Group Member' },
                                        { label: 'Child', value: 'Child' },
                                        { label: 'Spouse', value: 'Spouse' },
                                        { label: 'Parent', value: 'Parent' },
                                        { label: 'Other', value: 'Other' }
                                    ]}
                                    placeholder="Select relationship"
                                />
                            </FormField>
                        ),
                    },
                    ...(String(appointmentData.serviceType) === '1' ? [
                        {
                            label: 'BIL Reference',
                            control: (item, index) => (
                                <FormField
                                    errorText={item.bilReferenceError}
                                    constraintText={`Character count: ${item.bilReference.length}/13`}
                                >
                                    <Input
                                        value={item.bilReference}
                                        onChange={(e) => handleBilReferenceChange(e, index)}
                                        placeholder="Enter BIL Reference"
                                    />
                                </FormField>
                            ),
                        }
                    ] : [])
                ]}
                additionalInfo={
                    disableAddButton
                        ? "You have reached the limit of 5 members."
                        : `You can add up to ${maxMembers - appointmentData.members.length} more members.`
                }
                empty={
                    <Box textAlign="center" color="inherit">
                        <b>No members added</b>
                    </Box>
                }
            />
        </Container>
    );
};

export default GroupMembers;
