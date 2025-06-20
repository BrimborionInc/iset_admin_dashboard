import React from 'react';
import { Route, Switch, useLocation } from 'react-router-dom';
import {
  ContentLayout,
  Header,
  BreadcrumbGroup,
  Link,
  SpaceBetween,
  Button,
  ButtonDropdown,
  Box // Import Box component
} from '@cloudscape-design/components';
import AdminDashboard from '../pages/adminDashboardHomePage.js';
import AdminDashboardHelp from '../helpPanelContents/adminDashboardHelp.js'; // Default export
// Remove the old manageAppointments import

import UserManagementDashboard from '../pages/manageUsers.js';
import LocationsManagementDashboard from '../pages/manageLocations.js';
import ModifyLocation from '../pages/modifyLocation.js';
import NewLocationForm from '../pages/newLocationForm.js';
import CodeTablesDashboard from '../pages/codeTablesDashboard.js';
import TestConfigDashboard from '../pages/testConfigDashboard.js';
import ServiceModulesManagementDashboard from '../pages/manageServiceModules.js';
import ModifyServiceModule from '../pages/modifyServiceModule.js';
import BookAppointmentQ1 from '../previews/bookAppointmentQ1.js';
import BookAppointmentQ2 from '../previews/bookAppointmentQ2.js';
import BookAppointmentQ3 from '../previews/bookAppointmentQ3.js';
import BookAppointmentQ4 from '../previews/bookAppointmentQ4.js';
import BookAppointmentQ5 from '../previews/bookAppointmentQ5.js';
import BookAppointmentQ6 from '../previews/bookAppointmentQ6.js';
import BookAppointmentQ7 from '../previews/bookAppointmentQ7.js';
import BookAppointmentQ8 from '../previews/bookAppointmentQ8.js';
import Experiment from '../pages/experiment.js';
import ConfigurationSettings from '../pages/configurationSettings.js';
import ManageAppointments from '../pages/manageAppointments.js'; // Import the new component
import ModifyAppointment from '../pages/modifyAppointment.js'; // Import the new component
import ReportingAndMonitoringDashboard from '../pages/reportingAndMonitoringDashboard.js'; // Import the new component
import ManageFees from '../pages/manageFees.js'; // Import the new component
import ST6 from '../widgets/ST6'; // Import the new widget
import VisualSettings from '../pages/visualSettings.js'; // Import the new component
import ManageNotifications from '../pages/manageNotifications.js'; // Import the new component
import { ManageNotificationsHelp } from '../helpPanelContents/manageNotificationsHelp.js'; // Named export
import ManageAppointmentsHelp from '../helpPanelContents/manageAppointmentsHelp.js'; // Import the help panel content
import ManageTicketingDashboard from '../pages/manageTicketingDashboard'; // Import the new component
import ManageLocationsHelp from '../helpPanelContents/manageLocationsHelp'; // Import the help panel content
import NewAppointmentForm from '../pages/newAppointmentForm.js'; // Import the new component
import NewAppointmentFormHelp from '../helpPanelContents/newAppointmentFormHelp'; // Correct import path
import ManageMessages from '../pages/manageMessages.js'; // Import the new component
import ManageMessagesHelp from '../helpPanelContents/manageMessagesHelp.js'; // Import the help panel content
import ModifyComponent from '../pages/modifyIntakeStep.js'; // Import the new component
import ModifyComponentHelp from '../helpPanelContents/modifyComponentHelp.js'; // Import the help panel content
import ManageSecurityOptions from '../pages/manageSecurityOptions.js'; // Import the renamed component
import ManageIntakeSteps from '../pages/manageIntakeSteps.js'; // Import the renamed component
import ManageIntakeStepsHelpPanel from '../helpPanelContents/manageIntakeStepsHelpPanel'; // Correct the import path
import TestTable from '../pages/TestTable.jsx'; // Import the TestTable component
import QMSOperatorDemo from '../pages/QMSOperatorDemo'; // Import the QMS Operator Demo component
import ManageApplications from '../pages/manageApplications.js'; // Import the new component
import ManageOrganisations from '../pages/manageOrganisations.js'; // Import the new component
import CaseAssignmentDashboard from '../pages/caseAssignmentDashboard.js'; // Import the new component
import ApplicationCaseDashboard from '../pages/applicationCaseDashboard.js'; // Import the new component
import ArmsReportingDashboard from '../pages/armsReportingDashboard.js'; // Import the new component

