import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../css/govuk-frontend.min.css';
import '../css/style.css';

function BookAppointmentQ5() {
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [interpreterNeeded, setInterpreterNeeded] = useState('');
  const [interpreterLanguage, setInterpreterLanguage] = useState('');
  const [error, setError] = useState('');


  const handlePreferredLanguageChange = (event) => {
    setPreferredLanguage(event.target.value);
  };

  const handleInterpreterNeededChange = (event) => {
    setInterpreterNeeded(event.target.value);
  };

  const handleInterpreterLanguageChange = (event) => {
    setInterpreterLanguage(event.target.value);
  };

  const handleContinue = () => {
    if (!preferredLanguage) {
      setError('Please select a preferred language.');
      return;
    }
    setError('');
    // Simulate saving data
    console.log('Slot search criteria saved:', { preferredLanguage, interpreterNeeded, interpreterLanguage });
  };

  const text = {
    en: {
      selectLanguage: "Select your preferred language",
      hint: "Please select your preferred language for your appointment. This will help us ensure that a staff member with the appropriate language skills is available to assist you.",
      preferredLanguage: "Preferred language",
      selectLanguageOption: "Please select a language",
      needInterpreter: "Do you need an interpreter?",
      interpreterHint: "If you or any of your group members require an interpreter for your appointment, please let us know. This includes spoken languages and sign language. We will do our best to accommodate your needs with an interpreter fluent in the selected language.",
      requestInterpreter: "Request interpreter?",
      yes: "Yes",
      no: "No",
      selectInterpreterLanguage: "Select interpreter language",
      continue: "Continue",
      back: "Back"
    }
  };

  return (
    <div style={{ border: '2px solid #f0ad4e', backgroundColor: '#fcf8e3', padding: '20px', borderRadius: '5px', marginTop: '0' }}>
      <main className="govuk-main-wrapper govuk-width-container" role="main" style={{ marginTop: '0' }}>
        <h1>{text.en.selectLanguage}</h1>
        <p className="govuk-hint">{text.en.hint}</p>
        <div className="govuk-form-group">
          {error && <span className="govuk-error-message">{error}</span>}
          <label className="govuk-label" htmlFor="preferred-language">{text.en.preferredLanguage}</label>
          <select className="govuk-select govuk-!-width-full" id="preferred-language" name="preferred-language" value={preferredLanguage} onChange={handlePreferredLanguageChange}>
            <option value="">{text.en.selectLanguageOption}</option>
            <option value="english">English</option>
            <option value="french">French</option>
            <option value="hindi">Hindi</option>
            <option value="urdu">Urdu</option>
            <option value="bengali">Bengali</option>
            <option value="tamil">Tamil</option>
            <option value="telugu">Telugu</option>
            <option value="punjabi">Punjabi</option>
            <option value="mandarin">Mandarin</option>
            <option value="arabic">Arabic</option>
          </select>
        </div>
    
        <h2>{text.en.needInterpreter}</h2>
        <p className="govuk-hint">{text.en.interpreterHint}</p>
        <div className="govuk-form-group">   
          <fieldset className="govuk-fieldset">
            <legend className="govuk-fieldset__legend govuk-fieldset__legend--s">
              {text.en.requestInterpreter}
            </legend>
            <div className="govuk-radios govuk-radios--inline">
              <div className="govuk-radios__item">
                <input className="govuk-radios__input" id="interpreter-yes" name="interpreter-needed" type="radio" value="yes" onChange={handleInterpreterNeededChange} checked={interpreterNeeded === 'yes'} />
                <label className="govuk-label govuk-radios__label" htmlFor="interpreter-yes">{text.en.yes}</label>
              </div>
              <div className="govuk-radios__item">
                <input className="govuk-radios__input" id="interpreter-no" name="interpreter-needed" type="radio" value="no" onChange={handleInterpreterNeededChange} checked={interpreterNeeded === 'no'} />
                <label className="govuk-label govuk-radios__label" htmlFor="interpreter-no">{text.en.no}</label>
              </div>
            </div>
          </fieldset>
        </div>
    
        {interpreterNeeded === 'yes' && (
          <div className="govuk-form-group govuk-inset-text" id="interpreter-language-section">
            <>
              <label className="govuk-label" htmlFor="interpreter-language">{text.en.selectInterpreterLanguage}</label>
              <select className="govuk-select govuk-!-width-full" id="interpreter-language" name="interpreter-language" value={interpreterLanguage} onChange={handleInterpreterLanguageChange}>
                <option value="">{text.en.selectLanguageOption}</option>
                <option value="english">English</option>
                <option value="hindi">Hindi</option>
                <option value="urdu">Urdu</option>
                <option value="bengali">Bengali</option>
                <option value="tamil">Tamil</option>
                <option value="telugu">Telugu</option>
                <option value="punjabi">Punjabi</option>
                <option value="mandarin">Mandarin</option>
                <option value="french">French</option>
                <option value="arabic">Arabic</option>
                <option value="asl">American Sign Language (ASL)</option>
                <option value="isln">Indian Sign Language (ISL)</option>
              </select>
            </>
          </div>
        )}
    
        <div className="govuk-button-group">
          <Link to="/book-appointment-q4" className="govuk-button govuk-button--secondary">{text.en.back}</Link>
          <Link to="/book-appointment-q6" className="govuk-button" onClick={handleContinue}>{text.en.continue}</Link>
        </div>
      </main>
    </div>
  );
}

export default BookAppointmentQ5;
