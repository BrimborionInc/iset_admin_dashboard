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
  return Math.random() * (100 - 92) + 92;
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

const ServiceStandard1 = ({ actions, toggleHelpPanel }) => {
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
          Biometric Appointment Punctuality
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
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions.removeItem()}
        />
      }
    >
      <BarChart
        series={[
          {
            title: "Punctuality",
            type: "bar",
            data: [
              { x: "Islamabad", y: generateRandomValue() },
              { x: "Karachi", y: generateRandomValue() },
              { x: "Lahore", y: generateRandomValue() }
            ],
            valueFormatter: numberFormatter
          },
          {
            title: "Service Standard",
            type: "threshold",
            y: 95,
            valueFormatter: e =>
              e.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })
          }
        ]}
        xDomain={["Islamabad", "Karachi", "Lahore"]}
        yDomain={[90, 100]}
        hideFilter
        i18nStrings={{
          xTickFormatter: e => e,
          yTickFormatter: numberFormatter
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
        yTitle='SS2'
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

const SS2 = ({ actions, toggleHelpPanel }) => {
  const { selectedLocations } = useContext(LocationContext); // Use LocationContext
  const [hideLegend, setHideLegend] = useState(true); // Legend hidden by default
  const threshold = 95;

  const helpPanelContent = (
    <div>
      <h2>Service Standard SS2 Help</h2>
      <p>1.2 Biometric Collection Service Appointment Punctuality</p>
      <p>1.2.1 The Contractor must compare the time of the reserved appointment through the Appointment Booking Solution as per Section 4.5.3.8.b)iv of this Annex against the time the appointment started through the Queue Management Solution as per Section 4.6.3.2.i) of this Annex without manual intervention.</p>
      <p>1.2.2 The Contractor must report the arrival time of the Applicant as follows:</p>
      <ul>
        <li>a) For Applicants arriving at or before scheduled appointment time, the arrival time will be deemed to be the scheduled start time of the appointment;</li>
        <li>b) For Applicants arriving late but up to and including 15 minutes from the scheduled appointment time, the arrival time is considered as the Applicants arrival time at the VAC.</li>
      </ul>
      <p>1.2.3 The Contractor must report as having met the Service Standard for Biometric Collection Service Appointment Timeliness if the Applicant doesn’t show up for the appointment or arrives more than 15 minutes after the scheduled appointment time.</p>
      <p>1.2.4 The start time of an appointment is defined as the moment a Contractor Resource receives an Applicant at the appropriate dedicated space as defined in Appendix A – Dedicated Spaces in this Annex and starts delivering the Service(s) requested by the Applicant.</p>
    </div>
  );

  const toggleLegend = () => {
    setHideLegend(!hideLegend);
  };

  const series = selectedLocations.map(location => {
    const value = generateRandomValue();
    return {
      title: `Punctuality (${location.label})`,  // Unique title per location
      type: "bar",
      data: [{ x: location.label, y: value }],  
      color: getColor(value, threshold)  // Correctly applies color
    };
  });

  series.push({
    title: "Service Standard",
    type: "threshold",
    y: threshold,
    color: "black",
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
            <Link variant="info" onFollow={() => toggleHelpPanel(helpPanelContent, "Service Standard SS2 Help")}>
              Info
            </Link>
          }
        >
          Biometric Appointment Punctuality
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
            { id: 'toggle-legend', text: hideLegend ? 'Show Legend' : 'Hide Legend' }
          ]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={(e) => {
            if (e.detail.id === 'toggle-legend') {
              toggleLegend();
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
        hideFilter
        yTitle={`SS2 - ${selectedLocations.map(location => location.label).join(', ')}`} // Add country names to yTitle
        i18nStrings={{
          xTickFormatter: e => e,
          yTickFormatter: numberFormatter
        }}
        detailPopoverSeriesContent={({ series, y }) => {
          const formattedValue = numberFormatter(y);
          return (
            <div>
              <strong>{series.title}</strong>: {formattedValue}
            </div>
          );
        }}
        ariaLabel="Biometric Appointment Punctuality by Location"
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

export default SS2;
export { SS2 };
