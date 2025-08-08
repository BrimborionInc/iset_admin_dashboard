import React, { useEffect, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, Table, Box, Button, ButtonDropdown } from '@cloudscape-design/components';

const SupportingDocumentsWidget = ({ actions, caseData }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const applicantUserId = caseData?.applicant_user_id;

  useEffect(() => {
    if (!applicantUserId) return;
    setLoading(true);
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/applicants/${applicantUserId}/documents`)
      .then(res => res.json())
      .then(data => {
        setDocuments(data);
        setLoading(false);
      })
      .catch(() => {
        setDocuments([]);
        setLoading(false);
      });
  }, [applicantUserId]);

  return (
    <BoardItem
      header={<Header>Supporting Documents</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        actions && actions.removeItem && (
          <ButtonDropdown
            items={[{ id: 'remove', text: 'Remove' }]}
            ariaLabel="Board item settings"
            variant="icon"
            onItemClick={() => actions && actions.removeItem && actions.removeItem()}
          />
        )
      }
    >
      <Box variant="small" margin={{ bottom: 's' }}>
        This widget displays all documents related to the applicant, including those submitted with the application and any uploaded as secure message attachments.
      </Box>
      <Box padding="m">
        <Table
          loading={loading}
          variant="embedded"
          items={documents}
          columnDefinitions={[
            { id: 'file_name', header: 'File Name', cell: item => item.file_name },
            { id: 'label', header: 'Label', cell: item => item.label || '' },
            { id: 'uploaded_at', header: 'Uploaded', cell: item => new Date(item.uploaded_at).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }) },
            {
              id: 'actions',
              header: 'Actions',
              cell: item => {
                // Normalize file_path for URL (replace backslashes with slashes)
                const fileUrl = `${process.env.REACT_APP_API_BASE_URL}/${item.file_path.replace(/\\|\\/g, '/')}`;
                return (
                  <Button
                    variant="inline-link"
                    onClick={() => window.open(fileUrl, '_blank')}
                  >View</Button>
                );
              }
            }
          ]}
          header={<Header>Applicant's Supporting Documents</Header>}
          empty={<Box textAlign="center">No supporting documents to display.</Box>}
        />
      </Box>
    </BoardItem>
  );
};

export default SupportingDocumentsWidget;
