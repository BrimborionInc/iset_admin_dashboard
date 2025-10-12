import React, { useState, useEffect } from 'react';
import { Wizard, Container, Header, SpaceBetween, FormField, Select, Input, Textarea, Button, Box, Alert, StatusIndicator } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import GroupMembers from './GroupMembers'; // Import GroupMembers
import axios from 'axios'; // Import axios for making API calls

const SlotSearchWizard = ({ appointmentData, setAppointmentData, onSearchSlots }) => {
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [serviceOptions, setServiceOptions] = useState([]);
    const [countryOptions, setCountryOptions] = useState([]);
    const [locationOptions, setLocationOptions] = useState([]);
    const [languageOptions, setLanguageOptions] = useState([]);
    const [reasonCodes, setReasonCodes] = useState([]); // Add state for reason codes
    const [bilReferenceInput, setBilReferenceInput] = useState('');
    const [bilReferenceError, setBilReferenceError] = useState(''); // State for BIL reference error message
    const [bilReferenceSuccess, setBilReferenceSuccess] = useState(''); // State for BIL reference success message
    const [groupBookingOption, setGroupBookingOption] = useState({ label: 'No', value: 'no' }); // Default to No
    const [interpreterNeededOption, setInterpreterNeededOption] = useState({ label: 'No', value: 'no' }); // Default to No
    const [noChargeReferralOption, setNoChargeReferralOption] = useState({ label: 'No', value: 'no' }); // Default to No
    const [extraTimeOption, setExtraTimeOption] = useState({ label: 'No', value: 'no' }); // Default to No

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
        setBilReferenceInput(''); // Clear BIL reference input
        setBilReferenceError(''); // Clear BIL reference error
        setBilReferenceSuccess(''); // Clear BIL reference success

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
        setBilReferenceSuccess(''); // Revert to the Validate BIL button if input changes
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
            setAppointmentData(prev => ({ ...prev, bilReference: bilReferenceInput }));
        } catch (error) {
            if (error.response && error.response.status === 400) {
                setBilReferenceError(error.response.data.message); // Display the error message from the server
            } else {
                setBilReferenceError('Failed to validate BIL Reference.');
            }
            setBilReferenceSuccess('');
        }
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
    };

    const handlePreferredLanguageChange = ({ detail }) => {
        setAppointmentData(prev => ({ ...prev, preferredLanguage: detail.selectedOption.value }));
        // Remove automatic step advancement
        // setActiveStepIndex(5);
    };

    const handleInterpreterNeededChange = ({ detail }) => {
        const interpreterNeeded = detail.selectedOption.value;
        setAppointmentData(prev => ({
            ...prev,
            interpreterNeeded,
            interpreterLanguage: interpreterNeeded === 'no' ? null : prev.interpreterLanguage // Clear interpreter language if "No" is selected
        }));
        setInterpreterNeededOption(detail.selectedOption); // Update the selected option
    };

    const handleInterpreterLanguageChange = ({ detail }) => {
        setAppointmentData(prev => ({ ...prev, interpreterLanguage: detail.selectedOption.value }));
        // Remove automatic step advancement
        // setActiveStepIndex(6);
    };

    const handleExtraTimeChange = ({ detail }) => {
        setAppointmentData(prev => ({ ...prev, extraTime: detail.selectedOption.value }));
        setExtraTimeOption(detail.selectedOption); // Update the selected option
        // Remove automatic step advancement
        // setActiveStepIndex(7);
    };

    const handleAdditionalNotesChange = (e) => {
        const value = e.detail.value;
        if (value.length <= 255) {
            setAppointmentData(prev => ({ ...prev, additionalNotes: value }));
            // Remove the Save Notes button logic
            // setShowSaveNotesButton(true);
        }
    };

    const handleNoChargeReferralChange = ({ detail }) => {
        const selectedValue = detail.selectedOption.value === 'no' ? null : detail.selectedOption.value;
        setAppointmentData(prev => ({ ...prev, noChargeReferral: selectedValue }));
        setNoChargeReferralOption(detail.selectedOption); // Update the selected option
    };

    const handleGroupBookingChange = ({ detail }) => {
        const isGroup = detail.selectedOption.value === 'yes';
        setAppointmentData(prev => ({
            ...prev,
            is_group: isGroup ? 1 : 0,
            members: isGroup ? prev.members : [] // Clear members if not a group booking
        }));
        setGroupBookingOption(detail.selectedOption); // Update the selected option
    };

    const validateStep = async (stepIndex) => {
        switch (stepIndex) {
            case 0:
                return !!appointmentData.serviceType && (String(appointmentData.serviceType) !== '1' || !!bilReferenceInput);
            case 1:
                return !!noChargeReferralOption;
            case 2:
                return !!appointmentData.country;
            case 3:
                return !!appointmentData.location;
            case 4:
                if (appointmentData.is_group) {
                    // Server-side validation for BIL references
                    const bilReferences = appointmentData.members.map(member => member.bilReference).filter(Boolean);
                    try {
                        const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/check-bil-usage`, { bilReferences });
                        const { invalidBilReferences } = response.data;
                        if (invalidBilReferences && invalidBilReferences.length > 0) {
                            // Flag errors for invalid BIL references
                            const newMembers = appointmentData.members.map(member => ({
                                ...member,
                                bilReferenceError: invalidBilReferences.includes(member.bilReference) ? 'Invalid BIL Reference' : ''
                            }));
                            setAppointmentData(prev => ({ ...prev, members: newMembers }));
                            return false;
                        }
                    } catch (error) {
                        if (error.response && error.response.status === 400) {
                            setBilReferenceError(error.response.data.message); // Display the error message from the server
                        } else {
                            setBilReferenceError('Failed to validate BIL Reference.');
                        }
                        setBilReferenceSuccess('');
                    }
                }
                return appointmentData.is_group ? appointmentData.members.length > 0 : true;
            case 5:
                return !!appointmentData.preferredLanguage;
            case 6:
                return !!appointmentData.extraTime;
            case 7:
                return !!appointmentData.additionalNotes;
            default:
                return true;
        }
    };

    const handleNavigate = async ({ detail }) => {
        if (await validateStep(activeStepIndex) || detail.requestedStepIndex < activeStepIndex) {
            setActiveStepIndex(detail.requestedStepIndex);
        }
    };

    const handleCancel = () => {
        setAppointmentData({
            userId: null,
            serviceType: null,
            bilReference: '',
            country: null,
            location: null,
            is_group: 0,
            members: [],
            extraTime: 'no',
            preferredLanguage: null,
            interpreterNeeded: 'no',
            interpreterLanguage: null,
            additionalServices: [],
            additionalNotes: '',
            date: null,
            time: null,
        });
        setBilReferenceInput('');
        setBilReferenceError('');
        setBilReferenceSuccess('');
        setGroupBookingOption({ label: 'No', value: 'no' });
        setInterpreterNeededOption({ label: 'No', value: 'no' });
        setNoChargeReferralOption({ label: 'No', value: 'no' });
        setExtraTimeOption({ label: 'No', value: 'no' });
        setActiveStepIndex(0);
    };

    const handleSubmit = () => {
        console.log('Appointment Data:', appointmentData);
        onSearchSlots(appointmentData.location, appointmentData.is_group, appointmentData.serviceType);
    };

    return (
        <BoardItem
            header={<Header variant="h2">Slot Search Wizard</Header>}
            i18nStrings={{
                dragHandleAriaLabel: 'Drag handle',
                dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
                resizeHandleAriaLabel: 'Resize handle',
                resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
            }}
        >
            <Wizard
                i18nStrings={{
                    stepNumberLabel: stepNumber => `Step ${stepNumber}`,
                    collapsedStepsLabel: (stepNumber, stepsCount) => `Step ${stepNumber} of ${stepsCount}`,
                    skipToButtonLabel: (step, stepNumber) => `Skip to ${step.title}`,
                    navigationAriaLabel: 'Steps',
                    cancelButton: 'Cancel',
                    previousButton: 'Previous',
                    nextButton: 'Next',
                    submitButton: 'Submit',
                    optional: 'optional',
                }}
                onNavigate={handleNavigate}
                activeStepIndex={activeStepIndex}
                submitButtonText="Search for Slots"
                allowSkipTo
                onCancel={handleCancel}
                onSubmit={handleSubmit}
                steps={[
                    {
                        title: 'Choose service type',
                        description: "Please select a service type. For biometric collections, you are required to enter and validate a BIL number for the individual. For group and family bookings, you will be asked for additional group member BILs at a later step. Validation checks the that BIL has not been used before for any bookings.",
                        content: (
                            <Container>
                                <SpaceBetween direction="vertical" size="l">
                                    <FormField label="What service type?">
                                        <Select
                                            selectedOption={serviceOptions.find(opt => opt.value === appointmentData.serviceType) || null}
                                            onChange={handleServiceTypeChange}
                                            options={serviceOptions}
                                            placeholder="Select service type"
                                        />
                                    </FormField>
                                    {String(appointmentData.serviceType) === '1' && (
                                        <FormField
                                            label="Enter BIL Number"
                                            errorText={bilReferenceError} // Display error message
                                            constraintText={`Character count: ${bilReferenceInput.length}/13`} // Add character count
                                            secondaryControl={
                                                bilReferenceSuccess ? (
                                                    <StatusIndicator type="success">BIL Reference is valid</StatusIndicator>
                                                ) : (
                                                    <Button variant="normal" onClick={handleBilReferenceSubmit}>Validate BIL</Button>
                                                )
                                            }
                                        >
                                            <Input
                                                value={bilReferenceInput}
                                                onChange={handleBilReferenceInputChange}
                                                placeholder="Enter BIL Reference"
                                            />
                                            {/* Remove the success alert box */}
                                            {/* {bilReferenceSuccess && <Alert type="success">{bilReferenceSuccess}</Alert>} */}
                                        </FormField>
                                    )}
                                </SpaceBetween>
                            </Container>
                        ),
                    },
                    {
                        title: 'Choose country and location',
                        description: "Please select the country and preferred location for the appointment.  You will be able to view availability at other locations once you have completed the wizard.",
                        content: (
                            <Container>
                                <SpaceBetween direction="vertical" size="l">
                                    <FormField label="Which country?">
                                        <Select
                                            selectedOption={countryOptions.find(opt => opt.value === appointmentData.country) || null}
                                            onChange={handleCountryChange}
                                            options={countryOptions}
                                            placeholder="Select country"
                                        />
                                    </FormField>
                                    {appointmentData.country && (
                                        <FormField label="Preferred location?">
                                            <Select
                                                selectedOption={locationOptions.find(opt => opt.value === appointmentData.location) || null}
                                                onChange={handleLocationChange}
                                                options={locationOptions}
                                                placeholder="Select location"
                                            />
                                        </FormField>
                                    )}
                                </SpaceBetween>
                            </Container>
                        ),
                    },
                    {
                        title: 'Group booking?',
                        description: "Indicate whether this is a group or family booking. If yes, you will be prompted to add group members.  The name should be exactly as it appears in the Passport and on the BIL.  For Biometric Collection appointments each group or family member must have their own BIL.  Enter and validate the BILs before proceeding to the next step.",
                        content: (
                            <Container>
                                <SpaceBetween direction="vertical" size="l">
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
                                    {appointmentData.is_group === 1 && (
                                        <>
                                            <GroupMembers appointmentData={appointmentData} setAppointmentData={setAppointmentData} />
                                        </>
                                    )}
                                </SpaceBetween>
                            </Container>
                        ),
                    },
                    {
                        title: 'Preferred language',
                        description: "Select the preferred language for the appointment.  The list of languages is for the location you selected earlier.  If no languages are shown then the location has not been properly configured. Speak to your admin",
                        content: (
                            <Container>
                                <SpaceBetween direction="vertical" size="l">
                                    <FormField label="Preferred language?">
                                        <Select
                                            selectedOption={languageOptions.find(opt => opt.value === appointmentData.preferredLanguage) || null}
                                            onChange={handlePreferredLanguageChange}
                                            options={languageOptions}
                                            placeholder="Select preferred language"
                                        />
                                    </FormField>
                                </SpaceBetween>
                            </Container>
                        ),
                    },
                    {
                        title: 'Interpreter needed?',
                        description: "Indicate whether you need an interpreter for the appointment. If yes, select the interpreter language.  Availability is by location.",
                        content: (
                            <Container>
                                <SpaceBetween direction="vertical" size="l">
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
                                    {appointmentData.interpreterNeeded === 'yes' && (
                                        <FormField label="Interpreter language?">
                                            <Select
                                                selectedOption={languageOptions.find(opt => opt.value === appointmentData.interpreterLanguage) || null}
                                                onChange={handleInterpreterLanguageChange}
                                                options={languageOptions}
                                                placeholder="Select interpreter language"
                                            />
                                        </FormField>
                                    )}
                                </SpaceBetween>
                            </Container>
                        ),
                    },
                    {
                        title: 'Need Extra Time?',
                        description: "Indicate whether you need extra time for the appointment.  This will search for 20% longer slots, which may limit availability.  Don't select this unless it is necessary.",
                        content: (
                            <Container>
                                <SpaceBetween direction="vertical" size="l">
                                    <FormField label="Need Extra Time?">
                                        <Select
                                            selectedOption={extraTimeOption} // Reflect the selected option
                                            onChange={handleExtraTimeChange}
                                            options={[
                                                { label: 'Yes', value: 'yes' },
                                                { label: 'No', value: 'no' }
                                            ]}
                                            placeholder="Select yes or no"
                                        />
                                    </FormField>
                                </SpaceBetween>
                            </Container>
                        ),
                    },
                    {
                        title: 'No Charge Referral?',
                        description: "Select a reason code if this is a no charge referral.  Reason codes are specific to service types and may be viewed and edited by administrators in the code table console.",
                        content: (
                            <Container>
                                <SpaceBetween direction="vertical" size="l">
                                    <FormField label="No Charge Referral?">
                                        <Select
                                            selectedOption={noChargeReferralOption} // Reflect the selected option
                                            onChange={handleNoChargeReferralChange}
                                            options={reasonCodes}
                                            placeholder="Select reason code"
                                        />
                                    </FormField>
                                </SpaceBetween>
                            </Container>
                        ),
                    },
                    {
                        title: 'Additional notes',
                        description: "Enter any additional notes for the appointment.  These notes will be available to be viewed by staff at the location, and by signed-in applicants viewing their My Appointments page.",
                        content: (
                            <Container>
                                <SpaceBetween direction="vertical" size="l">
                                    <FormField label="Additional notes?">
                                        <Textarea
                                            value={appointmentData.additionalNotes}
                                            onChange={handleAdditionalNotesChange}
                                            placeholder="Enter additional notes"
                                            maxLength={255}
                                        />
                                    </FormField>
                                </SpaceBetween>
                            </Container>
                        ),
                    },
                ]}
                cancelButtonText={activeStepIndex > 0 ? "Cancel" : undefined}
            />
        </BoardItem>
    );
};

export default SlotSearchWizard;
