import React from 'react';
import { Link } from 'react-router-dom';
import '../css/govuk-frontend.min.css';
import '../css/style.css';

function BookAppointmentQ2() {
  const text = {
    en: {
      bookAppointment: "Book an appointment",
      whereApplying: "Where are you applying from?",
      hint: "We will locate the closest application centres to you. Wait times for the service you requested are approximate.",
      country: "Country",
      selectCountry: "Please select a country",
      location: "Select Location",
      selectLocation: "Please select a location",
      continue: "Continue",
      back: "Back"
    },
    fr: {
      bookAppointment: "Prendre un rendez-vous",
      whereApplying: "D'où postulez-vous?",
      hint: "Nous localiserons les centres de demande les plus proches de vous. Les temps d'attente pour le service que vous avez demandé sont approximatifs.",
      country: "Pays",
      selectCountry: "Veuillez sélectionner un pays",
      location: "Sélectionnez l'emplacement",
      selectLocation: "Veuillez sélectionner un emplacement",
      continue: "Continuer",
      back: "Retour"
    }
  };

  return (
    <div style={{ border: '2px solid #f0ad4e', backgroundColor: '#fcf8e3', padding: '20px', borderRadius: '5px', marginTop: '0' }}>
      <main className="govuk-main-wrapper govuk-width-container" role="main" style={{ marginTop: '0' }}>
        <p className="govuk-hint" style={{ fontSize: '24px', marginBottom: '0' }}>{text.en.bookAppointment}</p>
        <h1>{text.en.whereApplying}</h1>
        <p className="govuk-hint">{text.en.hint}</p>

        <div className="govuk-form-group">
          <label className="govuk-label" htmlFor="country">{text.en.country}</label>
          <select className="govuk-select govuk-!-width-full" id="country" name="country">
            <option value="">{text.en.selectCountry}</option>
            {/* Options will be populated here */}
          </select>
        </div>

        <div className="govuk-form-group govuk-inset-text" id="location-container">
          <label className="govuk-label" htmlFor="location">{text.en.location}</label>
          <select className="govuk-select govuk-!-width-full" id="location" name="location">
            <option value="">{text.en.selectLocation}</option>
            {/* Options will be populated here */}
          </select>
        </div>

        <div className="govuk-button-group">
          <Link to="/book-appointment" className="govuk-button govuk-button--secondary">{text.en.back}</Link>
          <button className="govuk-button">{text.en.continue}</button>
        </div>
      </main>
    </div>
  );
}

export default BookAppointmentQ2;
