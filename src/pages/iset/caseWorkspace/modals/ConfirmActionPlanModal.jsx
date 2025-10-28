import React from "react";
import { Modal, Button, SpaceBetween } from "@cloudscape-design/components";

const ConfirmActionPlanModal = ({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  submitting = false,
  onConfirm,
  onDismiss,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      header={title || "Confirm action"}
      onDismiss={submitting ? null : onDismiss}
      closeAriaLabel="Dismiss confirmation dialog"
      footer={
        <SpaceBetween size="xs" direction="horizontal">
          <Button onClick={onDismiss} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={submitting}>
            {confirmLabel}
          </Button>
        </SpaceBetween>
      }
    >
      {message || "Are you sure you want to continue?"}
    </Modal>
  );
};

export default ConfirmActionPlanModal;
