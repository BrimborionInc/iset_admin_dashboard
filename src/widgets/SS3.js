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

const SS3 = ({ actions, toggleHelpPanel }) => {
  const { selectedLocations } = useContext(LocationContext); // Use LocationContext
  const [hideLegend, setHideLegend] = useState(true); // Legend hidden by default
  const [hideFilter, setHideFilter] = useState(true); // Filter hidden by default
  const threshold = 95;

  const helpPanelContent = (
    <div>
      <h2>Service Standard SS3 Help</h2>
      <p>1.3 Biometric Collection Service Delivery in Language of Choice</p>
      <p>1.3.1 The Contractor must measure its performance against the following Service Standards (SS) through the Queue Management Solution that it is required to provide and maintain, pursuant to Section 4.6 of this Annex:</p>
      <ul>
        <li>a) SS3.1 – Biometric Collection Service Delivery in French;</li>
        <li>b) SS3.2 – Biometric Collection Service Delivery in English;</li>
        <li>c) SS3.3 – Biometric Collection Service Delivery in Predominant Local Language(s); and</li>
        <li>d) SS3.4 – Biometric Collection Service Delivery in Additional Language(s).</li>
      </ul>
      <p>1.3.2 The Contractor must compare the Applicant’s Language of Choice selected in the Queue Management Solution as per Section 4.6.3.1.b)ii of this Annex for walk-in service delivery or in the Appointment Booking Solution as per Section 4.5.3.8.b)vii of this Annex for service delivery with appointment, to the language of operation used for service delivery as recorded in the Queue Management Solution pursuant to Section 4.6.3.2.j) of this Annex.</p>
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
            <Link variant="info" onFollow={() => toggleHelpPanel(helpPanelContent, "Service Standard SS3 Help")}>
              Info
            </Link>
          }
        >
          Biometric Delivery in Language of Choice
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
      settings={
        <ButtonDropdown
          items={[
            { id: 'remove', text: 'Remove Widget' },
            { id: 'toggle-legend', text: hideLegend ? 'Show Legend' : 'Hide Legend' },
            { id: 'toggle-filter', text: hideFilter ? 'Show Filter' : 'Hide Filter' }
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
        yTitle={`SS3 - ${selectedLocations.map(location => location.label).join(', ')}`} // Add country names to yTitle
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
        ariaLabel="Biometric Collection Service Delivery in Language of Choice by Location"
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

export default SS3;
export { SS3 };
