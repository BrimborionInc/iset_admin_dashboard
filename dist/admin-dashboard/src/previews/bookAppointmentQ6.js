import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../css/govuk-frontend.min.css';
import '../css/style.css';

function BookAppointmentQ6() {
  const [additionalServices, setAdditionalServices] = useState([]);
  const [appointmentData, setAppointmentData] = useState({});


  const handleServiceChange = (event) => {
    const { name, checked } = event.target;
    setAdditionalServices(prevServices =>
      checked ? [...prevServices, name] : prevServices.filter(service => service !== name)
    );
  };

  const handleContinue = () => {
    // Simulate saving data
    console.log('Slot search criteria saved:', { ...appointmentData, additionalServices });
  };

  const text = {
    en: {
      bookAppointment: "Book an appointment",
      additionalServices: "Would you like any additional services?",
      valueAddedServices: "Value-Added Services are optional and not included in any Assisted Application Service or Biometric Collection Service fees, and that the purchase of Value-Added Services will not result in faster processing times or a favorable decision on their immigration application.",
      hint: "Please select any optional services you would like to add to your appointment. Availability may be limited based on your location. Prices are shown in the local currency. You have the option to pay online now, or when you attend the appointment.",
      premiumLounge: "Premium Lounge (₹ XX)",
      premiumLoungeHint: "Access to a comfortable lounge with private amenities during your appointment. Please see our website for details and photos of the lounge and its available services https://thesupplier.url/lounge",
      hospitality: "Hospitality Services (₹ XX)",
      hospitalityHint: "Enjoy refreshments or light meals during your appointment. See the VAC website for details as to what options and amenities are available at the application centre.",
      printing: "Printing and Photocopying (₹ XX)",
      printingHint: "Printing and photocopying services for your application documents. We will ask how many pages you need to scan to make sure we book an appointment with enough time.",
      continue: "Continue",
      back: "Back"
    }
  };

  return (
    <div style={{ border: '2px solid #f0ad4e', backgroundColor: '#fcf8e3', padding: '20px', borderRadius: '5px', marginTop: '0' }}>
      <main className="govuk-main-wrapper govuk-width-container" role="main" style={{ marginTop: '0' }}>
        <p className="govuk-hint" style={{ fontSize: '24px', marginBottom: '0' }}>{text.en.bookAppointment}</p>
        <h1>{text.en.additionalServices}</h1>
        <p className="govuk-hint"><b>{text.en.valueAddedServices}</b></p>
        <p className="govuk-hint">{text.en.hint}</p>
        <div className="govuk-form-group">
          <div className="govuk-checkboxes govuk-checkboxes--small">
            <div className="govuk-checkboxes__item tooltip">
              <input className="govuk-checkboxes__input" id="service-premium-lounge" name="Premium Lounge" type="checkbox" onChange={handleServiceChange} checked={additionalServices.includes('Premium Lounge')} />
              <label className="govuk-label govuk-checkboxes__label" htmlFor="service-premium-lounge">{text.en.premiumLounge}</label>
              <span className="tooltiptext">{text.en.premiumLoungeHint}</span>
            </div>
            <div className="govuk-checkboxes__item tooltip">
              <input className="govuk-checkboxes__input" id="service-hospitality" name="Hospitality Services" type="checkbox" onChange={handleServiceChange} checked={additionalServices.includes('Hospitality Services')} />
              <label className="govuk-label govuk-checkboxes__label" htmlFor="service-hospitality">{text.en.hospitality}</label>
              <span className="tooltiptext">{text.en.hospitalityHint}</span>
            </div>
            <div className="govuk-checkboxes__item tooltip">
              <input className="govuk-checkboxes__input" id="service-printing" name="Printing and Photocopying" type="checkbox" onChange={handleServiceChange} checked={additionalServices.includes('Printing and Photocopying')} />
              <label className="govuk-label govuk-checkboxes__label" htmlFor="service-printing">{text.en.printing}</label>
              <span className="tooltiptext">{text.en.printingHint}</span>
            </div>
          </div>
        </div>
        <div className="govuk-button-group">
          <Link to="/book-appointment-q5" className="govuk-button govuk-button--secondary">{text.en.back}</Link>
          <Link to="/book-appointment-q7" className="govuk-button" onClick={handleContinue}>{text.en.continue}</Link>
        </div>
      </main>
    </div>
  );
}

export default BookAppointmentQ6;
