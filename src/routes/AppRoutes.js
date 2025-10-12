import ManageWorkflows from '../pages/manageWorkflows.js';
import ManageWorkflowsHelpPanel from '../helpPanelContents/manageWorkflowsHelpPanel';
import React from 'react';
import { isIamOn, hasValidSession, getIdTokenClaims, getRoleFromClaims, buildLoginUrl } from '../auth/cognito';
import { useRoleMatrix, toCanonicalRole } from '../context/RoleMatrixContext';
import { Route, Switch } from 'react-router-dom';
import ModifyWorkflow from '../pages/modifyWorkflow.js';
import {
  ContentLayout,
  Header,
  BreadcrumbGroup,
  Link,
  SpaceBetween,
  Button,
  Box // Import Box component
} from '@cloudscape-design/components';
import AdminDashboard from '../pages/adminDashboardHomePage.js';
import AdminDashboardHelp from '../helpPanelContents/adminDashboardHelp.js'; // Default export
// Remove the old manageAppointments import

import UserManagementDashboard from '../pages/manageUsers.js';
import LocationsManagementDashboard from '../pages/manageLocations.js';
import ModifyLocation from '../pages/modifyLocation.js';
import NewLocationForm from '../pages/newLocationForm.js';
import BookAppointmentQ1 from '../previews/bookAppointmentQ1.js';
import BookAppointmentQ2 from '../previews/bookAppointmentQ2.js';
import BookAppointmentQ3 from '../previews/bookAppointmentQ3.js';
import BookAppointmentQ4 from '../previews/bookAppointmentQ4.js';
import BookAppointmentQ5 from '../previews/bookAppointmentQ5.js';
import BookAppointmentQ6 from '../previews/bookAppointmentQ6.js';
import BookAppointmentQ7 from '../previews/bookAppointmentQ7.js';
import BookAppointmentQ8 from '../previews/bookAppointmentQ8.js';
import ConfigurationSettings from '../pages/configurationSettings.js';
import ReportingAndMonitoringDashboard from '../pages/reportingAndMonitoringDashboard.js'; // Import the new component
import ManageNotifications from '../pages/manageNotifications.js'; // Import the new component
import { ManageNotificationsHelp } from '../helpPanelContents/manageNotificationsHelp.js'; // Named export
import ManageLocationsHelp from '../helpPanelContents/manageLocationsHelp'; // Import the help panel content
import ModifyComponent from '../pages/modifyIntakeStep.js'; // Import the new component
import ModifyIntakeStepHelp from '../helpPanelContents/modifyIntakeStep.js'; // Renamed help panel content
import ManageSecurityOptions from '../pages/manageSecurityOptions.js'; // Import the renamed component
import AccessControlDashboard from '../pages/accessControlDashboard.js';
import ManageIntakeSteps from '../pages/manageIntakeSteps.js'; // Import the renamed component
import ManageIntakeStepsHelpPanel from '../helpPanelContents/manageIntakeStepsHelpPanel'; // Correct the import path
import CaseAssignmentDashboard from '../pages/caseAssignmentDashboard.js'; // Import the new component
import ApplicationCaseDashboard from '../pages/applicationCaseDashboard.js'; // Import the new component
import CaseAssignmentDashboardHelp from '../helpPanelContents/caseAssignmentDashboardHelp.js';
import ApplicationCaseDashboardHelp from '../helpPanelContents/applicationCaseDashboardHelp.js';
import ArmsReportingDashboard from '../pages/armsReporting.js'; // Import the new component
import NWACHubManagementDashboard from '../pages/nwacHubManagement.js'; // Import the NWAC Hub Management dashboard
import AuthCallback from '../pages/AuthCallback.js';
import UploadConfigDashboard from '../pages/uploadConfigDashboard.js';
import EventCaptureDashboard from '../pages/configuration/EventCaptureDashboard.js';

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
  const { roleMatrix, isLoading: roleMatrixLoading } = useRoleMatrix();

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

  function Guard({ children, roles, path }) {
    const iamOn = isIamOn();
    if (!iamOn) return children;
    if (!hasValidSession()) {
      const AuthRequired = () => (
        <div style={{ padding: 24 }}>
          <p style={{ marginBottom: 12 }}>Please sign in to access this page.</p>
          <Button variant="primary" onClick={() => window.location.assign(buildLoginUrl())}>Sign in</Button>
        </div>
      );
      return renderContent(AuthRequired, [{ text: 'Home', href: '/' }], 'Authentication required');
    }
    const claims = getIdTokenClaims();
    if (!roles && (roleMatrixLoading || !roleMatrix)) {
      return children;
    }
    const role = toCanonicalRole(getRoleFromClaims(claims));
    const allowed = (() => {
      if (Array.isArray(roles) && roles.length) return roles;
      if (path && roleMatrix?.routes) {
        // Try exact match, then match by removing params (e.g., :id)
        const direct = roleMatrix.routes[path];
        if (direct) return direct;
      }
      return null;
    })();
    if (allowed) {
      if (!role || !allowed.includes(role)) {
        const AccessDenied = () => (<div style={{ padding: 24 }}>You do not have permission to view this page.</div>);
        return renderContent(AccessDenied, [{ text: 'Home', href: '/' }], 'Access denied');
      }
    } else if (roleMatrix?.default === 'deny') {
      const AccessDenied = () => (<div style={{ padding: 24 }}>You do not have permission to view this page.</div>);
      return renderContent(AccessDenied, [{ text: 'Home', href: '/' }], 'Access denied');
    }
    return children;
  }

  return (
    <Switch>
      <Route path="/auth/callback">
        <AuthCallback />
      </Route>

      <Route path="/manage-workflows">
        <Guard roles={['System Administrator']} path="/manage-workflows">
          {renderContent(
            ManageWorkflows,
            [
              { text: 'Home', href: '/' },
              { text: 'Intake Editor', href: '/manage-components' },
              { text: 'Manage Workflows', href: '/manage-workflows' }
            ],
            'Manage Workflows',
            <ManageWorkflowsHelpPanel />
          )}
        </Guard>
      </Route>

      <Route path="/modify-workflow">
        <Guard roles={['System Administrator']} path="/modify-workflow">
          {renderContent(
            ModifyWorkflow,
            [
              { text: 'Home', href: '/' },
              { text: 'Manage Workflows', href: '/manage-workflows' },
              { text: 'Modify Workflow', href: '/modify-workflow' }
            ],
            'Modify Workflow',
            'modifyWorkflow'
          )}
        </Guard>
      </Route>

      <Route path="/ptma-management">
        <Guard path="/ptma-management">
          {renderContent(
            LocationsManagementDashboard,
            [{ text: 'Home', href: '/' }, { text: 'Manage PTMAs', href: '/ptma-management' }],
            'Manage PTMAs',
            <ManageLocationsHelp />
          )}
        </Guard>
      </Route>

      <Route path="/locations-management-dashboard">
        {renderContent(
          LocationsManagementDashboard,
          [{ text: 'Home', href: '/' }, { text: 'Manage Locations', href: '/locations-management-dashboard' }],
          'Manage Locations',
          ManageLocationsHelp.aiContext
        )}
      </Route>

      <Route path="/modify-ptma/:id">
        {renderContent(
          ModifyLocation,
          [{ text: 'Home', href: '/' }, { text: 'Manage PTMAs', href: '/ptma-management' }, { text: 'Modify Location', href: '/modify-ptma/:id' }],
          'Manage Location',
          'modifyPtma'
        )}
      </Route>

      <Route path="/user-management-dashboard">
        <Guard path="/user-management-dashboard">
          {renderContent(
            UserManagementDashboard,
            [{ text: 'Home', href: '/' }, { text: 'User Management', href: '/user-management-dashboard' }],
            'User Management',
            'userManagement'
          )}
        </Guard>
      </Route>

      <Route path="/new-location">
        {renderContent(
          NewLocationForm,
          [{ text: 'Home', href: '/' }, { text: 'Manage PTMAs', href: '/ptma-management' }, { text: 'New PTMA', href: '/new-location' }],
          'New PTMA',
          'newPtma'
        )}
      </Route>

      <Route path="/book-appointment-q1">
        {renderContent(
          BookAppointmentQ1,
          [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q1', href: '/book-appointment-q1' }],
          'Book Appointment Q1',
          'bookAppointmentQ1'
        )}
      </Route>

      <Route path="/book-appointment-q2">
        {renderContent(
          BookAppointmentQ2,
          [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q2', href: '/book-appointment-q2' }],
          'Book Appointment Q2',
          'bookAppointmentQ2'
        )}
      </Route>

      <Route path="/book-appointment-q3">
        {renderContent(
          BookAppointmentQ3,
          [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q3', href: '/book-appointment-q3' }],
          'Book Appointment Q3',
          'bookAppointmentQ3'
        )}
      </Route>

      <Route path="/book-appointment-q4">
        {renderContent(
          BookAppointmentQ4,
          [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q4', href: '/book-appointment-q4' }],
          'Book Appointment Q4',
          'bookAppointmentQ4'
        )}
      </Route>

      <Route path="/book-appointment-q5">
        {renderContent(
          BookAppointmentQ5,
          [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q5', href: '/book-appointment-q5' }],
          'Book Appointment Q5',
          'bookAppointmentQ5'
        )}
      </Route>

      <Route path="/book-appointment-q6">
        {renderContent(
          BookAppointmentQ6,
          [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q6', href: '/book-appointment-q6' }],
          'Book Appointment Q6',
          'bookAppointmentQ6'
        )}
      </Route>

      <Route path="/book-appointment-q7">
        {renderContent(
          BookAppointmentQ7,
          [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q7', href: '/book-appointment-q7' }],
          'Book Appointment Q7',
          'bookAppointmentQ7'
        )}
      </Route>

      <Route path="/book-appointment-q8">
        {renderContent(
          BookAppointmentQ8,
          [{ text: 'Home', href: '/' }, { text: 'Book Appointment Q8', href: '/book-appointment-q8' }],
          'Book Appointment Q8',
          'bookAppointmentQ8'
        )}
      </Route>

      <Route path="/configuration-settings">
        <Guard roles={['System Administrator']} path="/configuration-settings">
          {renderContent(
            ConfigurationSettings,
            [{ text: 'Home', href: '/' }, { text: 'Configuration Settings', href: '/configuration-settings' }],
            'Configuration Settings',
            'configurationSettings'
          )}
        </Guard>
      </Route>

      <Route path="/configuration/events">
        <Guard roles={['System Administrator']} path="/configuration/events">
          {renderContent(
            EventCaptureDashboard,
            [
              { text: 'Home', href: '/' },
              { text: 'Configuration', href: '/configuration-settings' },
              { text: 'Event Capture', href: '/configuration/events' }
            ],
            'Event Capture Configuration',
            'eventCapture'
          )}
        </Guard>
      </Route>

      <Route path="/admin/upload-config">
        <Guard path="/admin/upload-config">
          {renderContent(
            UploadConfigDashboard,
            [
              { text: 'Home', href: '/' },
              { text: 'Configuration', href: '/configuration-settings' },
              { text: 'File Upload Config', href: '/admin/upload-config' }
            ],
            'File Upload Configuration',
            'fileUploadConfig'
          )}
        </Guard>
      </Route>

      <Route path="/reporting-and-monitoring-dashboard">
        <Guard path="/reporting-and-monitoring-dashboard">
          {renderContent(
            ReportingAndMonitoringDashboard,
            [{ text: 'Home', href: '/' }, { text: 'Reporting and Monitoring', href: '/reporting-and-monitoring-dashboard' }],
            'Reporting and Monitoring',
            'reportingAndMonitoring',
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={resetToDefaultLayout}>Reset to default layout</Button>
              <Button onClick={() => setSplitPanelOpen(true)}>+ Add widget</Button>
            </SpaceBetween>
          )}
        </Guard>
      </Route>

      <Route path="/manage-notifications">
        <Guard path="/manage-notifications">
          {renderContent(
            ManageNotifications,
            [{ text: 'Home', href: '/' }, { text: 'Manage Notifications', href: '/manage-notifications' }],
            'Manage Notifications',
            <ManageNotificationsHelp />
          )}
        </Guard>
      </Route>

      <Route path="/modify-component/:id">
        {renderContent(
          ModifyComponent,
          [
            { text: 'Home', href: '/' },
            { text: 'Manage Intake Steps', href: '/manage-components' },
            { text: 'Modify Intake Step', href: '/modify-component/:id' }
          ],
          'Modify Intake Step',
          <ModifyIntakeStepHelp />
        )}
      </Route>

      <Route path="/manage-security-options">
        {renderContent(
          ManageSecurityOptions,
          [{ text: 'Home', href: '/' }, { text: 'Security Settings', href: '/manage-security-options' }],
          'Security Settings',
          'manageSecurityOptions'
        )}
      </Route>

      <Route path="/access-control">
        <Guard path="/manage-security-options">
          {renderContent(
            AccessControlDashboard,
            [
              { text: 'Home', href: '/' },
              { text: 'Security Settings', href: '/manage-security-options' },
              { text: 'Access Control', href: '/access-control' }
            ],
            'Access Control',
            'accessControl'
          )}
        </Guard>
      </Route>

      <Route path="/manage-components">
        <Guard path="/manage-components">
          {renderContent(
            ManageIntakeSteps,
            [{ text: 'Home', href: '/' }, { text: 'Manage Intake Steps', href: '/manage-components' }],
            'Manage Intake Steps',
            <ManageIntakeStepsHelpPanel />
          )}
        </Guard>
      </Route>

      <Route path="/case-assignment-dashboard">
        {renderContent(
          CaseAssignmentDashboard,
          [
            { text: 'Home', href: '/' },
            { text: 'Manage ISET Applications', href: '/case-assignment-dashboard' }
          ],
          'Manage ISET Applications',
          <CaseAssignmentDashboardHelp />,
          null,
          CaseAssignmentDashboardHelp.aiContext
        )}
      </Route>

      <Route path="/application-case/:id">
        <Guard path="/application-case/:id">
          {renderContent(
            ApplicationCaseDashboard,
            [
              { text: 'Home', href: '/' },
              { text: 'Manage ISET Applications', href: '/case-assignment-dashboard' },
              { text: 'Assessment' }
            ],
            'ISET Application Assessment',
            <ApplicationCaseDashboardHelp />,
            null,
            ApplicationCaseDashboardHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/arms-reporting">
        <Guard path="/arms-reporting">
          {renderContent(
            ArmsReportingDashboard,
            [{ text: 'Home', href: '/' }, { text: 'ARMS Reporting', href: '/arms-reporting' }],
            'ARMS Reporting',
            'armsReporting'
          )}
        </Guard>
      </Route>

      <Route path="/nwac-hub-management">
        <Guard path="/nwac-hub-management">
          {renderContent(
            NWACHubManagementDashboard,
            [
              { text: 'Home', href: '/' },
              { text: 'NWAC Hub Management', href: '/nwac-hub-management' }
            ],
            'NWAC Hub Management',
            'nwacHubManagement'
          )}
        </Guard>
      </Route>

      <Route path="/">
        {renderContent(
          AdminDashboard,
          [{ text: 'Home', href: '/' }],
          'NWAC ISET Homepage',
          AdminDashboardHelp.aiContext
        )}
      </Route>
    </Switch>
  );
};

export default AppRoutes;






