import React, { useState } from 'react';
import { DateRangePicker } from '@cloudscape-design/components';
import '@cloudscape-design/global-styles/index.css'; // Import Cloudscape styles

function App() {
  const [selectedRange, setSelectedRange] = useState({
    type: 'relative',
    amount: 1,
    unit: 'day',
  });

  const relativeOptions = [
    { key: 'day', amount: 1, unit: 'day', type: 'relative', label: 'Last 1 day' },
    { key: 'week', amount: 1, unit: 'week', type: 'relative', label: 'Last 1 week' },
    { key: 'month', amount: 1, unit: 'month', type: 'relative', label: 'Last 1 month' },
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '400px' }}>
      <h1>Date Range Picker Example</h1>
      <DateRangePicker
        onChange={({ detail }) => setSelectedRange(detail.value)}
        value={selectedRange}
        relativeOptions={relativeOptions}
        i18nStrings={{
          relativeModeTitle: 'Relative mode',
          absoluteModeTitle: 'Absolute mode',
          relativeRangeSelectionHeading: 'Select time range',
          customRelativeRangeOptionLabel: 'Custom range',
          formatRelativeRange: e => `Last ${e.amount} ${e.unit}${e.amount > 1 ? 's' : ''}`,
          formatUnit: unit => unit,
          applyButtonLabel: 'Apply',
          cancelButtonLabel: 'Cancel',
          clearButtonLabel: 'Clear',
        }}
      />
      <div style={{ marginTop: '20px' }}>
        <strong>Selected Range:</strong> {JSON.stringify(selectedRange)}
      </div>
    </div>
  );
}

export default App;
