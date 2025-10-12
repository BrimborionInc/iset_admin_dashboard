import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../css/govuk-frontend.min.css';
import '../css/style.css';

function BookAppointmentQ4() {
  const [extraTime, setExtraTime] = useState('');
  useEffect(() => {
    // Simulate fetching appointment data
    const fetchedData = {
      extraTime: 'no',
      // ...other data
    };
    setExtraTime(fetchedData.extraTime);
  }, []);

  const handleExtraTimeChange = (event) => {
    setExtraTime(event.target.value);
  };

  const text = {
    en: {
      bookAppointment: "Book an appointment",
      requestExtraTime: "Request extra time?",
      hint: "If you or any of your group members usually need extra time to complete tasks during the appointment, please let us know, and we will accommodate you with a longer appointment slot. There is no additional charge but availability may be limited.",
      extraTime: "Request extra time?",
      yes: "Yes",
      no: "No",
      continue: "Continue",
      back: "Back"
    }
  };

  return (
    <div style={{ border: '2px solid #f0ad4e', backgroundColor: '#fcf8e3', padding: '20px', borderRadius: '5px', marginTop: '0' }}>
      <main className="govuk-main-wrapper govuk-width-container" role="main" style={{ marginTop: '0' }}>
        <p className="govuk-hint" style={{ fontSize: '24px', marginBottom: '0' }}>{text.en.bookAppointment}</p>
        <h1>{text.en.requestExtraTime}</h1>
        <p className="govuk-hint">{text.en.hint}</p>
         
        <div className="govuk-form-group">
          <fieldset className="govuk-fieldset">
            <legend className="govuk-fieldset__legend govuk-fieldset__legend--m">
              <h2 className="govuk-fieldset__heading">{text.en.extraTime}</h2>
            </legend>
            <div className="govuk-radios govuk-radios--inline">
              <div className="govuk-radios__item">
                <input className="govuk-radios__input" id="extra-time-yes" name="extra-time" type="radio" value="yes" onChange={handleExtraTimeChange} checked={extraTime === 'yes'} />
                <label className="govuk-label govuk-radios__label" htmlFor="extra-time-yes">{text.en.yes}</label>
              </div>
              <div className="govuk-radios__item">
                <input className="govuk-radios__input" id="extra-time-no" name="extra-time" type="radio" value="no" onChange={handleExtraTimeChange} checked={extraTime === 'no'} />
                <label className="govuk-label govuk-radios__label" htmlFor="extra-time-no">{text.en.no}</label>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="govuk-button-group">
          <Link to="/book-appointment-q3" className="govuk-button govuk-button--secondary">{text.en.back}</Link>
          <Link to="/book-appointment-q5" className="govuk-button">{text.en.continue}</Link>
        </div>
      </main>
    </div>
  );
}

export default BookAppointmentQ4;
