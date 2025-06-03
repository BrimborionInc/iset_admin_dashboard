import React, { useState } from 'react';
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Flashbar from "@cloudscape-design/components/flashbar";

import styles from './DemoNavigation.module.css'; // Import the CSS module

const TopHeader = ({ currentLanguage = 'en', onLanguageChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);
  const [slotPurgeResult, setSlotPurgeResult] = useState(null);

  const handleClearAppointments = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/purge-appointments`, { // Use base URL from .env
        method: 'POST',
      });
      const result = await response.json();
      setPurgeResult(result.message);
    } catch (error) {
      console.error('Error clearing appointments:', error);
      setPurgeResult('Failed to purge appointments');
    } finally {
      setShowModal(false);
    }
  };

  const handleClearSlots = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/purge-slots`, { // Use base URL from .env
        method: 'POST',
      });
      const result = await response.json();
      setSlotPurgeResult(result.message);
    } catch (error) {
      console.error('Error clearing slots:', error);
      setSlotPurgeResult('Failed to purge slots');
    } finally {
      setShowSlotModal(false);
    }
  };

  const handleConfirmPurge = () => {
    setShowModal(true);
  };

  const handleConfirmSlotPurge = () => {
    setShowSlotModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleCloseSlotModal = () => {
    setShowSlotModal(false);
  };

  const handleDismissPurgeResult = () => {
    setPurgeResult(null);
  };

  const handleDismissSlotPurgeResult = () => {
    setSlotPurgeResult(null);
  };

  return (
    <div className={styles.demoNavigation}>
      <span>Demo Controls</span>
      <div className={styles.buttonGroup}>
        <Button variant="primary" onClick={handleConfirmPurge}>Clear Appointments</Button>
        <Button variant="primary" onClick={handleConfirmSlotPurge}>Clear Slots</Button>
      </div>
      {purgeResult && (
        <Flashbar
          items={[
            {
              type: purgeResult.includes('Failed') ? 'error' : 'success',
              header: purgeResult.includes('Failed') ? 'Error' : 'Success',
              content: purgeResult,
              dismissible: true,
              onDismiss: handleDismissPurgeResult,
            },
          ]}
        />
      )}
      {slotPurgeResult && (
        <Flashbar
          items={[
            {
              type: slotPurgeResult.includes('Failed') ? 'error' : 'success',
              header: slotPurgeResult.includes('Failed') ? 'Error' : 'Success',
              content: slotPurgeResult,
              dismissible: true,
              onDismiss: handleDismissSlotPurgeResult,
            },
          ]}
        />
      )}
      <Modal
        visible={showModal}
        onDismiss={handleCloseModal}
        header="Confirm Purge"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleCloseModal}>Cancel</Button>
            <Button variant="primary" onClick={handleClearAppointments}>Confirm</Button>
          </SpaceBetween>
        }
      >
        Are you sure you want to purge all appointments?
      </Modal>
      <Modal
        visible={showSlotModal}
        onDismiss={handleCloseSlotModal}
        header="Confirm Purge"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleCloseSlotModal}>Cancel</Button>
            <Button variant="primary" onClick={handleClearSlots}>Confirm</Button>
          </SpaceBetween>
        }
      >
        Are you sure you want to purge all slots?
      </Modal>
    </div>
  );
};

export default TopHeader;
