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
  Hotspot,
  Link,
  SpaceBetween,
  Button,
  Box // Import Box component
} from '@cloudscape-design/components';
import AdminDashboard from '../pages/home/HomeDashboardPage.jsx';
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
import ManageNotifications from '../pages/manageNotifications.js';
import { ManageNotificationsHelp } from '../helpPanelContents/manageNotificationsHelp.js';
import TemplateEditorDashboard from '../pages/templateEditorDashboard.js';
import TemplateEditorDashboardHelp from '../helpPanelContents/templateEditorDashboardHelp.js';
import ManageLocationsHelp from '../helpPanelContents/manageLocationsHelp'; // Import the help panel content
import ModifyComponent from '../pages/modifyIntakeStep.js'; // Import the new component
import ModifyIntakeStepHelp from '../helpPanelContents/modifyIntakeStep.js'; // Renamed help panel content
import ManageSecurityOptions from '../pages/manageSecurityOptions.js'; // Import the renamed component
import AccessControlDashboard from '../pages/accessControlDashboard.js';
import ManageIntakeSteps from '../pages/manageIntakeSteps.js'; // Import the renamed component
import ManageIntakeStepsHelpPanel from '../helpPanelContents/manageIntakeStepsHelpPanel'; // Correct the import path
import CaseAssignmentDashboard from '../pages/caseAssignmentDashboard.js'; // Import the new component
import ApplicationCaseDashboard from '../pages/applicationCaseDashboard.js'; // Import the new component
import ManualApplicationIntakePage from '../pages/intake/ManualApplicationIntakePage.jsx';
import CaseAssignmentDashboardHelp from '../helpPanelContents/caseAssignmentDashboardHelp.js';
import ApplicationCaseDashboardHelp from '../helpPanelContents/applicationCaseDashboardHelp.js';
import ManualApplicationIntakeHelp from '../helpPanelContents/manualApplicationIntakeHelp.js';
import NWACHubManagementDashboard from '../pages/nwacHubManagement.js'; // Import the NWAC Hub Management dashboard
import AuthCallback from '../pages/AuthCallback.js';
import UploadConfigDashboard from '../pages/uploadConfigDashboard.js';
import EventCaptureDashboard from '../pages/configuration/EventCaptureDashboard.js';
import QueryEditorDashboard from '../pages/configuration/QueryEditorDashboard.js';
import FinanceOverviewPage from '../pages/finance/FinanceOverviewPage.jsx';
import FinanceOverviewHelp from '../helpPanelContents/financeOverviewHelp.js';
import FinanceBudgetsPage from '../pages/finance/FinanceBudgetsPage.jsx';
import FinanceAllocationsPage from '../pages/finance/FinanceAllocationsPage.jsx';
import FinanceReconciliationPage from '../pages/finance/FinanceReconciliationPage.jsx';
import FinanceReportsPage from '../pages/finance/FinanceReportsPage.jsx';
import FinanceMonitoringPage from '../pages/finance/FinanceMonitoringPage.jsx';
import FinanceForecastingPage from '../pages/finance/FinanceForecastingPage.jsx';
import FinanceSettingsPage from '../pages/finance/FinanceSettingsPage.jsx';
import FinancePaymentsPage from '../pages/finance/FinancePaymentsPage.jsx';
import FinanceBudgetsHelp from '../helpPanelContents/financeBudgetsHelp.js';
import FinanceAllocationsHelp from '../helpPanelContents/financeAllocationsHelp.js';
import FinanceReconciliationHelp from '../helpPanelContents/financeReconciliationHelp.js';
import FinanceReportsHelp from '../helpPanelContents/financeReportsHelp.js';
import FinanceMonitoringHelp from '../helpPanelContents/financeMonitoringHelp.js';
import FinanceForecastingHelp from '../helpPanelContents/financeForecastingHelp.js';
import FinancePaymentsHelp from '../helpPanelContents/financePaymentsHelp.js';
import ContactCommunicationsDashboard from '../pages/contact/ContactCommunicationsDashboard.jsx';
import ContactCommunicationsHelp from '../helpPanelContents/contactCommunicationsHelp.js';
import QueryEditorHelp from '../helpPanelContents/queryEditorHelp.js';
import MessagesDashboardPage from '../pages/messages/MessagesDashboardPage.jsx';
import PortfolioDashboardPage from '../pages/Caseworking/PortfolioDashboardPage.jsx';
import PortfolioDashboardHelp from '../helpPanelContents/portfolioDashboardHelp.js';
import CaseWorkspacePage from '../pages/Caseworking/CaseWorkspacePage.jsx';
import CaseWorkspaceHelp from '../helpPanelContents/caseWorkspaceHelp.js';
import ProgramPaymentsPage from '../pages/Caseworking/ProgramPaymentsPage.jsx';
import JobBankSearchPage from '../pages/integrations/JobBankSearchPage.jsx';
import JobBankSearchHelp from '../helpPanelContents/jobBankSearchHelp.js';
import EsdcSubmissionsOverviewPage from '../pages/esdc/EsdcSubmissionsOverviewPage.jsx';
import EsdcParticipantSubmissionsPage from '../pages/esdc/EsdcParticipantSubmissionsPage.jsx';
import EsdcReportingPackagesPage from '../pages/esdc/EsdcReportingPackagesPage.jsx';
import ParticipantWorkspacePage from '../pages/esdc/ParticipantWorkspacePage.jsx';
import EsdcOverviewHelp from '../helpPanelContents/esdcOverviewHelp.js';
import EsdcParticipantsHelp from '../helpPanelContents/esdcParticipantsHelp.js';
import EsdcReportingHelp from '../helpPanelContents/esdcReportingHelp.js';
import EsdcSubmissionDashboardHelp from '../helpPanelContents/esdcSubmissionDashboardHelp.js';
import DocumentationLibrary from '../pages/documentation/DocumentationLibrary.jsx';
import HomeDashboardHelp from '../helpPanelContents/homeDashboardHelp.js';
import TutorialsDashboardPage from '../pages/support/TutorialsDashboardPage.jsx';
import TutorialsDashboardHelp from '../helpPanelContents/tutorialsDashboardHelp.js';

