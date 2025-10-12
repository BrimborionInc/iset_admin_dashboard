import React, { useState, useContext } from 'react';
import { Box, Header, ButtonDropdown, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import BarChart from '@cloudscape-design/components/bar-chart';
import Button from '@cloudscape-design/components/button';
import { LocationContext } from '../context/LocationContext'; // Import LocationContext
import {
  colorChartsStatusNeutral,
  colorChartsStatusHigh,
  colorChartsStatusPositive
} from '@cloudscape-design/design-tokens';

const numberFormatter = (value) => {
  return Math.abs(value) >= 1e9
    ? (value / 1e9).toFixed(1).replace(/\.0$/, "") + "G"
    : Math.abs(value) >= 1e6
    ? (value / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
    : Math.abs(value) >= 1e3
    ? (value / 1e3).toFixed(1).replace(/\.0$/, "") + "K"
    : value.toFixed(2);
};

const generateRandomValue = () => {
  return parseFloat((Math.random() * (100 - 92) + 92).toFixed(2));
};

const getColor = (value, threshold) => {
  if (value < threshold) {
    return colorChartsStatusHigh;
  } else if (value >= threshold && value <= threshold + 1) {
    return colorChartsStatusNeutral;
  } else {
    return colorChartsStatusPositive;
  }
};

const SS1 = ({ actions, toggleHelpPanel }) => {
  const { selectedLocations } = useContext(LocationContext); // Use LocationContext
  const [hideLegend, setHideLegend] = useState(true); // Legend hidden by default
  const [hideFilter, setHideFilter] = useState(true); // Filter hidden by default
  const threshold = 95;

  const helpPanelContent = (
    <div>
      <h2>Service Standard SS1 Help</h2>
      <p>1.1 Biometric Collection Service Appointment Availability</p>
      <p>1.1.1 The Contractor must measure its performance against the following Service Standards (SS) through the Appointment Booking Solution that it is required to provide and maintain, pursuant to Section 4.5 of this Annex:</p>
      <ul>
        <li>SS1.1 – Biometric Collection Service Appointment Availability in French;</li>
        <li>SS1.2 – Biometric Collection Service Appointment Availability in English;</li>
        <li>SS1.3 – Biometric Collection Service Appointment Availability in the Predominant Local Language(s); and</li>
        <li>SS1.4 – Biometric Collection Service Appointment Availability in Additional Language(s).</li>
      </ul>
      <p>1.1.2 The consecutive 5 business day period referenced in the Service Standards Table below for SS1.1, SS1.2, SS1.3 and SS1.4 starts at 00:00:00 (midnight) on the business day the search attempt is being made. If the search attempt is not being made on a business day, the consecutive 5 business day period starts at 00:00:00 (midnight) on the 1st business day following the day the search attempt is being made. In both cases, the consecutive 5 business day period ends at 11:59:59 pm on the 5th business day.</p>
      <p>1.1.3 Start and end times for the consecutive 5 business day period defined in Section 1.1.2 in this Appendix are based on the local time and specific business days of the Location of Work selected during the search attempt. In this context, a business day is a day when a Location of Work is open for providing service delivery to applicants. Each Location of Work may have its own business days and hours of operation which are defined in its TA and LAF.</p>
    </div>
  );

  const toggleLegend = () => {
    setHideLegend(!hideLegend);
  };

  const toggleFilter = () => {
    setHideFilter(!hideFilter);
  };

  const categories = ["French", "English", "Local", "Additional"];
  const series = selectedLocations.flatMap(location =>
    categories.map(category => {
      const value = generateRandomValue();
      return {
        title: `${category} (${location.label})`,  // Unique title per location-category
        type: "bar",
        data: [{ x: location.label, y: value }],  // Single data point
        color: getColor(value, threshold)  // Set color per bar
      }

    })
  );

  series.push({
    title: "Service Standard",
    type: "threshold",
    y: 95,
    valueFormatter: e =>
      e.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
  });

  const xDomain = selectedLocations.map(location => location.label);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={
            <Link variant="info" onFollow={() => toggleHelpPanel(helpPanelContent, "Service Standard SS1 Help")}>
              Info
            </Link>
          }
        >
          Biometric Appointment Availability
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        <ButtonDropdown
          items={[
            { id: 'remove', text: 'Remove Widget' },
            { id: 'toggle-legend', text: hideLegend ? 'Show Legend' : 'Hide Legend' },
            { id: 'toggle-filter', text: hideFilter ? 'Show Filter' : 'Hide Filter' } // Add toggle filter option
          ]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={(e) => {
            if (e.detail.id === 'toggle-legend') {
              toggleLegend();
            } else if (e.detail.id === 'toggle-filter') {
              toggleFilter();
            } else if (e.detail.id === 'remove') {
              actions.removeItem();
            }
          }}
        />
      }
    >
      <BarChart
        series={series} // Use series array
        xDomain={xDomain} // Use xDomain array
        yDomain={[90, 100]}
        hideLegend={hideLegend}
        hideFilter={hideFilter} // Use hideFilter state
        yTitle={`SS1 - ${selectedLocations.map(location => location.label).join(', ')}`} // Add country names to yTitle
        i18nStrings={{
          xTickFormatter: e => e,
          yTickFormatter: numberFormatter,
          filterLabel: 'Language Picker',
          filterPlaceholder: 'Language Filter',
          filterSelectedAriaLabel: 'Language Filter'
        }}
        detailPopoverSeriesContent={({ series, y }) => {
          const formattedValue = numberFormatter(y);
          return (
            <div>
              <strong>{series.title}</strong>: {formattedValue}
            </div>
          );
        }}
        ariaLabel="Biometric Appointment Availability by Location"
        height={150}
        fitHeight
        empty={
          <Box textAlign="center" color="inherit">
            <b>No data available</b>
            <Box variant="p" color="inherit">
              There is no data available
            </Box>
          </Box>
        }
        noMatch={
          <Box textAlign="center" color="inherit">
            <b>No matching data</b>
            <Box variant="p" color="inherit">
              There is no matching data to display
            </Box>
            <Button>Clear filter</Button>
          </Box>
        }
      />
    </BoardItem>
  );
};

export default SS1;
export { SS1 };
