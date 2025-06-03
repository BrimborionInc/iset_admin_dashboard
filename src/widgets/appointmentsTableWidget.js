import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { useHistory } from 'react-router-dom';
import { Header } from '@cloudscape-design/components';
import {
  Table,
  Button,
  Box,
  TextFilter,
  CollectionPreferences,
  Pagination,
  Spinner,
} from '@cloudscape-design/components';

const AppointmentsTableWidget = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filteringText, setFilteringText] = useState('');
  const [expandedItems, setExpandedItems] = useState([]);
  const history = useHistory();

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/appointments-with-bookings`);
        setAppointments(response.data);
      } catch (error) {
        console.error('Error fetching appointments:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, []);

  const isExpanded = (appointmentId) => expandedItems.includes(appointmentId);

  const handleNewAppointment = () => {
    history.push('/new-appointment-form');
  };

  const toggleExpand = (appointmentId) => {
    setExpandedItems(prev =>
      prev.includes(appointmentId)
        ? prev.filter(id => id !== appointmentId)
        : [...prev, appointmentId]
    );
  };

  const flattenAppointments = () => {
    return appointments.flatMap(parent => {
      const rows = [
        { ...parent, isGroupMember: false, trackingId: parent.bookingReference }
      ];
      if (isExpanded(parent.appointmentId) && parent.groupMembers?.length) {
        rows.push(...parent.groupMembers.map((gm, index) => ({
          ...gm,
          appointmentId: parent.appointmentId + '-gm-' + index,
          isGroupMember: true,
          serviceType: parent.serviceType,
          location: parent.location,
          date: parent.date,
          time: parent.time,
          status: parent.status,
          trackingId: parent.bookingReference
        })));
      }
      return rows;
    });
  };

  const columnDefinitions = [
    {
      id: 'expand',
      header: '',
      width: 40,
      cell: e => {
        if (e.isGroupMember || !e.groupMembers?.length) return null;
        return (
          <Button
            variant="icon"
            iconName={isExpanded(e.appointmentId) ? 'caret-down-filled' : 'caret-right-filled'}
            onClick={() => toggleExpand(e.appointmentId)}
            ariaLabel={isExpanded(e.appointmentId) ? 'Collapse group' : 'Expand group'}
          />
        );
      }
    },
    {
      id: 'applicantName',
      header: 'Applicant Name',
      cell: e => {
        if (e.isGroupMember) {
          return <Box variant="span" color="inherit">{e.groupMemberName} <i>(group member)</i></Box>;
        }
        return <Box>{e.applicantName}</Box>;
      },
      sortingField: 'applicantName'
    },
    {
      id: 'serviceType',
      header: 'Service Type',
      cell: e => e.serviceType,
      sortingField: 'serviceType'
    },
    {
      id: 'location',
      header: 'Location',
      cell: e => e.location,
      sortingField: 'location'
    },
    {
      id: 'date',
      header: 'Date',
      cell: e => format(new Date(e.date), 'yyyy-MM-dd'),
      sortingField: 'date'
    },
    {
      id: 'time',
      header: 'Time',
      cell: e => e.time,
      sortingField: 'time'
    },
    {
      id: 'status',
      header: 'Status',
      cell: e => e.status,
      sortingField: 'status'
    },
    {
      id: 'trackingId',
      header: 'Booking ID', // Relabel to Booking ID
      cell: e => e.trackingId,
      sortingField: 'trackingId'
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: e => {
        if (e.isGroupMember) return null;
        return (
          <Box>
            <Button variant='inline-link' onClick={() => handleModify(e)}>Modify</Button>
          </Box>
        );
      }
    }
  ];

  const handleModify = (appointment) => {
    console.log('Modify clicked for', appointment);
    // Implement navigation or modal trigger here.
  };

  const visibleAppointments = flattenAppointments().filter(
    appointment => {
      const target = appointment.isGroupMember ? appointment.groupMemberName : appointment.applicantName;
      return target.toLowerCase().includes(filteringText.toLowerCase())
        || appointment.serviceType.toLowerCase().includes(filteringText.toLowerCase())
        || appointment.location.toLowerCase().includes(filteringText.toLowerCase())
        || appointment.trackingId?.toLowerCase().includes(filteringText.toLowerCase()); // Include Booking ID in filter
    }
  );

  return (
    <Box>
      {loading ? (
        <Spinner />
      ) : (
        <Table
          items={visibleAppointments}
          columnDefinitions={columnDefinitions}
          trackBy="appointmentId"
          variant="borderless"
          stickyHeader
          header={
            <Header
              actions={
                <Button
                  iconAlign="right"
                  variant="primary"
                  onClick={handleNewAppointment}
                >
                  Book Appointment
                </Button>
              }
            >
            </Header>
          }
          
          filter={<TextFilter
            filteringText={filteringText}
            onChange={({ detail }) => setFilteringText(detail.filteringText)}
            filteringPlaceholder="Search by applicant, service type, or location"
          />}
          pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
          preferences={<CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={{
              contentDisplay: [
                { id: 'applicantName', visible: true },
                { id: 'serviceType', visible: true },
                { id: 'location', visible: true },
                { id: 'date', visible: true },
                { id: 'time', visible: true },
                { id: 'status', visible: true },
                { id: 'trackingId', visible: true },
                { id: 'actions', visible: true }
              ]
            }}
            contentDisplayPreference={{
              title: 'Select visible columns',
              options: columnDefinitions.map(col => ({
                id: col.id,
                label: col.header,
                alwaysVisible: false
              }))
            }}
          />}
          empty={<Box>No appointments found.</Box>}
        />
      )}
    </Box>
  );
};

export default AppointmentsTableWidget;