const AppRoutes = ({
  toggleHelpPanel,
  currentRole,
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

  const renderContent = (
    Component,
    breadcrumbs,
    headerText,
    helpKey,
    actions = null,
    context = "",
    headerDescription = "",
    headerHotspotId = null
  ) => (
    <ContentLayout
      header={
        <div style={{ position: 'relative' }}>
          <Header
            variant="h1"
            description={headerDescription || undefined}
            info={<Link variant="info" onClick={() => toggleHelpPanel(helpKey, headerText, context)}>Info</Link>}
            actions={actions} // Attach actions here
          >
            {headerText}
          </Header>
          {headerHotspotId ? (
            <div style={{ position: 'absolute', left: '-12px', top: '22px' }}>
              <Hotspot hotspotId={headerHotspotId} direction="bottom">
                <span style={{ display: 'inline-block', width: '1px', height: '1px' }} />
              </Hotspot>
            </div>
          ) : null}
        </div>
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
        <Guard path="/manage-workflows">
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
        <Guard path="/modify-workflow">
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
        <Guard path="/configuration-settings">
          {renderContent(
            ConfigurationSettings,
            [{ text: 'Home', href: '/' }, { text: 'Configuration Settings', href: '/configuration-settings' }],
            'Configuration Settings',
            'configurationSettings',
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('configuration-dashboard:openPalette'))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('configuration-dashboard:resetLayout'))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            )
          )}
        </Guard>
      </Route>

      <Route path="/configuration/query-editor">
        <Guard path="/configuration/query-editor">
          {renderContent(
            QueryEditorDashboard,
            [
              { text: 'Home', href: '/' },
              { text: 'Configuration', href: '/configuration-settings' },
              { text: 'Query Editor', href: '/configuration/query-editor' }
            ],
            'Query Editor',
            <QueryEditorHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() => window.dispatchEvent(new CustomEvent('queryEditor:openPalette'))}
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() => window.dispatchEvent(new CustomEvent('queryEditor:resetLayout'))}
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            QueryEditorHelp.aiContext
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

      <Route path="/template-editor">
        <Guard path="/template-editor">
          {renderContent(
            TemplateEditorDashboard,
            [{ text: 'Home', href: '/' }, { text: 'Template Editor', href: '/template-editor' }],
            'Template Editor',
            <TemplateEditorDashboardHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('templateEditor:openPalette'))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('templateEditor:resetLayout'))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            )
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
          (
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                iconName="add-plus"
                onClick={() => window.dispatchEvent(new CustomEvent('caseAssignment:openPalette'))}
              >
                Add widget
              </Button>
              <Button
                iconName="refresh"
                onClick={() => window.dispatchEvent(new CustomEvent('caseAssignment:resetLayout'))}
              >
                Reset layout
              </Button>
            </SpaceBetween>
          ),
          CaseAssignmentDashboardHelp.aiContext
        )}
      </Route>

      <Route path="/iset/applications/intake">
        <Guard path="/iset/applications/intake">
          {renderContent(
            ManualApplicationIntakePage,
            [
              { text: 'Home', href: '/' },
              { text: 'Manual Application Intake', href: '/iset/applications/intake' }
            ],
            'Manual Application Intake',
            <ManualApplicationIntakeHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() => window.dispatchEvent(new CustomEvent('manualIntake:openPalette'))}
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() => window.dispatchEvent(new CustomEvent('manualIntake:resetLayout'))}
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            ManualApplicationIntakeHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/esdc/overview">
        <Guard roles={['System Administrator', 'Program Administrator']} path="/esdc/overview">
          {renderContent(
            EsdcSubmissionsOverviewPage,
            [
              { text: 'Home', href: '/' },
              { text: 'ESDC Submissions', href: '/esdc/overview' }
            ],
            'ESDC Submissions Overview',
            <EsdcOverviewHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('esdcOverview:openPalette'))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('esdcOverview:resetLayout'))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            EsdcOverviewHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/esdc/participants" exact>
        <Guard roles={['System Administrator', 'Program Administrator']} path="/esdc/participants">
          {renderContent(
            EsdcParticipantSubmissionsPage,
            [
              { text: 'Home', href: '/' },
              { text: 'ESDC Submissions', href: '/esdc/overview' },
              { text: 'ILMP Submissions & Exports', href: '/esdc/participants' }
            ],
            'ILMP Submissions & Exports',
            <EsdcParticipantsHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('esdcParticipants:openPalette'))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('esdcParticipants:resetLayout'))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            EsdcParticipantsHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/esdc/participants/:clientId">
        <Guard roles={['System Administrator', 'Program Administrator']} path="/esdc/participants">
          {renderContent(
            ParticipantWorkspacePage,
            [
              { text: 'Home', href: '/' },
              { text: 'ESDC Submissions', href: '/esdc/overview' },
              { text: 'Participant Workspace', href: '#' }
            ],
            'Participant Submission Workspace',
            <EsdcSubmissionDashboardHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('esdcParticipantWorkspace:openPalette'))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('esdcParticipantWorkspace:resetLayout'))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            EsdcSubmissionDashboardHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/esdc/reporting">
        <Guard roles={['System Administrator', 'Program Administrator']} path="/esdc/reporting">
          {renderContent(
            EsdcReportingPackagesPage,
            [
              { text: 'Home', href: '/' },
              { text: 'ESDC Submissions', href: '/esdc/overview' },
              { text: 'Reporting', href: '/esdc/reporting' }
            ],
            'Reporting Packages',
            <EsdcReportingHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('esdcReporting:openPalette'))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent('esdcReporting:resetLayout'))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            EsdcReportingHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/iset/cases">
        <Guard path="/iset/cases">
          {renderContent(
            PortfolioDashboardPage,
            [
              { text: 'Home', href: '/' },
              { text: 'ISET Clients', href: '/iset/cases' }
            ],
            'ISET Clients',
            <PortfolioDashboardHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() => window.dispatchEvent(new CustomEvent("iset-portfolio:openPalette"))}
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() => window.dispatchEvent(new CustomEvent("iset-portfolio:resetLayout"))}
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            PortfolioDashboardHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/iset/payments">
        <Guard path="/iset/payments">
          {renderContent(
            ProgramPaymentsPage,
            [
              { text: 'Home', href: '/' },
              { text: 'ISET Clients', href: '/iset/cases' },
              { text: 'Program Payments', href: '/iset/payments' }
            ],
            'Program Payments',
            <Box variant="p">Manage payment packets, upload evidence, and submit requests to finance.</Box>,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() => window.dispatchEvent(new CustomEvent("programPayments:openPalette"))}
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() => window.dispatchEvent(new CustomEvent("programPayments:resetLayout"))}
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            )
          )}
        </Guard>
      </Route>

      <Route path="/contact-communications">
        <Guard path="/contact-communications">
          {renderContent(
            ContactCommunicationsDashboard,
            [
              { text: 'Home', href: '/' },
              { text: 'Manage ISET Applications', href: '/case-assignment-dashboard' },
              { text: 'Contact Communications', href: '/contact-communications' }
            ],
            'Contact Communications',
            <ContactCommunicationsHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("contactCommunications:openPalette"))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("contactCommunications:resetLayout"))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            ContactCommunicationsHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/messages">
        <Guard path="/messages">
          {renderContent(
            MessagesDashboardPage,
            [
              { text: 'Home', href: '/' },
              { text: 'Messages', href: '/messages' },
            ],
            'Messages',
            <Box variant="p">Internal secure messaging for staff.</Box>
          )}
        </Guard>
      </Route>

      <Route path="/job-bank-search">
        <Guard path="/job-bank-search">
          {renderContent(
            JobBankSearchPage,
            [
              { text: 'Home', href: '/' },
              { text: 'Job Search', href: '/job-bank-search' },
            ],
            'Job Bank Search',
            <JobBankSearchHelp />,
            null,
            JobBankSearchHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/cases/:caseId">
        <Guard path="/cases/:caseId">
          {renderContent(
            CaseWorkspacePage,
            [
              { text: 'Home', href: '/' },
              { text: 'ISET Clients', href: '/iset/cases' },
              { text: 'Case workspace' }
            ],
            'Case Workspace',
            <CaseWorkspaceHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="external"
                  onClick={() => window.location.assign('/job-bank-search')}
                >
                  Job Search
                </Button>
                <Button
                  iconName="add-plus"
                  onClick={() => window.dispatchEvent(new CustomEvent("iset-case-workspace:openPalette"))}
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() => window.dispatchEvent(new CustomEvent("iset-case-workspace:resetLayout"))}
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            CaseWorkspaceHelp.aiContext
          )}
        </Guard>
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
            (
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="external"
                  onClick={() => window.location.assign('/job-bank-search')}
                >
                  Job Search
                </Button>
                <Button
                  iconName="add-plus"
                  onClick={() => window.dispatchEvent(new CustomEvent("applicationAssessment:openPalette"))}
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() => window.dispatchEvent(new CustomEvent("applicationAssessment:resetLayout"))}
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            ApplicationCaseDashboardHelp.aiContext
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

      <Route path="/finance/overview">
        <Guard path="/finance/overview">
          {renderContent(
            FinanceOverviewPage,
            [
              { text: 'Home', href: '/' },
              { text: 'Financial Management', href: '/finance/overview' }
            ],
            'Finance Overview',
            <FinanceOverviewHelp />,
            (
              <SpaceBetween direction="horizontal" size="s">
                <Button iconName="add-plus" onClick={() => window.dispatchEvent(new CustomEvent("finance:openPalette"))}>
                  Add widget
                </Button>
                <Button iconName="refresh" onClick={() => window.dispatchEvent(new CustomEvent("finance:resetLayout"))}>
                  Reset layout
                </Button>
              </SpaceBetween>
            )
          )}
        </Guard>
      </Route>

      <Route path="/finance/budgets">
        <Guard path="/finance/budgets">
          {renderContent(
            FinanceBudgetsPage,
            [
              { text: 'Home', href: '/' },
              { text: 'Financial Management', href: '/finance/overview' },
              { text: 'Budgets', href: '/finance/budgets' }
            ],
            'Budgets',
            <FinanceBudgetsHelp />,
            (
              <SpaceBetween direction="horizontal" size="s">
                <Button
                  iconName="add-plus"
                  onClick={() => window.dispatchEvent(new CustomEvent("financeBudgets:openPalette"))}
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() => window.dispatchEvent(new CustomEvent("financeBudgets:resetLayout"))}
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            FinanceBudgetsHelp.aiContext
          )}
        </Guard>
      </Route>
      <Route path="/finance/payments">
        <Guard path="/finance/payments">
          {renderContent(
            FinancePaymentsPage,
            [
              { text: 'Home', href: '/' },
              { text: 'Financial Management', href: '/finance/overview' },
              { text: 'Batch Payments', href: '/finance/payments' }
            ],
            'Batch Payments',
            <FinancePaymentsHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financePayments:openPalette"))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financePayments:resetLayout"))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            FinancePaymentsHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/finance/allocations">
        <Guard path="/finance/allocations">
          {renderContent(
            FinanceAllocationsPage,
            [
              { text: 'Home', href: '/' },
              { text: 'Financial Management', href: '/finance/overview' },
              { text: 'Allocations & Transfers', href: '/finance/allocations' }
            ],
            'Allocations & Transfers',
            <FinanceAllocationsHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeAllocations:openPalette"))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeAllocations:resetLayout"))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            FinanceAllocationsHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/finance/reconciliation">
        <Guard path="/finance/reconciliation">
          {renderContent(
            FinanceReconciliationPage,
            [
              { text: 'Home', href: '/' },
              { text: 'Financial Management', href: '/finance/overview' },
              { text: 'Reconciliation', href: '/finance/reconciliation' }
            ],
            'Reconciliation',
            <FinanceReconciliationHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeReconciliation:openPalette"))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeReconciliation:resetLayout"))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            FinanceReconciliationHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/finance/reports">
        <Guard path="/finance/reports">
          {renderContent(
            FinanceReportsPage,
            [
              { text: 'Home', href: '/' },
              { text: 'Financial Management', href: '/finance/overview' },
              { text: 'Financial Reports', href: '/finance/reports' }
            ],
            'Financial Reports',
            <FinanceReportsHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeReports:openPalette"))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeReports:resetLayout"))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            FinanceReportsHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/finance/monitoring">
        <Guard path="/finance/monitoring">
          {renderContent(
            FinanceMonitoringPage,
            [
              { text: 'Home', href: '/' },
              { text: 'Financial Management', href: '/finance/overview' },
              { text: 'Monitoring & Evidence', href: '/finance/monitoring' }
            ],
            'Monitoring & Evidence',
            <FinanceMonitoringHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeMonitoring:openPalette"))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeMonitoring:resetLayout"))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            FinanceMonitoringHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/finance/forecasting">
        <Guard path="/finance/forecasting">
          {renderContent(
            FinanceForecastingPage,
            [
              { text: 'Home', href: '/' },
              { text: 'Financial Management', href: '/finance/overview' },
              { text: 'Forecasting & Scenarios', href: '/finance/forecasting' }
            ],
            'Forecasting & Scenarios',
            <FinanceForecastingHelp />,
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeForecasting:openPalette"))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeForecasting:resetLayout"))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            ),
            FinanceForecastingHelp.aiContext
          )}
        </Guard>
      </Route>

      <Route path="/finance/settings">
        <Guard path="/finance/settings">
          {renderContent(
            FinanceSettingsPage,
            [
              { text: 'Home', href: '/' },
              { text: 'Financial Management', href: '/finance/overview' },
              { text: 'Finance Settings', href: '/finance/settings' }
            ],
            'Finance Settings',
            'financeSettings',
            (
              <SpaceBetween size="xs" direction="horizontal">
                <Button
                  iconName="add-plus"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeSettings:openPalette"))
                  }
                >
                  Add widget
                </Button>
                <Button
                  iconName="refresh"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("financeSettings:resetLayout"))
                  }
                >
                  Reset layout
                </Button>
              </SpaceBetween>
            )
          )}
        </Guard>
      </Route>

      <Route path="/documentation">
        {renderContent(
          DocumentationLibrary,
          [{ text: 'Home', href: '/' }, { text: 'Guidance Library', href: '/documentation' }],
          'Guidance Library',
          'documentationLibrary',
          (
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                iconName="add-plus"
                onClick={() => window.dispatchEvent(new CustomEvent('documentation:openPalette'))}
              >
                Add widget
              </Button>
              <Button
                iconName="refresh"
                onClick={() => window.dispatchEvent(new CustomEvent('documentation:resetLayout'))}
              >
                Reset layout
              </Button>
            </SpaceBetween>
          ),
          '',
          "Quick links to guidance resources and reference guides you use most often. Each card shows what the doc covers, who it's for, and where to open it."
        )}
      </Route>

      <Route path="/tutorials-dashboard">
        <Guard path="/tutorials-dashboard">
          {renderContent(
            TutorialsDashboardPage,
            [
              { text: 'Home', href: '/' },
              { text: 'Support', href: '/help-support-dashboard' },
              { text: 'Tutorials', href: '/tutorials-dashboard' }
            ],
            'Tutorials',
            <TutorialsDashboardHelp />,
            null,
            TutorialsDashboardHelp.aiContext,
            'Reset tutorial progress so tours may prompt again when visiting supported pages.'
          )}
        </Guard>
      </Route>

      <Route path="/">
        {renderContent(
          AdminDashboard,
          [{ text: 'Home', href: '/' }],
          'NWAC ISET Homepage',
          <HomeDashboardHelp currentRole={currentRole} />,
          (
            <Hotspot hotspotId="home-layout-controls" direction="bottom">
              <SpaceBetween size="xs" direction="horizontal">
                <Button iconName="add-plus" onClick={() => window.dispatchEvent(new CustomEvent('home:openPalette'))}>
                  Add widget
                </Button>
                <Button iconName="refresh" onClick={() => window.dispatchEvent(new CustomEvent('home:resetLayout'))}>
                  Reset layout
                </Button>
              </SpaceBetween>
            </Hotspot>
          ),
          HomeDashboardHelp.aiContext,
          '',
          'home-overview'
        )}
      </Route>
    </Switch>
  );
};

export default AppRoutes;






