import React, { useEffect, useState } from 'react';
import { Container, Header, Table, Link, SpaceBetween, Button, Alert } from '@cloudscape-design/components';

const ManageFees = ({ toggleHelpPanel, updateBreadcrumbs, setSplitPanelOpen, splitPanelOpen, setSplitPanelSize, splitPanelSize, setAvailableItems }) => {
  const [fees, setFees] = useState([]);
  const [alertVisible, setAlertVisible] = useState(true);

  useEffect(() => {
    const fetchFees = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/service-modules`);
        const data = await response.json();
        const feesData = data.map(service => ({
          name: service.name,
          description: service.description,
          amount: '$20' // Fixed amount for demo purposes
        }));
        setFees(feesData);
      } catch (error) {
        console.error('Error fetching fees:', error);
      }
    };

    fetchFees();
  }, []);

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h1"
            info={<Link variant="info" onClick={() => toggleHelpPanel('manageFees')}>Info</Link>}
          >
            Manage Fees
          </Header>
        }
      >
        {alertVisible && (
          <Alert
            onDismiss={() => setAlertVisible(false)}
            dismissAriaLabel="Close alert"
            header="Manage Fees Dashboard"
          >
            The Manage Fees dashboard will provide administrators with a centralized interface to configure, monitor, and manage all fees associated with the Appointment Booking Solution (ABS). This includes setting up fee structures, modifying fee amounts, and tracking fee collections across various service modules. Administrators will be able to define fee rules, update fee templates, and ensure compliance with financial regulations. The dashboard will also offer audit logs and real-time analytics, allowing authorized users to review fee history, troubleshoot discrepancies, and optimize fee management workflows. Additionally, the system will support multilingual fee descriptions and allow customization of fee details per service module, ensuring that applicants are informed about applicable fees in their preferred language and format.
          </Alert>
        )}
        <Table
          columnDefinitions={[
            { id: 'name', header: 'Name', cell: item => item.name },
            { id: 'description', header: 'Description', cell: item => item.description },
            { id: 'amount', header: 'Amount (CAD)', cell: item => item.amount },
          ]}
          items={fees}
          header={<Header>Service Fees</Header>}
        />
      </Container>

      <Container
        header={
          <Header
            variant="h2"
            info={<Link variant="info" onClick={() => toggleHelpPanel('releaseManagement')}>Info</Link>}
          >
            Fee Configuration - Release Management
          </Header>
        }
      >
        <Table
          columnDefinitions={[
            { id: 'release', header: 'Release', cell: item => item.release },
            { id: 'date', header: 'Date', cell: item => item.date },
            { id: 'status', header: 'Status', cell: item => item.status },
            { id: 'actions', header: 'Actions', cell: item => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="inline-link">Rollback</Button>
              </SpaceBetween>
            ) },
          ]}
          items={[
            { release: 'Release 1', date: '2023-01-01', status: 'Deployed' },
            { release: 'Release 2', date: '2023-02-01', status: 'Scheduled' },
            { release: 'Release 3', date: '2023-03-01', status: 'Pending' },
          ]}
          header={<Header>Previous Releases</Header>}
        />
      </Container>
    </SpaceBetween>
  );
};

export default ManageFees;
