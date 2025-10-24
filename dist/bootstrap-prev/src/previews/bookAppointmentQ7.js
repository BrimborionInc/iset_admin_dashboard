import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../css/govuk-frontend.min.css';
import '../css/style.css';

function BookAppointmentQ7() {
  const [notes, setNotes] = useState('');
  const [remainingChars, setRemainingChars] = useState(500);


  const handleNotesChange = (event) => {
    const value = event.target.value;
    setNotes(value);
    setRemainingChars(500 - value.length);
  };

  const handleContinue = () => {
    // Simulate saving data
    console.log('Slot search criteria saved:', { additionalNotes: notes });
  };

  const text = {
    en: {
      bookAppointment: "Book an appointment",
      additionalRequests: "Any additional requests?",
      hint: "Use this section to provide any specific notes or requirements for your appointment. You can include details such as special accommodations, preferred assistance, or other relevant information. Please keep your input to a maximum of 500 characters.",
      additionalNotes: "Additional Notes",
      charactersRemaining: "characters remaining",
      back: "Back",
      continue: "Continue"
    }
  };

  return (
    <div style={{ border: '2px solid #f0ad4e', backgroundColor: '#fcf8e3', padding: '20px', borderRadius: '5px', marginTop: '0' }}>
      <main className="govuk-main-wrapper govuk-width-container" role="main" style={{ marginTop: '0' }}>
        <p className="govuk-hint" style={{ fontSize: '24px', marginBottom: '0' }}>{text.en.bookAppointment}</p>
        <h1>{text.en.additionalRequests}</h1>
        <p className="govuk-hint">{text.en.hint}</p>
        <div className="govuk-form-group">
          <label className="govuk-label" htmlFor="additional-notes">{text.en.additionalNotes}</label>
          <textarea
            className="govuk-textarea"
            id="additional-notes"
            name="additional-notes"
            rows="5"
            maxLength="500"
            value={notes}
            onChange={handleNotesChange}
          ></textarea>
          <div id="character-counter" className="character-counter">
            {remainingChars} {text.en.charactersRemaining}
          </div>
        </div>
        <div className="govuk-button-group">
          <Link to="/book-appointment-q6" className="govuk-button govuk-button--secondary">
            {text.en.back}
          </Link>
          <Link to="/book-appointment-summary" className="govuk-button" onClick={handleContinue}>
            {text.en.continue}
          </Link>
        </div>
      </main>
    </div>
  );
}

export default BookAppointmentQ7;
