import React, { useState } from 'react';
import '@cloudscape-design/global-styles/index.css';
import './AdminDashboard.css';
import {
    Container,
    Box,
    Link,
    Cards,
    Header,
    Alert,
    SpaceBetween
} from '@cloudscape-design/components';

const AdminDashboard = () => {
    const [alertVisible, setAlertVisible] = useState(true);

    const cardItems = [
        { header: 'Manage PTMAs', href: '/ptma-management', description: 'Manage and configure the network of service centres: type, opening hours, holiday closures, counter capacity, services offered, languages offered, addresss etc.' },
        { header: 'Manage Service Modules', href: '/service-modules-management-dashboard', description: 'Configure and manage the services bookable by applicants. Customise the branching questions flow for applicant intake.' },
        { header: 'Intake Questions Editor', href: '/modify-component', description: 'WCAG visual interface for creating and mananging data intake elements: the questions users are asked to collect data.' },
        { header: 'Manage Appointments', href: '/manage-appointments-new', description: 'Configure and release appointment slots.  Search and manage appointments.  Book new appointments for applicants via the admin interface.' },
        { header: 'Manage Fees', href: '/manage-fees', description: 'Manage fees for service modules.  Schedule changes to fees via release management.' },
        { header: 'Manage Notifications', href: '/manage-notifications', description: 'Create and manage notification templates in different languages.  Configure rules for reminders and notifications.' },
        { header: 'Secure Messaging', href: '/manage-messages', description: 'Secure, encrypted messaging platform.' },
        { header: 'Reporting and Monitoring', href: '/reporting-and-monitoring-dashboard', description: 'Live configurable dashboard for all metrics, service levels and targets.  Configurable alerts for target thresholds.' },
        { header: 'Role-Based Access Control', href: '/user-management-dashboard', description: 'Manage user accounts, roles, and permissions effectively.' },
        { header: 'Code Table Editor', href: '/code-tables-dashboard', description: 'Manage the code tables used by the system.' },
        { header: 'Suite Configuration', href: '/configuration-settings', description: 'Access and modify system configuration settings and preferences.' },
        { header: 'Release Management', href: '/release-management-dashboard', description: 'Plan, track, and manage software releases and updates.' },
        { header: 'Preferences', href: '/options-dashboard', description: 'Configure system options and settings to suit your needs.' },
        { header: 'Security Options', href: '/security-options-dashboard', description: 'Configure security settings and manage access controls.' },
        { header: 'Audit and Logs', href: '/audit-logs-dashboard', description: 'View and analyze audit logs for system activities and changes.' },
        { header: 'Tutorials', href: '/tutorials-dashboard', description: 'Access tutorials and guides to help you navigate the system.' },
        { header: 'Help and Support', href: '/help-support-dashboard', description: 'Find help and support resources for troubleshooting and assistance.' },
        { header: 'Security Settings', href: '/manage-security-options', description: 'Configure security settings and manage encryption options.' }, // Add the new card
    ];

    return (
        <SpaceBetween size="l">
            <Container>
                <Cards
                    cardDefinition={{
                        header: item => <Link href={item.href}>{item.header}</Link>,
                        sections: [
                            {
                                id: 'description',
                                content: item => <Box>{item.description}</Box>
                            }
                        ]
                    }}
                    items={cardItems}
                    header={<Header variant="h2">List of Administrative Dashboards</Header>}
                />
            </Container>
            {alertVisible && (
                <Alert
                    dismissible
                    onDismiss={() => setAlertVisible(false)}
                    dismissAriaLabel="Close alert"
                    header="Recent Activity"
                >
                    <Box>
                        <Header variant="h4">Appointment Booking</Header>
                        <p>New appointment slots released for All India at 17:43 on 26/07/25 by admin@example.com</p>
                    </Box>
                    <Box>
                        <Header variant="h4">User Management</Header>
                        <p>New location "Test VAC" in country "Testland" added at 16:22 on 26/07/25 by admin@example.com</p>
                    </Box>
                </Alert>
            )}
        </SpaceBetween>
    );
};

export default AdminDashboard;
