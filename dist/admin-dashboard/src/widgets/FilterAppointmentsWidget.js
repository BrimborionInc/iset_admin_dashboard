import React from 'react';
import { FormField, Input, Select, DatePicker, Grid, Box, Button } from '@cloudscape-design/components';

const FilterAppointmentsWidget = ({ filters, handleFilterChange, handleSelectChange, handleDateChange, applyFilter, clearDates, serviceOptions, countryOptions, locationOptions }) => {
  return (
    <>
      <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
        <FormField label="Search by Appointment ID / Name">
          <Input
            name="searchId"
            value={filters.searchId}
            onChange={handleFilterChange('searchId')}
            placeholder="Enter Appointment ID or Name"
          />
        </FormField>
        <FormField label="Filter by Service">
          <Select
            name="service"
            selectedOption={filters.service}
            onChange={handleSelectChange('service')}
            options={serviceOptions}
          />
        </FormField>
      </Grid>
      <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
        <FormField label="Filter by Country">
          <Select
            name="country"
            selectedOption={filters.country}
            onChange={handleSelectChange('country')}
            options={countryOptions}
          />
        </FormField>
        <FormField label="Filter by Location">
          <Select
            name="location"
            selectedOption={filters.location}
            onChange={handleSelectChange('location')}
            options={locationOptions}
          />
        </FormField>
        <FormField label="Filter by Date From">
          <DatePicker
            name="dateFrom"
            value={filters.dateFrom}
            onChange={handleDateChange('dateFrom')}
            placeholder="Select start date"
            expandToViewport
          />
        </FormField>
        <FormField label="Filter by Date To">
          <DatePicker
            name="dateTo"
            value={filters.dateTo}
            onChange={handleDateChange('dateTo')}
            placeholder="Select end date"
            expandToViewport
          />
        </FormField>
      </Grid>
      <Box margin={{ top: 's' }}>
        <Button variant="primary" onClick={applyFilter}>Apply Filter</Button>
        <Button variant="link" onClick={clearDates}>Clear Dates</Button>
      </Box>
    </>
  );
};

export default FilterAppointmentsWidget;
