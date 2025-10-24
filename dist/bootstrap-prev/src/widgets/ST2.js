import React, { useState, useContext } from 'react';
import { Box, Header, ButtonDropdown, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import BarChart from '@cloudscape-design/components/bar-chart';
import Button from '@cloudscape-design/components/button';
import { LocationContext } from '../context/LocationContext';
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

const ST2 = ({ actions, toggleHelpPanel }) => {
  const { selectedLocations } = useContext(LocationContext);
  const [hideLegend, setHideLegend] = useState(true);
  const [hideFilter, setHideFilter] = useState(true);
  const threshold = 95;

  const helpPanelContent = (
    <div>
      <h2>Service Target ST2 Help</h2>
      <p>3.2 Service Target 2 (ST2) – Timely Package Scan Out</p>
      <p>3.2.1 The Contractor must measure its performance against this Service Target using data from the Package Tracking Solution. For the purpose of this Service Target, a package is considered as "pending delivery" if it was identified in the Package Tracking Solution as:</p>
      <ul>
        <li>a) "Received" as per Section 4.8.3.3.b)i of this Annex; and</li>
        <li>b) "Complete" as per Section 4.8.3.3.b)ii of this Annex.</li>
      </ul>
      <p>3.2.2 The Contractor must measure the package scan out time as follows:</p>
      <ul>
        <li>a) For a Hub VAC or a VAC that is not in a Hub and Spoke arrangement, the Contractor must measure its performance against this Service Target from the point in time each package is identified as “Received” and “Complete” to the point in time it was scanned out for transmission to the IRCC-Specified Office in the Package Tracking Solution and sent to the IRCC-Specified Office; and</li>
        <li>b) For a Spoke VAC, the Contractor must measure its performance against this Service Target from the point in time each package is identified as “Received” and “Complete” to the point in time it was scanned out for transmission to the Hub VAC in the Package Tracking Solution and sent to the Hub VAC.</li>
      </ul>
    </div>
  );

  const toggleLegend = () => {
    setHideLegend(!hideLegend);
  };

  const toggleFilter = () => {
    setHideFilter(!hideFilter);
  };

  const series = selectedLocations.map(location => {
    const value = generateRandomValue(); // Replace with actual calculation logic
    return {
      title: `Timely Package Scan Out (${location.label})`,
      type: "bar",
      data: [{ x: location.label, y: value }],
      color: getColor(value, threshold)
    };
  });

  series.push({
    title: "Service Target",
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
            <Link variant="info" onFollow={() => toggleHelpPanel(helpPanelContent, "Service Target ST2 Help")}>
              Info
            </Link>
          }
        >
          Timely Package Scan Out
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
        series={series}
        xDomain={xDomain}
        yDomain={[90, 100]}
        hideLegend={hideLegend}
        hideFilter={hideFilter}
        yTitle={`ST2 - ${selectedLocations.map(location => location.label).join(', ')}`}
        i18nStrings={{
          xTickFormatter: e => e,
          yTickFormatter: numberFormatter,
          filterLabel: 'Category Picker',
          filterPlaceholder: 'Category Filter',
          filterSelectedAriaLabel: 'Category Filter'
        }}
        detailPopoverSeriesContent={({ series, y }) => {
          const formattedValue = numberFormatter(y);
          return (
            <div>
              <strong>{series.title}</strong>: {formattedValue}
            </div>
          );
        }}
        ariaLabel="Timely Package Scan Out by Location"
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

export default ST2;
export { ST2 };
