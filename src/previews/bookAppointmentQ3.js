import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../css/govuk-frontend.min.css';
import '../css/style.css';

function BookAppointmentQ3() {
  const [members, setMembers] = useState([]);
  const [showMemberSection, setShowMemberSection] = useState(false);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [bilReference, setBilReference] = useState('');
  const [appointmentData, setAppointmentData] = useState({});

  useEffect(() => {
    // Simulate fetching appointment data
    const fetchedData = {
      members: [],
      // ...other data
    };
    setAppointmentData(fetchedData);
    if (fetchedData.members) {
      setMembers(fetchedData.members);
    }
  }, []);


  const handleAddMember = () => {
    if (name && relationship) {
      const newMembers = [...members, { name, relationship, bilReference }];
      setMembers(newMembers);
      setName('');
      setRelationship('');
      setBilReference('');
      // Simulate saving data
      console.log('Slot search criteria saved:', { ...appointmentData, members: newMembers });
    } else {
      alert("Please enter the member's name and relationship.");
    }
  };

  const handleDeleteMember = (index) => {
    const newMembers = members.filter((_, i) => i !== index);
    setMembers(newMembers);
    // Simulate saving data
    console.log('Members saved:', { members: newMembers });
  };

  const text = {
    en: {
      bookAppointment: "Book an appointment",
      groupBooking: "Is this a group or family booking?",
      hint: "You can add other members who need the same service here. Each member's name and date of birth should match the details on their respective passports or travel documents. Only individuals listed in this section will be allowed to accompany you to the appointment.",
      addMembers: "Add members?",
      yes: "Yes",
      no: "No",
      memberName: "Name of Family/Group Member",
      enterName: "Enter full name",
      relationship: "Relationship",
      selectRelationship: "Please select or enter a relationship",
      groupMember: "Group Member",
      spouse: "Spouse",
      child: "Child",
      parent: "Parent",
      otherRelative: "Other Relative",
      bilReference: "BIL Reference Number (required for Biometric Collection only)",
      addMember: "Add Member",
      addedMembers: "Added Members",
      name: "Name",
      relationshipColumn: "Relationship",
      bilReferenceColumn: "BIL Reference",
      actions: "Actions",
      delete: "Delete",
      continue: "Continue",
      back: "Back"
    }
  };

  return (
    <div style={{ border: '2px solid #f0ad4e', backgroundColor: '#fcf8e3', padding: '20px', borderRadius: '5px', marginTop: '0' }}>
      <main className="govuk-main-wrapper govuk-width-container" role="main" style={{ marginTop: '0' }}>
        <p className="govuk-hint" style={{ fontSize: '24px', marginBottom: '0' }}>{text.en.bookAppointment}</p>
        <h1>{text.en.groupBooking}</h1>
        <div className="govuk-hint">{text.en.hint}</div>
   
        <div className="govuk-form-group">
          <fieldset className="govuk-fieldset">
            <div className="govuk-radios govuk-radios--inline">
              <div className="govuk-radios__item">
                <input className="govuk-radios__input" id="add-members-yes" name="add-members" type="radio" value="yes" onChange={() => setShowMemberSection(true)} />
                <label className="govuk-label govuk-radios__label" htmlFor="add-members-yes">{text.en.yes}</label>
              </div>
              <div className="govuk-radios__item">
                <input className="govuk-radios__input" id="add-members-no" name="add-members" type="radio" value="no" onChange={() => setShowMemberSection(false)} defaultChecked />
                <label className="govuk-label govuk-radios__label" htmlFor="add-members-no">{text.en.no}</label>
              </div>
            </div>
          </fieldset>
        </div>

        {showMemberSection && (
          <div id="member-section" className="govuk-inset-text">
            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="member-name">{text.en.memberName}</label>
              <input className="govuk-input govuk-!-width-full" id="member-name" name="member-name" type="text" placeholder={text.en.enterName} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
                
            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="relationship">{text.en.relationship}</label>
              <select className="govuk-select govuk-!-width-full" id="relationship" name="relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                <option value="">{text.en.selectRelationship}</option>
                <option value="Group Member">{text.en.groupMember}</option>
                <option value="Spouse">{text.en.spouse}</option>
                <option value="Child">{text.en.child}</option>
                <option value="Parent">{text.en.parent}</option>
                <option value="Other Relative">{text.en.otherRelative}</option>
              </select>
            </div>             

            <div className="govuk-form-group tooltip">
              <label className="govuk-label" htmlFor="bil-reference">{text.en.bilReference}</label>
              <input className="govuk-input" id="bil-reference" name="bil-reference" type="text" value={bilReference} onChange={(e) => setBilReference(e.target.value)} />
              <span className="tooltiptext">Provide the Biometric Instruction Letter (BIL) reference number for this member if needed.</span>
            </div>

            <button type="button" className="govuk-button" id="add-member-button" onClick={handleAddMember}>{text.en.addMember}</button>
          </div>
        )}

        {members.length > 0 && (
          <div id="member-table-container">
            <h2 className="govuk-heading-m">{text.en.addedMembers}</h2>
            <table className="govuk-table member-table" id="member-table">
              <thead>
                <tr>
                  <th>{text.en.name}</th>
                  <th>{text.en.relationshipColumn}</th>
                  <th>{text.en.bilReferenceColumn}</th>
                  <th>{text.en.actions}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, index) => (
                  <tr key={index}>
                    <td>{member.name}</td>
                    <td>{member.relationship}</td>
                    <td>{member.bilReference || "N/A"}</td>
                    <td><button type="button" onClick={() => handleDeleteMember(index)}>{text.en.delete}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="govuk-button-group">
          <Link to="/book-appointment-q2" className="govuk-button govuk-button--secondary">{text.en.back}</Link>
          <Link to="/book-appointment-q4" className="govuk-button">{text.en.continue}</Link>
        </div>
      </main>
    </div>
  );
}

export default BookAppointmentQ3;
