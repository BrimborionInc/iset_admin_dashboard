export const helpMessages = {
  overview: (
    <div>
      <p>
        Leadership snapshot for agreement-wide financial health, compliance posture, and upcoming milestones.
      </p>

      <h3>Concept</h3>
      <p>
        Give Executive Directors and Finance Officers immediate insight into budget burn, administrative caps, monitoring
        status, and report readiness without drilling into individual sub-pages.
      </p>

      <h3>Key user goals</h3>
      <ul>
        <li>Assess current spend vs. budget and forecast year-end position at a glance.</li>
        <li>Track upcoming reporting deadlines, certification tasks, and XML submission status.</li>
        <li>Stay aware of compliance risks (capacity tier changes, outstanding findings, evidence coverage gaps).</li>
      </ul>

      <h3>Provisional widgets</h3>
      <ul>
        <li>KPI board tiles: total budget vs. spent, admin flat-rate utilised, evidence coverage, forecast variance.</li>
        <li>Trend chart showing month-by-month spend vs. forecasted spend.</li>
        <li>Compliance strip with capacity tier, next monitoring date, unresolved findings count.</li>
        <li>Deadline panel listing next interim/year-end report milestones and XML validation status.</li>
      </ul>

      <h3>Dependencies &amp; notes</h3>
      <ul>
        <li>Requires aggregation over all active agreements and sub-agreements.</li>
        <li>Should consume telemetry emitted by reporting service for submission and validation states.</li>
        <li>Expect to surface quick links that deep-link to Budgets, Reports, and Monitoring views with filters applied.</li>
      </ul>
    </div>
  ),
  userManagement: (
    <div>
      <p>
        The User Management Dashboard allows administrators to manage users and roles within the system. 
        You can view, create, modify, and delete users and roles.
      </p>

      <h3>Users</h3>
      <p>
        The Users section displays a list of all users in the system. You can perform the following actions:
      </p>
      <ul>
        <li><b>View Users:</b> See detailed information about each user, including their ID, name, email, and role.</li>
        <li><b>Create User:</b> Add a new user to the system by clicking the "Create user" button.</li>
        <li><b>Modify User:</b> Edit user details by clicking the "Modify" link next to the user.</li>
        <li><b>Delete User:</b> Remove a user from the system.</li>
      </ul>

      <h3>Roles</h3>
      <p>
        The Roles section displays a list of all roles in the system. You can perform the following actions:
      </p>
      <ul>
        <li><b>View Roles:</b> See detailed information about each role, including its ID, name, and description.</li>
        <li><b>Create Role:</b> Add a new role to the system by clicking the "Create role" button.</li>
        <li><b>Modify Role:</b> Edit role details by clicking the "Modify" link next to the role.</li>
        <li><b>Delete Role:</b> Remove a role from the system.</li>
      </ul>

      <h3>Filtering and Pagination</h3>
      <p>
        Use the filtering options to quickly find specific users or roles. The pagination controls allow you to navigate through the list of users and roles.
      </p>

      <h3>Preferences</h3>
      <p>
        Customize your view by setting preferences for page size, content display, and more.
      </p>

      <h3>Learn More</h3>
      <ul>
        <li><a href="https://example.com/documentation/user-management">User Management Documentation</a></li>
        <li><a href="https://example.com/documentation/roles-management">Roles Management Documentation</a></li>
      </ul>
    </div>
  ),
  users: (
    <div>
      <p>
        The Users section displays a list of all users in the system. You can perform the following actions:
      </p>
      <ul>
        <li><b>View Users:</b> See detailed information about each user, including their ID, name, email, and role.</li>
        <li><b>Create User:</b> Add a new user to the system by clicking the "Create user" button.</li>
        <li><b>Modify User:</b> Edit user details by clicking the "Modify" link next to the user.</li>
        <li><b>Delete User:</b> Remove a user from the system.</li>
      </ul>
    </div>
  ),
  roles: (
    <div>
      <p>
        The Roles section displays a list of all roles in the system. You can perform the following actions:
      </p>
      <ul>
        <li><b>View Roles:</b> See detailed information about each role, including its ID, name, and description.</li>
        <li><b>Create Role:</b> Add a new role to the system by clicking the "Create role" button.</li>
        <li><b>Modify Role:</b> Edit role details by clicking the "Modify" link next to the role.</li>
        <li><b>Delete Role:</b> Remove a role from the system.</li>
      </ul>
    </div>
  ),
  filterAppointments: (
    <div>
      <h2>Filter Appointments</h2>
      <p>
        Use the filter options to narrow down the list of appointments based on various criteria such as appointment ID, service, country, location, and date range.
      </p>
      <ul>
        <li><b>Search by Appointment ID / Name:</b> Enter the appointment ID or name to search for specific appointments.</li>
        <li><b>Filter by Service:</b> Select a service to filter appointments based on the service type.</li>
        <li><b>Filter by Country:</b> Select a country to filter appointments based on the country.</li>
        <li><b>Filter by Location:</b> Select a location to filter appointments based on the location.</li>
        <li><b>Filter by Date:</b> Select a date range to filter appointments based on the appointment date.</li>
      </ul>
    </div>
  ),
  sendEmail: (
    <div>
      <h2>Send Email Notification</h2>
      <p>
        Use this section to send email notifications to the filtered list of appointments. You can specify the email subject and body.
      </p>
      <ul>
        <li><b>Email Subject:</b> Enter the subject of the email.</li>
        <li><b>Email Body:</b> Enter the body of the email message.</li>
        <li><b>Send Email:</b> Click the "Send Email to Filtered List" button to send the email to the filtered appointments.</li>
      </ul>
    </div>
  ),
  manageAppointments: (
    <div>
      <h2>Manage Appointments</h2>
      <p>
        This section displays a list of all appointments. You can view, create, modify, and delete appointments.
      </p>
      <ul>
        <li><b>View Appointments:</b> See detailed information about each appointment, including ID, applicant name, service, location, date, time, and status.</li>
        <li><b>Create Appointment:</b> Add a new appointment by clicking the "Create appointment" button.</li>
        <li><b>Modify Appointment:</b> Edit appointment details by clicking the "Modify" link next to the appointment.</li>
        <li><b>Delete Appointment:</b> Remove an appointment from the system.</li>
      </ul>
    </div>
  ),
  // Add more help messages as needed
};
