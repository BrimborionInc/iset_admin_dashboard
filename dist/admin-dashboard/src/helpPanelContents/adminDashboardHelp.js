import React, { useState } from 'react';
import { Alert, SpaceBetween } from '@cloudscape-design/components';

const AdminDashboardHelp = () => {
    const [visibleAlerts, setVisibleAlerts] = useState({
        securityContext: true,
        languageContext: true,
        sessionContext: true,
        removeUnusedCode: true,
        dualLanguageSupport: true,
        configurationPage: true,
        notificationsAndReminders: true,
        secureMessaging: true,
    });

    const handleDismiss = (alertKey) => {
        setVisibleAlerts((prev) => ({ ...prev, [alertKey]: false }));
    };

    return (
        <div>
            <h2>Development Notes</h2>
            <p>SIRs and CRs for the ABS</p>
            <SpaceBetween size="l">
                {visibleAlerts.securityContext && (
                    <Alert
                        dismissible
                        onDismiss={() => handleDismiss('securityContext')}
                        dismissAriaLabel="Close alert"
                        header="Security Context"
                    >
                        Ensure that all actions and data access are performed within the appropriate security context to maintain system integrity and confidentiality.
                    </Alert>
                )}
                {visibleAlerts.languageContext && (
                    <Alert
                        dismissible
                        onDismiss={() => handleDismiss('languageContext')}
                        dismissAriaLabel="Close alert"
                        header="Language Context"
                    >
                        Support multiple languages and ensure that the user interface adapts to the selected language context.
                    </Alert>
                )}
                {visibleAlerts.sessionContext && (
                    <Alert
                        dismissible
                        onDismiss={() => handleDismiss('sessionContext')}
                        dismissAriaLabel="Close alert"
                        header="Session Context"
                    >
                        Manage user sessions effectively to ensure a seamless and secure user experience.
                    </Alert>
                )}
                {visibleAlerts.removeUnusedCode && (
                    <Alert
                        dismissible
                        onDismiss={() => handleDismiss('removeUnusedCode')}
                        dismissAriaLabel="Close alert"
                        header="Remove Unused Code"
                    >
                        Regularly review and remove unused code to maintain a clean and efficient codebase.
                    </Alert>
                )}
                {visibleAlerts.dualLanguageSupport && (
                    <Alert
                        dismissible
                        onDismiss={() => handleDismiss('dualLanguageSupport')}
                        dismissAriaLabel="Close alert"
                        header="Dual Language Support"
                    >
                        Implement dual language support to cater to a diverse user base and enhance accessibility.
                    </Alert>
                )}
                {visibleAlerts.configurationPage && (
                    <Alert
                        dismissible
                        onDismiss={() => handleDismiss('configurationPage')}
                        dismissAriaLabel="Close alert"
                        header="Configuration Page"
                    >
                        Provide a configuration page for administrators to manage system settings and preferences.
                    </Alert>
                )}
                {visibleAlerts.notificationsAndReminders && (
                    <Alert
                        dismissible
                        onDismiss={() => handleDismiss('notificationsAndReminders')}
                        dismissAriaLabel="Close alert"
                        header="Notifications and Reminders"
                    >
                        Implement notifications and reminders to keep users informed and engaged.
                    </Alert>
                )}
                {visibleAlerts.secureMessaging && (
                    <Alert
                        dismissible
                        onDismiss={() => handleDismiss('secureMessaging')}
                        dismissAriaLabel="Close alert"
                        header="Secure Messaging"
                    >
                        Ensure secure messaging capabilities to facilitate safe and confidential communication.
                    </Alert>
                )}
            </SpaceBetween>
        </div>
    );
};

AdminDashboardHelp.aiContext = "Overview and entry point for managing service locations, modules, fees, users, appointments, and dashboard customization.";
export default AdminDashboardHelp; // Ensure this is a default export
