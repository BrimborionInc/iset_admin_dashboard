import React, { useEffect, useState } from 'react';
import { Box, Header, FormField, Select, Button, Input, Textarea } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import GroupMembers from './GroupMembers'; // Import GroupMembers
import axios from 'axios'; // Import axios for making API calls

const SlotSearch = ({ appointmentData, setAppointmentData, onSearchSlots }) => {
    const [serviceOptions, setServiceOptions] = useState([]);
    const [countryOptions, setCountryOptions] = useState([]);
    const [locationOptions, setLocationOptions] = useState([]);
    const [languageOptions, setLanguageOptions] = useState([]);
    const [reasonCodes, setReasonCodes] = useState([]); // Add state for reason codes
    const [currentStep, setCurrentStep] = useState(1);
    const [bilReferenceInput, setBilReferenceInput] = useState('');
    const [bilReferenceError, setBilReferenceError] = useState(''); // State for BIL reference error message
    const [showSaveNotesButton, setShowSaveNotesButton] = useState(true); // State to control Save Notes button visibility
    const [groupBookingOption, setGroupBookingOption] = useState(null); // State to control selected group booking option
    const [interpreterNeededOption, setInterpreterNeededOption] = useState(null); // State to control selected interpreter needed option
    const [noChargeReferralOption, setNoChargeReferralOption] = useState(null); // State to control selected no charge referral option

    useEffect(() => {
        // Fetch available service types
        fetch(`${process.env.REACT_APP_API_BASE_URL}/api/services`)
            .then(response => response.json())
            .then(data => setServiceOptions(data.map(service => ({ label: service.name, value: service.id }))))
            .catch(error => console.error('Error fetching services:', error));

        // Fetch available countries
        fetch(`${process.env.REACT_APP_API_BASE_URL}/api/countries`)
            .then(response => response.json())
            .then(data => setCountryOptions(data.map(country => ({ label: country.name, value: country.id }))))
            .catch(error => console.error('Error fetching countries:', error));
    }, []);

    const handleServiceTypeChange = async ({ detail }) => {
        const isBiometricCollection = String(detail.selectedOption.value) === '1';
        setAppointmentData(prev => ({
            ...prev,
            serviceType: detail.selectedOption.value,
            bilReference: isBiometricCollection ? prev.bilReference : '', // Reset BIL Reference if service type changes
        }));
        setCurrentStep(isBiometricCollection ? 2 : 3); // Set to 2 if Biometric Collection, otherwise 3

        // Fetch reason codes for the selected service type
        try {
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/reason-codes/${detail.selectedOption.value}`);
            const data = await response.json();
            setReasonCodes([{ label: 'No', value: 'no' }, ...data.map(code => ({ label: code.code, value: code.id }))]);
        } catch (error) {
            console.error('Error fetching reason codes:', error);
        }
    };

    const handleBilReferenceInputChange = (e) => {
        setBilReferenceInput(e.detail.value);
    };

    const handleBilReferenceSubmit = async () => {
        // Client-side validation
        const bilReferencePattern = /^[0-9]{13}$/;
        if (!bilReferencePattern.test(bilReferenceInput)) {
            setBilReferenceError('BIL Reference must be a 13-digit number.');
            return;
        }

        // Server-side validation
        try {
            const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/check-bil-usage`, { bilReference: bilReferenceInput });
            if (response.data.message === 'BIL Reference already used') {
                setBilReferenceError('BIL Reference already used.');
                return;
            }
        } catch (error) {
            if (error.response && error.response.status === 400) {
                setBilReferenceError(error.response.data.message); // Display the error message from the server
            } else {
                setBilReferenceError('Failed to validate BIL Reference.');
            }
            return;
        }

        setBilReferenceError(''); // Clear error message if validation passes
        setAppointmentData(prev => ({ ...prev, bilReference: bilReferenceInput }));
        setCurrentStep(3);
    };

    const handleCountryChange = async ({ detail }) => {
        setAppointmentData(prev => ({ ...prev, country: detail.selectedOption.value, location: null }));
        try {
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations?country=${detail.selectedOption.value}`);
            const data = await response.json();
            setLocationOptions(data.map(location => ({ label: location.location, value: location.id })));
        } catch (error) {
            console.error('Error fetching locations:', error);
        }
        setCurrentStep(5);
    };

    const handleLocationChange = async ({ detail }) => {
        setAppointmentData(prev => ({ ...prev, location: detail.selectedOption.value }));
        try {
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations/${detail.selectedOption.value}/languages`);
            const data = await response.json();
            setLanguageOptions(data.map(language => ({ label: language.name, value: language.id })));
        } catch (error) {
            console.error('Error fetching languages:', error);
        }
        setCurrentStep(6);
    };

    const handlePreferredLanguageChange = ({ detail }) => {
        setAppointmentData(prev => ({ ...prev, preferredLanguage: detail.selectedOption.value }));
        setCurrentStep(7);
    };

    const handleInterpreterNeededChange = ({ detail }) => {
        setAppointmentData(prev => ({ ...prev, interpreterNeeded: detail.selectedOption.value }));
        setInterpreterNeededOption(detail.selectedOption); // Update the selected option
        setCurrentStep(detail.selectedOption.value === 'yes' ? 8 : 9);
    };

    const handleInterpreterLanguageChange = ({ detail }) => {
        setAppointmentData(prev => ({ ...prev, interpreterLanguage: detail.selectedOption.value }));
        setCurrentStep(9);
    };

    const handleAdditionalNotesChange = (e) => {
        const value = e.detail.value;
        if (value.length <= 255) {
            setAppointmentData(prev => ({ ...prev, additionalNotes: value }));
            setShowSaveNotesButton(true); // Show the Save Notes button if the notes field is changed
        }
    };

    const handleSaveNotes = () => {
        setCurrentStep(11); // Move to the next step when the Save Notes button is clicked
        setShowSaveNotesButton(false); // Hide the Save Notes button after it is clicked
    };

    const handleNoChargeReferralChange = ({ detail }) => {
        setAppointmentData(prev => ({ ...prev, noChargeReferral: detail.selectedOption.value }));
        setNoChargeReferralOption(detail.selectedOption); // Update the selected option
        setCurrentStep(4); // Move to the next step when an option is selected
    };

    const handleGroupBookingChange = ({ detail }) => {
        const isGroup = detail.selectedOption.value === 'yes';
        setAppointmentData(prev => ({
            ...prev,
            is_group: isGroup ? 1 : 0,
            members: isGroup ? prev.members : [] // Clear members if not a group booking
        }));
        setGroupBookingOption(detail.selectedOption); // Update the selected option
        setCurrentStep(isGroup ? 12 : 13);
    };

    const handleSearchSlots = () => {
        console.log('Appointment Data:', JSON.stringify(appointmentData, null, 2)); // Log the JSON data
        if (onSearchSlots) {
            onSearchSlots(appointmentData.location, appointmentData.is_group, appointmentData.serviceType);
        }
    };

    return (
        <BoardItem
            header={<Header variant="h2">Slot Search</Header>}
            i18nStrings={{
                dragHandleAriaLabel: 'Drag handle',
                dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
                resizeHandleAriaLabel: 'Resize handle',
                resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
            }}
        >
            <Box display="flex" flexDirection="column">
                {currentStep >= 1 && (
                    <FormField label="What service type?">
                        <Select
                            selectedOption={serviceOptions.find(opt => opt.value === appointmentData.serviceType) || null}
                            onChange={handleServiceTypeChange}
                            options={serviceOptions}
                            placeholder="Select service type"
                        />
                    </FormField>
                )}

                {String(appointmentData.serviceType) === '1' && currentStep === 2 && (
                    <FormField
                        label="Enter BIL Number"
                        errorText={bilReferenceError} // Display error message
                        secondaryControl={<Button variant="primary" iconName="send" onClick={handleBilReferenceSubmit} />}
                    >
                        <Input
                            value={bilReferenceInput}
                            onChange={handleBilReferenceInputChange}
                            placeholder="Enter BIL Reference"
                            style={{ maxWidth: '100px' }} // Override to set maximum width
                        />
                    </FormField>
                )}

                {currentStep >= 3 && (
                    <FormField label="No Charge Referral?">
                        <Select
                            selectedOption={noChargeReferralOption} // Reflect the selected option
                            onChange={handleNoChargeReferralChange}
                            options={reasonCodes}
                            placeholder="Select reason code"
                        />
                    </FormField>
                )}

                {currentStep >= 4 && (
                    <FormField label="Which country?">
                        <Select
                            selectedOption={countryOptions.find(opt => opt.value === appointmentData.country) || null}
                            onChange={handleCountryChange}
                            options={countryOptions}
                            placeholder="Select country"
                        />
                    </FormField>
                )}

                {currentStep >= 5 && appointmentData.country && (
                    <FormField label="Preferred location?">
                        <Select
                            selectedOption={locationOptions.find(opt => opt.value === appointmentData.location) || null}
                            onChange={handleLocationChange}
                            options={locationOptions}
                            placeholder="Select location"
                        />
                    </FormField>
                )}

                {currentStep >= 6 && (
                    <FormField label="Preferred language?">
                        <Select
                            selectedOption={languageOptions.find(opt => opt.value === appointmentData.preferredLanguage) || null}
                            onChange={handlePreferredLanguageChange}
                            options={languageOptions}
                            placeholder="Select preferred language"
                        />
                    </FormField>
                )}

                {currentStep >= 7 && (
                    <FormField label="Do you need an interpreter?">
                        <Select
                            selectedOption={interpreterNeededOption} // Reflect the selected option
                            onChange={handleInterpreterNeededChange}
                            options={[
                                { label: 'Yes', value: 'yes' },
                                { label: 'No', value: 'no' }
                            ]}
                            placeholder="Select yes or no"
                        />
                    </FormField>
                )}

                {currentStep >= 8 && appointmentData.interpreterNeeded === 'yes' && (
                    <FormField label="Interpreter language?">
                        <Select
                            selectedOption={languageOptions.find(opt => opt.value === appointmentData.interpreterLanguage) || null}
                            onChange={handleInterpreterLanguageChange}
                            options={languageOptions}
                            placeholder="Select interpreter language"
                        />
                    </FormField>
                )}

                {currentStep >= 9 && (
                    <FormField label="Additional notes?">
                        <Textarea
                            value={appointmentData.additionalNotes}
                            onChange={handleAdditionalNotesChange}
                            placeholder="Enter additional notes"
                            maxLength={255}
                        />
                        {showSaveNotesButton && (
                            <Button variant="primary" onClick={handleSaveNotes}>
                                Save Notes
                            </Button>
                        )}
                    </FormField>
                )}

                {currentStep >= 11 && (
                    <FormField label="Is this a group or family booking?">
                        <Select
                            selectedOption={groupBookingOption} // Reflect the selected option
                            onChange={handleGroupBookingChange}
                            options={[
                                { label: 'Yes', value: 'yes' },
                                { label: 'No', value: 'no' }
                            ]}
                            placeholder="Select yes or no"
                        />
                    </FormField>
                )}

                {currentStep === 12 && (
                    <GroupMembers appointmentData={appointmentData} setAppointmentData={setAppointmentData} />
                )}

                {(currentStep === 13 || (currentStep === 12 && appointmentData.members.length > 0)) && (
                    <Box padding="m" textAlign="center">
                        <Button variant="primary" onClick={handleSearchSlots} disabled={!appointmentData.location}>
                            Search for Slots
                        </Button>
                    </Box>
                )}
            </Box>
        </BoardItem>
    );
};

export default SlotSearch;