const AppRoutes = ({
  toggleHelpPanel,
  updateBreadcrumbs,
  setSplitPanelOpen,
  splitPanelOpen,
  setSplitPanelSize,
  splitPanelSize,
  setAvailableItems,
  breadcrumbs,
  helpMessages,
}) => {
  const location = useLocation();

  const resetToDefaultLayout = () => {
    // Logic to reset the layout to default
    console.log('Resetting to default layout');
    setAvailableItems([]); // Reset available items
    // Add more logic as needed
  };

  const renderContent = (Component, breadcrumbs, headerText, helpKey, actions = null, context = "") => (
    <ContentLayout
      header={
        <Header
          variant="h1"
          info={<Link variant="info" onClick={() => toggleHelpPanel(helpKey, headerText, context)}>Info</Link>}
          actions={actions} // Attach actions here
        >
          {headerText}
        </Header>
      }
    >
      <BreadcrumbGroup items={breadcrumbs} />
      <Box padding={{ bottom: 'm' }} /> {/* Add space below BreadcrumbGroup */}
      <Component
        toggleHelpPanel={toggleHelpPanel}
        updateBreadcrumbs={updateBreadcrumbs}
        setSplitPanelOpen={setSplitPanelOpen}
        splitPanelOpen={splitPanelOpen}
        setSplitPanelSize={setSplitPanelSize}
        splitPanelSize={splitPanelSize}
        setAvailableItems={setAvailableItems}
      />
    </ContentLayout>
  );

  return (
    <Switch>
      <Route path="/experiment">
        {renderContent(Experiment, [{ text: 'Home', href: '/' }, { text: 'Experiment', href: '/experiment' }], 'Experiment Page', 'experiment')}
      </Route>
      <Route path="/manage-appointments-new">
        {renderContent(ManageAppointments, [{ text: 'Home', href: '/' }, { text: 'Manage Appointments', href: '/manage-appointments-new' }], 'Manage Appointments', ManageAppointmentsHelp.aiContext)}
      </Route>
      <Route path="/manage-messages">
        {renderContent(ManageMessages, [{ text: 'Home', href: '/' }, { text: 'Secure Client Messaging', href: '/manage-messages' }], 'Secure Client Messaging', ManageMessagesHelp.aiContext)}
      </Route>
      <Route path="/ptma-management">
        {renderContent(LocationsManagementDashboard, [{ text: 'Home', href: '/' }, { text: 'Manage PTMAs', href: '/ptma-management' }], 'Manage PTMAs', <ManageLocationsHelp />)}
      </Route>
      <Route path="/locations-management-dashboard">
        {renderContent(LocationsManagementDashboard, [{ text: 'Home', href: '/' }, { text: 'Manage Locations', href: '/locations-management-dashboard' }], 'Manage Locations', ManageLocationsHelp.aiContext)}
      </Route>
      <Route path="/modify-ptma/:id">
        {renderContent(ModifyLocation, [{ text: 'Home', href: '/' }, { text: 'Manage PTMAs', href: '/ptma-management' }, { text: 'Modify PTMA', href: '/modify-ptma/:id' }], 'Modify PTMA', 'modifyPtma')}
      </Route>
      <Route path="/user-management-dashboard">
        {renderContent(UserManagementDashboard, [{ text: 'Home', href: '/' }, { text: 'User Management', href: '/user-management-dashboard' }], 'User Management', 'userManagement')}
      </Route>
      <Route path="/new-location">
        {renderContent(NewLocationForm, [{ text: 'Home', href: '/' }, { text: 'Manage PTMAs', href: '/ptma-management' }, { text: 'New PTMA', href: '/new-location' }], 'New PTMA', 'newPtma')}
      </Route>
      <Route path="/code-tables-dashboard">
        {renderContent(CodeTablesDashboard, [{ text: 'Home', href: '/' }, { text: 'Code Tables', href: '/code-tables-dashboard' }], 'Code Tables', 'codeTables')}
      </Route>
      <Route path="/test-config-dashboard">
        {renderContent(
          TestConfigDashboard,
          [{ text: 'Home', href: '/' }, { text: 'Test Config Dashboard', href: '/test-config-dashboard' }],
          'Test Config Dashboard',
          'testConfigDashboard',
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={resetToDefaultLayout}>
              Reset to default layout
            </Button>
            <Button
              onClick={() => setSplitPanelOpen(true)}
            >
              + Add widget
            </Button>
          </SpaceBetween>
        )}
      </Route>
      <Route path="/service-modules-management-dashboard">
        {renderContent(ServiceModulesManagementDashboard, [{ text: 'Home', href: '/' }, { text: 'Manage Service Modules', href: '/service-modules-management-dashboard' }], 'Manage Service Modules', 'serviceModulesManagement')}
      </Route>
      <Route path="/modify-service-module/:id">
        {renderContent(ModifyServiceModule, [{ text: 'Home', href: '/' }, { text: 'Manage Service Modules', href: '/service-modules-management-dashboard' }, { text: 'Modify Service Module', href: '/modify-service-module/:id' }], 'Modify Service Module', 'modifyServiceModule')}
      </Route>
      <Route path="/book-appointment-q1">
        {renderContent(BookAppointmentQ1, [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q1', href: '/book-appointment-q1' }], 'Book Appointment Q1', 'bookAppointmentQ1')}
      </Route>
      <Route path="/book-appointment-q2">
        {renderContent(BookAppointmentQ2, [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q2', href: '/book-appointment-q2' }], 'Book Appointment Q2', 'bookAppointmentQ2')}
      </Route>
      <Route path="/book-appointment-q3">
        {renderContent(BookAppointmentQ3, [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q3', href: '/book-appointment-q3' }], 'Book Appointment Q3', 'bookAppointmentQ3')}
      </Route>
      <Route path="/book-appointment-q4">
        {renderContent(BookAppointmentQ4, [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q4', href: '/book-appointment-q4' }], 'Book Appointment Q4', 'bookAppointmentQ4')}
      </Route>
      <Route path="/book-appointment-q5">
        {renderContent(BookAppointmentQ5, [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q5', href: '/book-appointment-q5' }], 'Book Appointment Q5', 'bookAppointmentQ5')}
      </Route>
      <Route path="/book-appointment-q6">
        {renderContent(BookAppointmentQ6, [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q6', href: '/book-appointment-q6' }], 'Book Appointment Q6', 'bookAppointmentQ6')}
      </Route>
      <Route path="/book-appointment-q7">
        {renderContent(BookAppointmentQ7, [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q7', href: '/book-appointment-q7' }], 'Book Appointment Q7', 'bookAppointmentQ7')}
      </Route>
      <Route path="/book-appointment-q8">
        {renderContent(BookAppointmentQ8, [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q8', href: '/book-appointment-q8' }], 'Book Appointment Q8', 'bookAppointmentQ8')}
      </Route>
      <Route path="/configuration-settings">
        {renderContent(ConfigurationSettings, [{ text: 'Home', href: '/' }, { text: 'Configuration Settings', href: '/configuration-settings' }], 'Configuration Settings', 'configurationSettings')}
      </Route>
      <Route path="/modify-appointment/:id">
        {renderContent(ModifyAppointment, [{ text: 'Home', href: '/' }, { text: 'Manage Appointments', href: '/manage-appointments-new' }, { text: 'Modify Appointment', href: '/modify-appointment/:id' }], 'Modify Appointment', 'modifyAppointment')}
      </Route>
      <Route path="/reporting-and-monitoring-dashboard">
        {renderContent(
          ReportingAndMonitoringDashboard,
          [{ text: 'Home', href: '/' }, { text: 'Reporting and Monitoring', href: '/reporting-and-monitoring-dashboard' }],
          'Reporting and Monitoring',
          'reportingAndMonitoring',
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={resetToDefaultLayout}>
              Reset to default layout
            </Button>
            <Button
              onClick={() => setSplitPanelOpen(true)}
            >
              + Add widget
            </Button>
          </SpaceBetween>
        )}
      </Route>
      <Route path="/manage-fees">
        {renderContent(ManageFees, [{ text: 'Home', href: '/' }, { text: 'Manage Fees', href: '/manage-fees' }], 'Manage Fees', 'manageFees')}
      </Route>
      <Route path="/visual-settings">
        {renderContent(VisualSettings, [{ text: 'Home', href: '/' }, { text: 'Visual Settings', href: '/visual-settings' }], 'Visual Settings', 'visualSettings')}
      </Route>
      <Route path="/manage-notifications">
        {renderContent(ManageNotifications, [{ text: 'Home', href: '/' }, { text: 'Manage Notifications', href: '/manage-notifications' }], 'Manage Notifications', <ManageNotificationsHelp />)}
      </Route>
      <Route path="/manage-ticketing-dashboard">
        {renderContent(ManageTicketingDashboard, [{ text: 'Home', href: '/' }, { text: 'Manage Ticketing', href: '/manage-ticketing-dashboard' }], 'Manage Ticketing', 'manageTicketing')}
      </Route>
      <Route path="/new-appointment-form">
        {renderContent(
          NewAppointmentForm,
          [
            { text: 'Home', href: '/' },
            { text: 'Manage Appointments', href: '/manage-appointments-new' },
            { text: 'New Appointment', href: '/new-appointment-form' }
          ],
          'Book a New Appointment',
          <NewAppointmentFormHelp />,
          null,
          NewAppointmentFormHelp.aiContext
        )}
      </Route>

      <Route path="/modify-component/:id">
        {renderContent(ModifyComponent, [{ text: 'Home', href: '/' }, { text: 'Manage Components', href: '/manage-components' }, { text: 'Modify Component', href: '/modify-component/:id' }], 'Modify Component', <ModifyComponentHelp />)}
      </Route>
      <Route path="/manage-security-options">
        {renderContent(ManageSecurityOptions, [{ text: 'Home', href: '/' }, { text: 'Security Settings', href: '/manage-security-options' }], 'Security Settings', 'manageSecurityOptions')}
      </Route>
      <Route path="/manage-components">
        {renderContent(ManageIntakeSteps, [{ text: 'Home', href: '/' }, { text: 'Manage Intake Steps', href: '/manage-components' }], 'Manage Intake Steps', <ManageIntakeStepsHelpPanel />)}
        {renderContent(ManageIntakeSteps, [{ text: 'Home', href: '/' }, { text: 'Manage Intake Steps', href: '/manage-components' }], 'Manage Intake Steps', <ManageIntakeStepsHelpPanel />)}
      </Route>
      <Route path="/test-table">
        {renderContent(TestTable, [{ text: 'Home', href: '/' }, { text: 'Test Table', href: '/test-table' }], 'Test Table', 'testTable')}
      </Route>
      <Route exact path="/qms-operator-demo">
        {renderContent(QMSOperatorDemo, [{ text: 'Home', href: '/' }, { text: 'QMS Operator Demo', href: '/qms-operator-demo' }], 'QMS Operator Demo', 'qmsOperatorDemo')}
      </Route>
      <Route path="/manage-applications">
        {renderContent(ManageApplications, [{ text: 'Home', href: '/' }, { text: 'Case Management', href: '/manage-applications' }], 'Case Management', 'manageApplications')}
      </Route>
      <Route path="/case-management">
        {renderContent(ManageApplications, [{ text: 'Home', href: '/' }, { text: 'Case Management', href: '/case-management' }], 'Case Management', 'caseManagement')}
      </Route>
      <Route path="/manage-organisations">
        {renderContent(ManageOrganisations, [{ text: 'Home', href: '/' }, { text: 'Manage ISET Holders', href: '/manage-organisations' }], 'Manage ISET Holders', 'manageOrganisations')}
      </Route>
      <Route path="/case-assignment-dashboard">
        {renderContent(CaseAssignmentDashboard, [
          { text: 'Home', href: '/' },
          { text: 'Case Assignment', href: '/case-assignment-dashboard' }
        ], 'Case Assignment', 'caseAssignment')}
      </Route>
      <Route path="/application-case/:id">
        {renderContent(ApplicationCaseDashboard, [{ text: 'Home', href: '/' }, { text: 'Case Management', href: '/case-management' }, { text: 'Application' }], 'ISET Application Management', 'applicationCaseDashboard')}
      </Route>
      <Route path="/arms-reporting">
        {renderContent(ArmsReportingDashboard, [
          { text: 'Home', href: '/' },
          { text: 'ARMS Reporting', href: '/arms-reporting' }
        ], 'ARMS Reporting', 'armsReporting')}
      </Route>
      <Route path="/">
        {renderContent(AdminDashboard, [{ text: 'Home', href: '/' }, { text: 'Admin Console', href: '#' }], 'Secure Solution Suite Admin Console', AdminDashboardHelp.aiContext)}
      </Route>
    </Switch>
  );
};

export default AppRoutes;
