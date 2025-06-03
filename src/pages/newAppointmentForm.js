import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Header,
  Alert,
} from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import ApplicantDetails from '../widgets/applicantDetails';
import SlotSearchWizard from '../widgets/slotSearchWizard'; // Import SlotSearchWizard
import ViewSlotsWidget from '../widgets/ViewSlotsWidget'; // Import ViewSlotsWidget
import { useHistory } from 'react-router-dom'; // Import useHistory
import AppointmentConfirmed from '../widgets/AppointmentConfirmed'; // Import AppointmentConfirmed

const NewAppointmentForm = ({ header, headerInfo, toggleHelpPanel, updateBreadcrumbs }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showViewSlots, setShowViewSlots] = useState(false); // State to control ViewSlotsWidget visibility
  const [bookingDetails, setBookingDetails] = useState(null); // State to store booking details

  const [appointmentData, setAppointmentData] = useState({
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

  const [slots, setSlots] = useState([]); // Define slots state
  const [selectedDate, setSelectedDate] = useState(null); // Define selectedDate state
  const [selectedTime, setSelectedTime] = useState(null); // Define selectedTime state
  const [selectedLocation, setSelectedLocation] = useState(null); // Define selectedLocation state
  const [items, setItems] = useState([ // Define items state
    { id: 'applicant-details', rowSpan: 4, columnSpan: 1, data: { title: 'Applicant Details' } },
    { id: 'slot-search', rowSpan: 4, columnSpan: 3, data: { title: 'Slot Search' } },
    { id: 'view-slots', rowSpan: 6, columnSpan: 2, data: { title: 'View Slots' } }, // Add ViewSlotsWidget
    { id: 'appointment-confirmed', rowSpan: 6, columnSpan: 2, data: { title: 'Appointment Confirmed' } }, // Add this line
  ]);

  const history = useHistory(); // Define history

  useEffect(() => {
    updateBreadcrumbs([
      { text: 'Home', href: '/' },
      { text: 'New Appointment Form', href: '/new-appointment-form' },
    ]);
  }, [updateBreadcrumbs]);

  const handleBookNow = (user) => {
    console.log('Selected user:', user);
    setAppointmentData(prev => {
      const updatedData = { ...prev, userId: user.id };
      console.log('Updated appointmentData:', updatedData);
      return updatedData;
    });
    setSelectedUser(user); // Store full user object
    setCurrentStep(2); // Move to the next step to show SlotSearch widget
  };

  const handleItemsChange = (event) => {
    // Update the items state with the new layout
    setItems(event.detail.items);
    console.log('Items changed:', event.detail.items);
  };

  const handleSearchSlots = (location, isGroup, serviceType) => {
    setShowViewSlots(true); // Show the ViewSlotsWidget
    setAppointmentData(prev => ({ ...prev, location, is_group: isGroup, serviceType })); // Update appointmentData with search criteria
  };

  const handleBookingSuccess = (details) => {
    console.log('Booking details received:', details); // Add this line
    setBookingDetails(details);
    setCurrentStep(3); // Move to the next step to show AppointmentConfirmed widget
    console.log('Current step set to 3'); // Add this line
    // Refresh the available slots
    fetchAvailableSlots(appointmentData.location);
  };

  const fetchAvailableSlots = async (location) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/available-slots?location=${location}`);
      const data = await response.json();
      setSlots(data);
    } catch (error) {
      console.error('Error fetching available slots:', error);
    }
  };

  const handleUserSelect = (user) => {
    console.log('User selected:', user);
    setSelectedUser(user);
    setAppointmentData(prev => {
        const updatedData = { ...prev, userId: user.value };  // Ensure correct field is used
        console.log('Updated appointmentData:', updatedData);
        return updatedData;
    });
    setCurrentStep(2);
  };

  return (
    <ContentLayout
      header={
        <Header variant="h1" info={headerInfo}>
          {header}
        </Header>
      }
    >
      <Board
        renderItem={(item) => {
          if (item.id === 'applicant-details') {
            return <ApplicantDetails onSelectUser={handleUserSelect} />;
          }
          if (item.id === 'slot-search' && currentStep >= 2) {
            return <SlotSearchWizard appointmentData={appointmentData} setAppointmentData={setAppointmentData} onSearchSlots={handleSearchSlots} />; // Use SlotSearchWizard
          }
          if (item.id === 'view-slots' && showViewSlots) {
            return (
              <ViewSlotsWidget
                appointmentData={appointmentData}
                onSlotSelect={(slot) => {
                  console.log('Selected Slot:', slot);
                  setSelectedDate(slot.date.split('T')[0]);
                  setSelectedTime(slot.time);
                  setSelectedLocation(slot.location_id);
                }}
                onBookingSuccess={handleBookingSuccess} // Pass the callback
              />
            );
          }
          if (item.id === 'appointment-confirmed' && currentStep === 3) {
            console.log('Service Type:', appointmentData.serviceType); // Add this line
            return (
              <AppointmentConfirmed
                user={selectedUser.label}
                serviceType={appointmentData.serviceType}
                slot={{ date: selectedDate, time: selectedTime, location: selectedLocation }}
                bilNumber={appointmentData.bilReference}
                groupBooking={appointmentData.is_group ? 'Yes' : 'No'}
                bookingReference={bookingDetails.booking_reference} // Pass bookingReference as a prop
                onConfirm={() => history.push('/appointments')}
                onReset={() => window.location.reload()}
              />
            );
          }
          return null;
        }}
        items={items} // Pass the items state to the Board component
        onItemsChange={handleItemsChange} // Add the onItemsChange prop
        i18nStrings={{
          dragHandleAriaLabel: 'Drag handle',
          dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
          resizeHandleAriaLabel: 'Resize handle',
          resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
          liveAnnouncementDndStarted: (operationType) => `Started ${operationType}.`,
          liveAnnouncementDndItemReordered: (initialIndex, currentIndex, operationType) => `${operationType} item moved from position ${initialIndex + 1} to position ${currentIndex + 1}.`,
          liveAnnouncementDndItemResized: (initialWidth, initialHeight, currentWidth, currentHeight) => `Item resized from ${initialWidth} by ${initialHeight} to ${currentWidth} by ${currentHeight}.`,
          liveAnnouncementDndItemInserted: (initialIndex, currentIndex, operationType) => `${operationType} item inserted at position ${currentIndex + 1}.`,
          liveAnnouncementDndCommitted: (operationType) => `${operationType} committed.`,
          liveAnnouncementDndDiscarded: (operationType) => `${operationType} discarded.`,
          liveAnnouncementItemRemoved: (initialIndex, operationType) => `${operationType} item removed from position ${initialIndex + 1}.`,
        }}
      />
      {alertMessage && (
        <Alert type={alertType} onDismiss={() => setAlertMessage(null)}>
          {alertMessage}
        </Alert>
      )}
    </ContentLayout>
  );
};
export default NewAppointmentForm;