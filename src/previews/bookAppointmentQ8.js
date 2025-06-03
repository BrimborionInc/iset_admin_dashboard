import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../css/govuk-frontend.min.css';
import '../css/style.css';

function BookAppointmentQ8() {
  const [appointmentData, setAppointmentData] = useState({});
  const [countries, setCountries] = useState([]);
  const [services, setServices] = useState([]);
  const [locations, setLocations] = useState([]);


  const handleConfirmAndBook = () => {
    // Simulate saving data
    console.log('Slot search criteria saved:', appointmentData);
  };

  const getLocationName = (locationId) => {
    const location = locations.find(loc => loc.id === parseInt(locationId));
    return location ? location.name : 'Unknown Location';
  };

  const getCountryName = (countryId) => {
    const country = countries.find(c => c.id === parseInt(countryId));
    return country ? country.name : 'Unknown Country';
  };

  const getServiceName = (serviceId) => {
    const service = services.find(s => s.id === parseInt(serviceId));
    return service ? service.name : 'Unknown Service';
  };

  const text = {
    en: {
      bookAppointment: "Book an appointment",
      reviewDetails: "Review your appointment details",
      hint: "Please review the details of your appointment below. These details will be used to search for available appointment slots. If you need to make any changes, you can go back to the relevant section to edit your choices.",
      serviceType: "Service Type",
      country: "Country",
      location: "Location",
      groupMembers: "Group Members",
      noGroupMembers: "No additional family or group members",
      extraTime: "Extra Time",
      preferredLanguage: "Preferred Language",
      interpreterNeeded: "Interpreter Needed",
      interpreterLanguage: "Interpreter Language",
      additionalServices: "Additional Services",
      noAdditionalServices: "None",
      additionalNotes: "Additional Notes",
      noAdditionalNotes: "None",
      change: "Change",
      confirmAndBook: "Confirm and Book",
      back: "Back"
    }
  };

  return (
    <div style={{ border: '2px solid #f0ad4e', backgroundColor: '#fcf8e3', padding: '20px', borderRadius: '5px', marginTop: '0' }}>
      <main className="govuk-main-wrapper govuk-width-container" role="main" style={{ marginTop: '0' }}>
        <p className="govuk-hint" style={{ fontSize: '24px', marginBottom: '0' }}>
          {text.en.bookAppointment}
        </p>
        <h1>{text.en.reviewDetails}</h1>
        <p className="govuk-hint">
          {text.en.hint}
        </p>
        
        <div className="govuk-summary-list">
          <div className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">{text.en.serviceType}</dt>
            <dd className="govuk-summary-list__value">{getServiceName(appointmentData.serviceType)}</dd>
            <dd className="govuk-summary-list__actions">
              <Link to="/book-appointment" className="govuk-link">{text.en.change}</Link>
            </dd>
          </div>
          <div className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">{text.en.country}</dt>
            <dd className="govuk-summary-list__value">{getCountryName(appointmentData.country)}</dd>
            <dd className="govuk-summary-list__actions">
              <Link to="/book-appointment-q2" className="govuk-link">{text.en.change}</Link>
            </dd>
          </div>
          <div className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">{text.en.location}</dt>
            <dd className="govuk-summary-list__value">{getLocationName(appointmentData.location)}</dd>
            <dd className="govuk-summary-list__actions">
              <Link to="/book-appointment-q2" className="govuk-link">{text.en.change}</Link>
            </dd>
          </div>
          <div className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">{text.en.groupMembers}</dt>
            <dd className="govuk-summary-list__value">
              {appointmentData.members && appointmentData.members.length > 0 ? (
                appointmentData.members.map((member, index) => (
                  <div key={index}>
                    {member.name} ({member.relationship}) - BIL: {member.bilReference || 'N/A'}
                  </div>
                ))
              ) : (
                text.en.noGroupMembers
              )}
            </dd>
            <dd className="govuk-summary-list__actions">
              <Link to="/book-appointment-q3" className="govuk-link">{text.en.change}</Link>
            </dd>
          </div>
          <div className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">{text.en.extraTime}</dt>
            <dd className="govuk-summary-list__value">{appointmentData.extraTime}</dd>
            <dd className="govuk-summary-list__actions">
              <Link to="/book-appointment-q4" className="govuk-link">{text.en.change}</Link>
            </dd>
          </div>
          <div className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">{text.en.preferredLanguage}</dt>
            <dd className="govuk-summary-list__value">{appointmentData.preferredLanguage}</dd>
            <dd className="govuk-summary-list__actions">
              <Link to="/book-appointment-q5" className="govuk-link">{text.en.change}</Link>
            </dd>
          </div>
          <div className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">{text.en.interpreterNeeded}</dt>
            <dd className="govuk-summary-list__value">{appointmentData.interpreterNeeded}</dd>
            <dd className="govuk-summary-list__actions">
              <Link to="/book-appointment-q5" className="govuk-link">{text.en.change}</Link>
            </dd>
          </div>
          {appointmentData.interpreterNeeded === 'yes' && (
            <div className="govuk-summary-list__row">
              <dt className="govuk-summary-list__key">{text.en.interpreterLanguage}</dt>
              <dd className="govuk-summary-list__value">{appointmentData.interpreterLanguage}</dd>
              <dd className="govuk-summary-list__actions">
                <Link to="/book-appointment-q5" className="govuk-link">{text.en.change}</Link>
              </dd>
            </div>
          )}
          <div className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">{text.en.additionalServices}</dt>
            <dd className="govuk-summary-list__value">
              {appointmentData.additionalServices && appointmentData.additionalServices.length > 0
                ? appointmentData.additionalServices.join(', ')
                : text.en.noAdditionalServices}
            </dd>
            <dd className="govuk-summary-list__actions">
              <Link to="/book-appointment-q6" className="govuk-link">{text.en.change}</Link>
            </dd>
          </div>
          <div className="govuk-summary-list__row">
            <dt className="govuk-summary-list__key">{text.en.additionalNotes}</dt>
            <dd className="govuk-summary-list__value">
              {appointmentData.additionalNotes || text.en.noAdditionalNotes}
            </dd>
            <dd className="govuk-summary-list__actions">
              <Link to="/book-appointment-q7" className="govuk-link">{text.en.change}</Link>
            </dd>
          </div>
        </div>

        <div className="govuk-button-group">
          <Link to="/book-appointment-q7" className="govuk-button govuk-button--secondary">
            {text.en.back}
          </Link>
          <Link to="/view-slots" className="govuk-button" onClick={handleConfirmAndBook}>
            {text.en.confirmAndBook}
          </Link>
        </div>
      </main>
    </div>
  );
}

export default BookAppointmentQ8;
