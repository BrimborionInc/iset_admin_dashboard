import React, { useContext, useEffect } from 'react';
import { Multiselect, Select, Box } from '@cloudscape-design/components';
import { LocationContext } from '../context/LocationContext';

const LocationSelector = () => {
  const { selectedLocations, setSelectedLocations, dateRange, setDateRange, locations, setLocations } = useContext(LocationContext);
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/locations`);
        const text = await response.text();
        console.log('Response text:', text); // Log the response text
        const data = JSON.parse(text);

        const groupedLocations = data.reduce((acc, location) => {
          const country = location.country;
          if (!acc[country]) {
            acc[country] = [];
          }
          acc[country].push({ label: location.location, value: location.id });
          return acc;
        }, {});

        const options = [
          { label: 'All Region', value: 'all' },
          ...Object.keys(groupedLocations).map(country => ({
            label: country,
            options: groupedLocations[country],
          })),
        ];

        setLocations(options);
        // Pre-select the first location
        if (options.length > 1 && options[1].options.length > 0) {
          setSelectedLocations([options[1].options[0]]);
        }
      } catch (error) {
        console.error('Error fetching locations:', error);
      }
    };

    fetchLocations();
  }, [setLocations, setSelectedLocations]);

  const handleLocationChange = ({ detail }) => {
    const selectedOptions = detail.selectedOptions;
    const allSelected = selectedOptions.some(option => typeof option.value === 'string' && option.value.startsWith('all-'));
    if (allSelected) {
      const allLocations = locations.flatMap(option => option.options || [option]);
      setSelectedLocations(allLocations);
    } else {
      setSelectedLocations(selectedOptions);
    }
  };

  const handleDateRangeChange = ({ detail }) => {
    setDateRange(detail.selectedOption.value);
  };

  return (
    <Box display="inline-flex" gap="m" width="100%" alignItems="center">
      <Box minWidth="300px" flexGrow={1}>
        <Multiselect
          selectedOptions={selectedLocations}
          onChange={handleLocationChange}
          options={locations}
          placeholder="Select locations"
          inlineTokens
        />
      </Box>
      <Box minWidth="300px" flexGrow={1}>
        <Select
          selectedOption={dateRange}
          onChange={handleDateRangeChange}
          options={[
            { label: "Today", value: "today" },
            { label: "This Week", value: "this-week" },
            { label: "This Month", value: "this-month" },
            { label: "This Year", value: "this-year" }
          ]}
          placeholder="Select date range"
        />
      </Box>
    </Box>
  );
};

export default LocationSelector;
