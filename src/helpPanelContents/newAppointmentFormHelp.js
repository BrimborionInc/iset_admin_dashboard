import React from 'react';
import { Alert } from '@cloudscape-design/components';

const NewAppointmentFormHelp = () => (
  <div>
    <h2>Appointment Booking Process</h2>
    <Alert type="warning" header="Known Bugs">
      <ul>
        <li>The wrong time slot appears to be being booked</li>
      </ul>
    </Alert>
    <p>Follow these steps to book an appointment:</p>
    <ol>
      <li><strong>Select Applicant:</strong> Choose the applicant for whom the appointment is being booked.</li>
      <li><strong>Search Slots:</strong> Enter the location and service type to search for available slots.</li>
      <li><strong>View Slots:</strong> Select a date and time from the available slots.</li>
      <li><strong>Confirm Booking:</strong> Review the details and print the booking.</li>
    </ol>
    <p>To book multiple appointments of the same type quickly, change the user and repeat the process.</p>

    <Alert type="info" header="Development Notes">
      <ul>
        <li>"Register New User" is not yet enabled.</li>
        <li>Search for applicant may be too slow for a full production database.</li>
        <li>BIL Validation is turned off in this dashboard.</li>
        <li>Reason-Codes are not yet integrated with payments.</li>
        <li>Slots search is still basic (no extra time etc).</li>
        <li>Regular/Emergency is not yet enabled.</li>
        <li>Need to enable notifications etc.</li>
      </ul>
    </Alert>

  </div>
);

NewAppointmentFormHelp.aiContext = `
You are assisting an IRCC staff representative using the New Appointment Form dashboard to book an appointment for a migration service. 
The user is already signed in and has navigated to this page, so do not include instructions on how to sign in or navigate here.

The New Appointment Form dashboard includes the following steps:
1. **Select Applicant**: The staff selects an applicant from the system or registers a new user (if enabled).
2. **Search Slots**: The staff enters the location, service type, and other criteria to search for available appointment slots.
3. **View Slots**: The staff selects a date and time from the available slots.
4. **Confirm Booking**: The staff reviews the details and confirms the booking, with an option to print the confirmation.

Key details:
- **No-Charge Referral Codes**: These are used to waive fees for specific services. The codes are tied to service types and can be managed in the code table console.
- **Group Bookings**: The dashboard supports group or family bookings, where each member must have their own BIL reference for biometric collection services.
- **Interpreter Services**: The staff can indicate if an interpreter is needed and select the interpreter's language.
- **Extra Time**: The staff can request extra time for appointments, which may limit slot availability.

Provide assistance specific to the New Appointment Form dashboard and its widgets, including applicant selection, slot search, and booking confirmation.
`;

export default NewAppointmentFormHelp;
