import React, { useState, useEffect } from 'react';
import { Box, Button, Drawer,SpaceBetween, Select, FormField, DateRangePicker, Container, Grid, Alert, Input, Header, Multiselect, DatePicker, TimeInput } from '@cloudscape-design/components';

const SlotManagementWidget = () => {
  const [slotCriteria, setSlotCriteria] = useState({
    location: null,
    counterType: null,
    counterNumber: '',
    date: ''
  });
  const [countries, setCountries] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [dateRange, setDateRange] = useState(undefined);
  const [alert, setAlert] = useState(null);
  const [alertVisible, setAlertVisible] = useState(true);
  const [scheduleConfig, setScheduleConfig] = useState({
    date: '',
    time: '',
    recurrence: null,
    range: null
  });

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/countries`)
      .then(response => response.json())
      .then(data => setCountries(data.map(country => ({ label: country.name, value: country.id }))))
      .catch(error => console.error('Error fetching countries:', error));
  }, []);

  useEffect(() => {
    if (selectedCountry) {
      fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations?country=${selectedCountry.value}`)
        .then(response => response.json())
        .then(data => setLocations(data.filter(location => location.country === selectedCountry.label).map(location => ({ label: location.location, value: location.id }))))
        .catch(error => console.error('Error fetching locations:', error));
    } else {
      setLocations([]);
    }
  }, [selectedCountry]);

  const handleCountryChange = ({ detail }) => {
    setSelectedCountry(detail.selectedOption);
    setSelectedLocations([]);
  };

  const handleLocationChange = ({ detail }) => {
    setSelectedLocations(detail.selectedOptions);
  };

  const handleCriteriaChange = (name) => (e) => {
    const { value } = e.detail;
    setSlotCriteria({ ...slotCriteria, [name]: value });
  };

  const handleScheduleConfigChange = (name) => (e) => {
    const { value } = e.detail;
    setScheduleConfig({ ...scheduleConfig, [name]: value });
  };

  const fetchLocationDetails = async (locationId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations/${locationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch location details');
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      setAlert({ type: 'error', message: 'Failed to fetch location details' });
      return null;
    }
  };

  const fetchOperatingHoursAndHolidays = async (locationId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/operating-hours/${locationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch operating hours and holidays');
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      setAlert({ type: 'error', message: 'Failed to fetch operating hours and holidays' });
      return null;
    }
  };

  const generateTimeSlots = (startTime, endTime, interval) => {
    const slots = [];
    let currentTime = new Date(startTime);

    while (currentTime < endTime) {
      slots.push(new Date(currentTime));
      currentTime.setMinutes(currentTime.getMinutes() + interval);
    }

    return slots;
  };

  const insertSlots = async (slots) => {
    if (slots.length === 0) {
      console.warn('No slots to insert'); // Add logging
      return;
    }

    console.log('Generated slots data:', slots); // Add logging
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/slots/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(slots)
      });
      if (!response.ok) {
        throw new Error('Failed to insert slots');
      }
      setAlert({ type: 'success', message: `Slots generated successfully. Total slots added: ${slots.length}` });
    } catch (error) {
      console.error(error);
      setAlert({ type: 'error', message: 'Failed to insert slots' });
    }
  };

  const generateSlots = async () => {
    if (selectedLocations.length === 0 || !dateRange) {
      setAlert({ type: 'error', message: 'Please select locations and date range' });
      return;
    }

    console.log('Selected date range:', dateRange); // Add logging

    for (const location of selectedLocations) {
      const locationId = location.value;
      const locationDetails = await fetchLocationDetails(locationId);
      if (!locationDetails) continue;

      const { operatingHours, holidayClosures } = await fetchOperatingHoursAndHolidays(locationId);
      if (!operatingHours || !holidayClosures) continue;

      console.log('Operating hours:', operatingHours); // Add logging
      console.log('Holiday closures:', holidayClosures); // Add logging

      const holidayDates = holidayClosures.map(holiday => holiday.date.split('T')[0]);
      const slots = [];
      let startDate, endDate;

      if (dateRange.type === 'relative') {
        const now = new Date();
        startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        endDate = new Date(startDate);
        switch (dateRange.unit) {
          case 'day':
            endDate.setUTCDate(startDate.getUTCDate() + dateRange.amount);
            break;
          case 'week':
            endDate.setUTCDate(startDate.getUTCDate() + dateRange.amount * 7);
            break;
          case 'month':
            endDate.setUTCMonth(startDate.getUTCMonth() + dateRange.amount);
            break;
          default:
            break;
        }
      } else {
        startDate = new Date(Date.UTC(
          new Date(dateRange.startDate).getUTCFullYear(),
          new Date(dateRange.startDate).getUTCMonth(),
          new Date(dateRange.startDate).getUTCDate()
        ));
        endDate = new Date(Date.UTC(
          new Date(dateRange.endDate).getUTCFullYear(),
          new Date(dateRange.endDate).getUTCMonth(),
          new Date(dateRange.endDate).getUTCDate()
        ));
      }

      console.log('Start date:', startDate); // Add logging
      console.log('End date:', endDate); // Add logging

      for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        const dayOfWeek = d.toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' });
        const hours = operatingHours.find(h => h.day_of_week === dayOfWeek);
        const currentDate = d.toISOString().split('T')[0];

        console.log('Processing date:', currentDate, 'Day of week:', dayOfWeek, 'Operating hours:', hours); // Add logging

        if (hours && hours.open_time !== '00:00:00' && hours.close_time !== '00:00:00' && !holidayDates.includes(currentDate)) {
          const startTime = new Date(`${currentDate}T${hours.open_time}Z`);
          const endTime = new Date(`${currentDate}T${hours.close_time}Z`);
          const timeSlots = generateTimeSlots(startTime, endTime, 30); // Interval set to 30 minutes

          // Generate slots for each counter type
          let counterNumber = 1;
          const counterTypes = ['biometric', 'service', 'combi'];
          for (const counterType of counterTypes) {
            const counterCount = locationDetails[`${counterType}_counters`];
            for (let i = 0; i < counterCount; i++) {
              timeSlots.forEach(timeSlot => {
                const slot = {
                  location_id: locationId,
                  counter_type: counterType,
                  counter_number: counterNumber, // Use the same counter number for all slots of this counter
                  date: currentDate,
                  time: timeSlot.toISOString().split('T')[1].split('.')[0], // Fix the time format
                  is_booked: 0
                };
                slots.push(slot);
              });
              counterNumber++; // Increment counter number after processing all slots for this counter
            }
          }
        }
      }

      await insertSlots(slots);
    }
  };

  return (
    <Box padding="m">
      {alert && alertVisible && (
        <Alert
          dismissible
          onDismiss={() => setAlertVisible(false)}
          type={alert.type}
        >
          {alert.message}
        </Alert>
      )}
      <Grid
        gridDefinition={[{ colspan: 5 }, { colspan: 7 }]}
      >
        <Container
          header={
            <Header
              variant="h2"
              description="Generate immediate slots. Select one or more locations, a date range then click the button to generate slots."
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="normal" onClick={generateSlots}>Generate Slots</Button>
                </SpaceBetween>
              }
            >
              Generate Immediate Slots
            </Header>
          }
        >
          <FormField label="Select Country" description="Select a country then select one or more locations">
            <Select
              selectedOption={selectedCountry}
              onChange={handleCountryChange}
              options={countries.length > 0 ? countries : [{ label: 'No countries available', value: '' }]}
              placeholder="Select a country"
              empty={
                <Box textAlign="center" color="inherit">
                  <b>No countries available</b>
                  <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                    There are no countries to select.
                  </Box>
                </Box>
              }
            />
          </FormField>
          <FormField label="Select Location" description="Select one or more locations">
            <Multiselect
              selectedOptions={selectedLocations}
              onChange={handleLocationChange}
              options={locations.length > 0 ? locations : [{ label: 'No locations available', value: '' }]}
              placeholder="Select locations"
              disabled={!selectedCountry}
              empty={
                <Box textAlign="center" color="inherit">
                  <b>No locations available</b>
                  <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                    There are no locations to select for this country.
                  </Box>
                </Box>
              }
            />
          </FormField>
          <FormField label="Select Date Range" description="Select a date range to generate slots">
            <DateRangePicker
              expandToViewport
              onChange={({ detail }) => setDateRange(detail.value)}
              value={dateRange}
              i18nStrings={{
                customRelativeRangeOptionDescription: "Select a custom date range",
                relativeModeTitle: "Relative mode",
                absoluteModeTitle: "Absolute mode",
                relativeRangeSelectionHeading: "Select a relative range",
                relativeRangeSelectionMonthlyDescription: "Select a range in days, weeks, or months",
                customRelativeRangeOptionLabel: "Custom range",
                customRelativeRangeDurationLabel: "Duration",
                customRelativeRangeUnitLabel: "Unit",
                customRelativeRangeDurationPlaceholder: "Enter duration",
                startDateLabel: "Start date",
                endDateLabel: "End date",
                startTimeLabel: "Start time",
                endTimeLabel: "End time",
                applyButtonLabel: "Apply",
                cancelButtonLabel: "Cancel",
                clearButtonLabel: "Clear",
                todayAriaLabel: "Today",
                nextMonthAriaLabel: "Next month",
                previousMonthAriaLabel: "Previous month",
                nextYearAriaLabel: "Next year",
                previousYearAriaLabel: "Previous year",
                formatRelativeRange: (value) => `${value.amount} ${value.unit}${value.amount !== 1 ? 's' : ''}`,
                formatUnit: (unit, amount) => `${unit.charAt(0).toUpperCase() + unit.slice(1)}${amount !== 1 ? 's' : ''}`
              }}
              relativeOptions={[
                { key: "next-1-day", amount: 1, unit: "day", type: "relative", label: "Next 1 day" },
                { key: "next-3-days", amount: 3, unit: "day", type: "relative", label: "Next 3 days" },
                { key: "next-7-days", amount: 7, unit: "day", type: "relative", label: "Next 7 days" },
                { key: "next-14-days", amount: 14, unit: "day", type: "relative", label: "Next 14 days" }
              ]}
              customRelativeRangeUnits={['day', 'week', 'month']}
              placeholder="Select a date range"
              dateOnly
            />
          </FormField>
        </Container>
        <Container
          header={
            <Header
              variant="h2"
              description="Use this widget to configure a schedule for generating slots. Select a date, time, recurrence, and range of slots to be added."
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="normal">Schedule Slot Generation</Button>
                </SpaceBetween>
              }
            >
              Slot Generation Schedule
            </Header>
          }
        >
          <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
            <Box>
              <FormField label="Scheduled Date">
                <DatePicker
                  onChange={handleScheduleConfigChange('date')}
                  value={scheduleConfig.date}
                  placeholder="Select a date"
                />
              </FormField>
              <FormField label="Scheduled Time (24h localtime)">
                <TimeInput
                  onChange={handleScheduleConfigChange('time')}
                  value={scheduleConfig.time}
                  placeholder="hh:mm"
                />
              </FormField>
              <FormField label="Recurrence">
                <Select
                  selectedOption={scheduleConfig.recurrence}
                  onChange={handleScheduleConfigChange('recurrence')}
                  options={[
                    { label: 'Daily', value: 'daily' },
                    { label: 'Weekly', value: 'weekly' },
                    { label: 'Monthly', value: 'monthly' },
                    { label: 'Custom', value: 'custom' }
                  ]}
                  placeholder="Select recurrence"
                />
              </FormField>
              <FormField label="Range of Slots to be Added">
                <Select
                  selectedOption={scheduleConfig.range}
                  onChange={handleScheduleConfigChange('range')}
                  options={[
                    { label: '1 Day', value: '1day' },
                    { label: '1 Week', value: '1week' },
                    { label: '1 Month', value: '1month' },
                    { label: 'Custom', value: 'custom' }
                  ]}
                  placeholder="Select range"
                />
              </FormField>

            </Box>
            <Drawer>
              <Header variant="h3">Next Slot Release</Header>
              <Box margin={{ bottom: 's' }}>
                <strong>Date:</strong> 2023-12-01
              </Box>
              <Box margin={{ bottom: 's' }}>
                <strong>Time:</strong> 09:00 AM
              </Box>
              <Box margin={{ bottom: 's' }}>
                <strong>Range of Slots:</strong> 1 Week
              </Box>
              <Box margin={{ bottom: 's' }}>
                <strong>Recurrence:</strong> Weekly
              </Box>
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="normal">Suspend</Button>
                <Button variant="normal">Run Now</Button>
              </SpaceBetween>
            </Drawer>
          </Grid>
        </Container>
        {/* Other content can go here */}
      </Grid>
    </Box>
  );
};

export default SlotManagementWidget;
