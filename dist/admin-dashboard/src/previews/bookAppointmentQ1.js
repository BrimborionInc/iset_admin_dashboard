import React, { useState, useEffect, useRef } from 'react';
import '../css/govuk-frontend.min.css';
import '../css/style.css';

function BookAppointmentQ1() {
  const [isBiometric, setIsBiometric] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [services, setServices] = useState([]);
  const bilReferenceRef = useRef(null);

  useEffect(() => {
    // Simulate fetching services
    const fetchedServices = [
      { id: 1, name: 'Biometric Collection', description: 'Collect biometric data for identity verification.' },
      { id: 2, name: 'Document Submission', description: 'Submit your passport or supporting documents to IRCC.' },
      { id: 3, name: 'Interview', description: 'Attend an interview for your application.' },
      { id: 4, name: 'Travel Document Scanning', description: 'Scan your travel documents for submission to IRCC.' },
      { id: 5, name: 'Application Assistance (In-Person)', description: 'Receive in-person guidance for your application process.' },
      { id: 6, name: 'Application Assistance (Virtual)', description: 'Get virtual support for your application.' },
      { id: 7, name: 'Buccal Swab', description: 'Provide a DNA sample for verification purposes.' },
      { id: 8, name: 'Self-Service Workstation', description: 'Use a workstation to complete your application tasks.' },
      { id: 9, name: 'Photography Services', description: 'Get a compliant photograph taken for your application.' }
    ];
    setServices(fetchedServices);
  }, []);

  const handleServiceChange = (event) => {
    const { value } = event.target;
    setSelectedService(value);
    const service = services.find(service => service.id === parseInt(value));
    setIsBiometric(service && service.name.toLowerCase() === 'biometric collection');
    if (!service || service.name.toLowerCase() !== 'biometric collection') {
      if (bilReferenceRef.current) {
        bilReferenceRef.current.value = '';
      }
    }
  };

  const text = {
    en: {
      bookAppointment: "Book an appointment",
      serviceRequired: "Which service do you require?",
      hint: "Please select one of the following options to proceed. You will have an opportunity to add family or group members and request additional service options later in the booking process. Hover over the item for a description of the service.",
      commonServices: "Common Services",
      biometric: "Biometric Collection",
      biometricHint: "Select only if you have received a Biometric Instruction Letter (BIL) from IRCC. Duration: 15 minutes. Bring your BIL and a government-issued photo ID.",
      documentSubmission: "Document Submission",
      documentSubmissionHint: "Submit your passport or supporting documents to IRCC. Duration: 20 minutes. Bring all documents as instructed by IRCC.",
      interview: "Interview",
      interviewHint: "Attend an interview for your application. Duration: 30 minutes. Bring all necessary documents.",
      bilReference: "BIL Reference Number (required for Biometric Collection)",
      otherServices: "Other Available Services",
      travelDocScanning: "Travel Document Scanning",
      travelDocScanningHint: "Scan your travel documents for submission to IRCC. Duration: 15 minutes. Bring your travel documents and any required letters.",
      appAssistanceInPerson: "Application Assistance (In-Person)",
      appAssistanceInPersonHint: "Receive in-person guidance for your application process. Duration: 30 minutes. Bring your application and relevant supporting documents.",
      appAssistanceVirtual: "Application Assistance (Virtual)",
      appAssistanceVirtualHint: "Get virtual support for your application. Duration: 30 minutes. Ensure you have a stable internet connection and access to your application documents.",
      buccalSwab: "Buccal Swab",
      buccalSwabHint: "Provide a DNA sample for verification purposes. Duration: 10 minutes. Bring your government-issued photo ID and any related instructions.",
      selfServiceWorkstation: "Self-Service Workstation",
      selfServiceWorkstationHint: "Use a workstation to complete your application tasks. Duration: Variable. Bring any necessary documents and digital copies.",
      photography: "Photography Services",
      photographyHint: "Get a compliant photograph taken for your application. Duration: 10 minutes. Bring any photo requirements provided by IRCC.",
      continue: "Continue",
      cancel: "Cancel"
    }
  };

  const commonServices = services.slice(0, 3);
  const otherServices = services.slice(3);

  return (
    <div style={{ border: '2px solid #f0ad4e', backgroundColor: '#fcf8e3', padding: '20px', borderRadius: '5px', marginTop: '0' }}>
      <main className="govuk-main-wrapper govuk-width-container" role="main" style={{ marginTop: '0' }}>
        <p className="govuk-hint" style={{ fontSize: '24px', marginBottom: '0' }}>{text.en.bookAppointment}</p>
        <h1>{text.en.serviceRequired}</h1>
        <div className="govuk-hint">{text.en.hint}</div>

        <div className="govuk-form-group">
          <fieldset className="govuk-fieldset">
            <legend className="govuk-fieldset__legend govuk-fieldset__legend--m">
              <h2 className="govuk-fieldset__heading">{text.en.commonServices}</h2>
            </legend>
            <div className="govuk-radios govuk-radios--inline">
              {commonServices.map(service => (
                <div key={service.id} className="govuk-radios__item tooltip">
                  <input className="govuk-radios__input" id={`service-${service.id}`} name="appointment-type" type="radio" value={service.id} onChange={handleServiceChange} checked={selectedService === service.id.toString()} />
                  <label className="govuk-label govuk-radios__label" htmlFor={`service-${service.id}`}>{service.name}</label>
                  <span className="tooltiptext">{service.description}</span>
                </div>
              ))}
            </div>
          </fieldset>
        </div>

        {isBiometric && (
          <div id="bil-reference-section" className="govuk-inset-text">
            <label className="govuk-label" htmlFor="bil-reference">{text.en.bilReference}</label>
            <input className="govuk-input" id="bil-reference" name="bil-reference" type="text" ref={bilReferenceRef} />
          </div>
        )}

        <details className="govuk-details" data-module="govuk-details">
          <summary className="govuk-details__summary">
            <p className="govuk-details__summary-text">{text.en.otherServices}</p>
          </summary>
          <div className="govuk-inset-text">
            <div className="govuk-form-group">
              <div className="govuk-radios">
                {otherServices.map(service => (
                  <div key={service.id} className="govuk-radios__item tooltip">
                    <input className="govuk-radios__input" id={`service-${service.id}`} name="appointment-type" type="radio" value={service.id} onChange={handleServiceChange} checked={selectedService === service.id.toString()} />
                    <label className="govuk-label govuk-radios__label" htmlFor={`service-${service.id}`}>{service.name}</label>
                    <span className="tooltiptext">{service.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>
      </main>
    </div>
  );
}

export default BookAppointmentQ1;