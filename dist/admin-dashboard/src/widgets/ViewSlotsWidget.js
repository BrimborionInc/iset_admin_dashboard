import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, Box, Button, Header, FormField, Select, SegmentedControl  } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const ViewSlotsWidget = ({ appointmentData, onSlotSelect, onBookingSuccess }) => {
  const [slots, setSlots] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [initialMonth, setInitialMonth] = useState(null);
  const [initialYear, setInitialYear] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('');
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(appointmentData.location || '');
  const [selectedSegment, setSelectedSegment] = useState('regular'); // Add state for segmented control

  const fetchSlots = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/available-slots`, {
        params: { location: selectedLocation }
      });
      setSlots(response.data);
      const availableDates = calculateAvailableDates(response.data);
      setAvailableDates(availableDates);

      if (availableDates.length > 0) {
        const firstAvailableDate = new Date(availableDates[0].date);
        setInitialMonth(firstAvailableDate.getMonth());
        setInitialYear(firstAvailableDate.getFullYear());
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      fetchSlots();
    }
  }, [selectedLocation]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/countries-locations`);
        setLocations(response.data.locations);
      } catch (error) {
        console.error('Error fetching locations:', error);
      }
    };

    fetchLocations();
  }, []);

  const calculateAvailableDates = (slots) => {
    const dates = new Set();
    slots.forEach(slot => {
      if (slot.is_booked === 0) {
        dates.add(slot.date.split('T')[0]);
      }
    });
    return Array.from(dates).map(date => ({ date }));
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    document.querySelectorAll('.selected-day').forEach(selected => {
      selected.classList.remove('selected-day');
    });
    const clickedDay = document.querySelector(`[data-date="${date}"]`);
    if (clickedDay) {
      clickedDay.classList.add('selected-day');
    }

    const availableSlots = slots.filter(slot => slot.date.split('T')[0] === date && slot.is_booked === 0);
    const contiguousSlots = findContiguousSlots(availableSlots, appointmentData.is_group ? appointmentData.members.length + 1 : 1);
    setAvailableTimeSlots(contiguousSlots);
  };

  const findContiguousSlots = (slots, groupSize) => {
    const startSlots = [];
    slots.sort((a, b) => a.id - b.id);
    for (let i = 0; i <= slots.length - groupSize; i++) {
      const groupSlots = slots.slice(i, i + groupSize);
      const isContiguous = groupSlots.every((slot, index) => {
        if (index === 0) return true;
        const prevSlot = groupSlots[index - 1];
        return slot.id === prevSlot.id + 1 && slot.counter_number === prevSlot.counter_number;
      });
      if (isContiguous) {
        startSlots.push(groupSlots[0]);
      }
    }
    return startSlots;
  };

  const handleTimeClick = (time) => {
    setSelectedTime(time);
    onSlotSelect({ date: selectedDate, time, location_id: selectedLocation });
  };

  const handleLocationChange = async ({ detail }) => {
    setSelectedLocation(detail.selectedOption.value);
    setSelectedDate(null);
    setSelectedTime(null);
    setAvailableTimeSlots([]);
    setInitialMonth(null);
    setInitialYear(null);

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/available-slots`, {
        params: { location: detail.selectedOption.value }
      });
      setSlots(response.data);
      const availableDates = calculateAvailableDates(response.data);
      setAvailableDates(availableDates);

      if (availableDates.length > 0) {
        const firstAvailableDate = new Date(availableDates[0].date);
        setInitialMonth(firstAvailableDate.getMonth());
        setInitialYear(firstAvailableDate.getFullYear());
      }
    } catch (error) {
      console.error('Error fetching available slots for new location:', error);
    }
  };

  const generateCalendar = (month, year) => {
    const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const monthLength = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    let table = '<table class="govuk-table"><thead><tr>';
    for (const day of daysOfWeek) {
      table += `<th class="govuk-table__header">${day}</th>`;
    }
    table += '</tr></thead><tbody><tr>';

    for (let i = 0; i < firstDay; i++) {
      table += '<td class="govuk-table__cell"></td>';
    }

    for (let day = 1; day <= monthLength; day++) {
      const currentDate = new Date(year, month, day);
      const currentDateString = currentDate.toISOString().split('T')[0];
      const isAvailable = availableDates.some(slot => slot.date === currentDateString);
      const className = isAvailable ? 'available-day' : 'unavailable-day';

      table += `<td class="govuk-table__cell ${className}" 
                  ${isAvailable ? `data-date="${currentDateString}"` : ''}>
                  ${day}
                </td>`;

      if ((day + firstDay) % 7 === 0 && day !== monthLength) {
        table += '</tr><tr>';
      }
    }
    table += '</tr></tbody></table>';

    setTimeout(() => {
      const availableDays = document.querySelectorAll('.available-day');
      availableDays.forEach(day => {
        day.addEventListener('click', function () {
          const date = day.getAttribute('data-date');
          handleDateClick(date);
        });
      });
    }, 0);

    return table;
  };

  const generateTimeSlotsTable = () => {
    if (!selectedDate) return '';

    if (availableTimeSlots.length === 0) return '';

    const uniqueTimes = new Set(availableTimeSlots.map(slot => slot.time));
    const sortedTimes = Array.from(uniqueTimes).sort((a, b) => new Date(`1970-01-01T${a}Z`) - new Date(`1970-01-01T${b}Z`));

    let tableContent = '<table class="govuk-table"><tbody><tr>';
    sortedTimes.forEach((time, index) => {
      tableContent += `<td class="govuk-table__cell available-time ${selectedTime === time ? 'selected-time' : ''}" 
                        data-time="${time}">
                        ${time}
                      </td>`;
      if ((index + 1) % 2 === 0 && index !== sortedTimes.length - 1) {
        tableContent += '</tr><tr>';
      }
    });
    tableContent += '</tr></tbody></table>';
    return tableContent;
  };

  useEffect(() => {
    const timeSlotsContainer = document.getElementById('time-slots');
    const handleTimeClickEvent = (event) => {
      const target = event.target;
      if (target.classList.contains('available-time')) {
        const time = target.getAttribute('data-time');
        handleTimeClick(time);
      }
    };

    if (timeSlotsContainer && !timeSlotsContainer.hasEventListener) {
      timeSlotsContainer.addEventListener('click', handleTimeClickEvent);
      timeSlotsContainer.hasEventListener = true;
    }

    return () => {
      if (timeSlotsContainer && timeSlotsContainer.hasEventListener) {
        timeSlotsContainer.removeEventListener('click', handleTimeClickEvent);
        timeSlotsContainer.hasEventListener = false;
      }
    };
  }, [selectedDate, availableTimeSlots]);

  const handleConfirmAndBook = async () => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/save-appointment`, {
        userId: appointmentData.userId,
        date: selectedDate,
        time: selectedTime,
        location: selectedLocation,
        serviceType: appointmentData.serviceType,
        members: appointmentData.members,
        bilReference: appointmentData.bilReference,
        extraTime: appointmentData.extraTime,
        preferredLanguage: appointmentData.preferredLanguage,
        interpreterNeeded: appointmentData.interpreterNeeded,
        interpreterLanguage: appointmentData.interpreterLanguage,
        additionalNotes: appointmentData.additionalNotes,
        noChargeReferral: appointmentData.noChargeReferral
      });
      setAlertMessage('Appointment booked successfully!');
      setAlertType('success');
      console.log('Booking success:', response.data); // Add this line
      onBookingSuccess(response.data); // Call the callback with booking details
      fetchSlots(); // Refresh the available slots
    } catch (error) {
      console.error('Error booking appointment:', error);
      setAlertMessage('Failed to book appointment.');
      setAlertType('error');
    }
  };

  return (
    <BoardItem
      header={<Header variant="h2">View Slots</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
    >
      <Box display="flex" flexDirection="column">
        <SegmentedControl
          selectedId={selectedSegment}
          onChange={({ detail }) => setSelectedSegment(detail.selectedId)}
          label="Appointment Type"
          options={[
            { text: "Regular", id: "regular" },
            { text: "Emergency", id: "emergency" },
            { text: "Walk-In", id: "walk-in" }
          ]}
        />
        <p>
          <b>Showing slots in:</b> {locations.find(location => location.id === selectedLocation)?.name || 'None'}
        </p> {/* Modified line */}
        <FormField label="Try Another Location">
          <Select
            selectedOption={locations.find(location => location.value === selectedLocation)}
            onChange={handleLocationChange}
            options={locations.map(location => ({ label: location.name, value: location.id }))}
            placeholder="Choose a location"
          />
        </FormField>
        <h2 className="govuk-heading">Select a Date</h2>
        {availableDates.length > 0 ? (
          <>
            <p className="govuk-hint">
              Available days are shown in green. Please click to select. You can view earlier and later months by clicking the links below the table.
            </p>
            <div className="calendar-container">
              {initialMonth !== null && initialYear !== null && !isLoading && (
                <>
                  <h3 className="govuk-heading">{new Date(initialYear, initialMonth).toLocaleString('default', { month: 'long' })} {initialYear}</h3>
                  <div id="calendar" className="govuk-table" dangerouslySetInnerHTML={{ __html: generateCalendar(initialMonth, initialYear) }} />
                </>
              )}
              <div style={{ textAlign: 'center', marginTop: '1em' }}>
                <a href="#" className="govuk-link">&laquo; Earlier</a> | <a href="#" className="govuk-link">Later &raquo;</a>
              </div>
            </div>
          </>
        ) : (
          <p className="govuk-hint">
            No available appointments. Please try another location or adjust your search options.
          </p>
        )}
        <br />
        {selectedDate && (
          <>
            <h2 className="govuk-heading-m">Select a Time</h2>
            <p className="govuk-body">Please choose a time for your appointment. Click on an available time to select it.</p>
            <div className="calendar-container">
              <div id="time-slots" className="govuk-table__container" dangerouslySetInnerHTML={{ __html: generateTimeSlotsTable() }} />
              <div style={{ textAlign: 'center', marginTop: '1em' }}>
                <a href="#" className="govuk-link">&laquo; Earlier</a> | <a href="#" className="govuk-link">Later &raquo;</a>
              </div>
            </div>
          </>
        )}
        <Button onClick={handleConfirmAndBook} disabled={!selectedDate || !selectedTime}>
          Confirm and Book
        </Button>
      </Box>
    </BoardItem>
  );
};

export default ViewSlotsWidget;
