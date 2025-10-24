import React from 'react';
import { Alert, SpaceBetween } from '@cloudscape-design/components';

const ManageLocationsHelp = () => (
  <div>
    <SpaceBetween direction="vertical" size="s">
      <Alert type="warning" header="Known Bugs">
        <p>"Warnings, Queue Time and Capacity are not curretnly enabled vs the Database</p>
      </Alert>
      <Alert type="info" header="Development Notes">
        <p>Need to implement emergency slots.</p>
        <p>Need to add availability and queue time to the main locations table + other useful at a glance stuff.</p>
        <p>Need make the headings meaninful - mayby dro the region and add filter function for longer lists of locations</p>
        <p>Need either drop the "table settings" or implement them in code.</p>
      </Alert>
    </SpaceBetween>
    <h2>Locations Dashboard</h2>
    <p>The Manage Locations dashboard is used to oversee and manage the various locations where services are provided.</p>
    <p>Cicking "New Location" allows you to enter the basic information about the new location.  You can then save and Modify the new location to complete its configuration</p>
    <p>Deleting a location is not recommended - instead modify its status to "inactive".  A location can only be deleted once it has been purged of booked appointments.</p>
  </div>
);

export default ManageLocationsHelp;
