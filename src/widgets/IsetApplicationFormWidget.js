import React, { useEffect, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, Grid, FormField, Input, Box, Table, SpaceBetween, ColumnLayout, Textarea, Flashbar, Button, Link, ButtonDropdown } from '@cloudscape-design/components';
import IsetApplicationFormHelpPanelContent from '../helpPanelContents/isetApplicationFormHelpPanelContent';

const sectionHeader = (label) => (
  <Box variant="h3" margin={{ top: 'l', bottom: 's' }}>{label}</Box>
);

const ReadOnlyInput = ({ value }) => (
  <Input value={value || ''} readOnly />
);

const ReadOnlyTextarea = ({ value }) => (
  <Textarea value={value || ''} readOnly />
);

const IsetApplicationFormWidget = ({ actions, application_id, caseData, toggleHelpPanel }) => {
  const [application, setApplication] = useState(null);
  const [ptma, setPtma] = useState({ ptma_name: '', ptma_code: '' });
  const [caseSummary, setCaseSummary] = useState('');
  const [initialCaseSummary, setInitialCaseSummary] = useState('');
  const [isChanged, setIsChanged] = useState(false);
  const [flashMessages, setFlashMessages] = useState([]);

  React.useEffect(() => {
    if (!application_id) return;
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/applications/${application_id}`)
      .then(res => res.json())
      .then(data => {
        setApplication(data);
        setPtma(data.ptma || { ptma_name: '', ptma_code: '' });
        setCaseSummary(data.case?.case_summary || '');
        setInitialCaseSummary(data.case?.case_summary || '');
      })
      .catch(() => {
        setApplication(null);
        setPtma({ ptma_name: '', ptma_code: '' });
        setCaseSummary('');
        setInitialCaseSummary('');
      });
  }, [application_id]);

  useEffect(() => {
    setIsChanged(caseSummary !== initialCaseSummary);
  }, [caseSummary, initialCaseSummary]);

  const handleSave = () => {
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/applications/${application_id}/ptma-case-summary`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case_summary: caseSummary }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to save');
        return res.json();
      })
      .then(data => {
        setInitialCaseSummary(data.case_summary || data.case?.case_summary || '');
        setIsChanged(false);
        setFlashMessages([{ type: 'success', content: 'Case summary saved successfully', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
      })
      .catch(() => {
        setFlashMessages([{ type: 'error', content: 'Error saving case summary', dismissible: true, onDismiss: () => setFlashMessages([]) }]);
      });
  };

  const handleCancel = () => {
    setCaseSummary(initialCaseSummary);
    setIsChanged(false);
  };

  if (!application) return (
    <BoardItem
      header={<Header
        info={
          <Link
            variant="info"
            onFollow={() => toggleHelpPanel && toggleHelpPanel(<IsetApplicationFormHelpPanelContent />, 'ISET Application Form Help')}
          >
            Info
          </Link>
        }
      >ISET Application Form</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        actions && actions.removeItem && (
          <SpaceBetween direction="horizontal" size="xs">
            {/* Add more settings if needed */}
          </SpaceBetween>
        )
      }
    >
      Loading...
    </BoardItem>
  );

  // Helper to sum numeric values in an array of items
  const sumTable = items => items.reduce((sum, item) => {
    const val = parseFloat(item.value);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // Prepare income and expense items (handle nulls as 0)
  const safe = v => v == null ? 0 : v;
  const incomeItems = [
    { label: 'Employment Income', value: safe(application.employment_income) },
    { label: 'Spousal Income', value: safe(application.spousal_income) },
    { label: 'Social Assistance', value: safe(application.social_assistance) },
    { label: 'Child Tax Benefit', value: safe(application.child_tax_benefit) },
    { label: 'Jordan’s Principle', value: safe(application.jordans_principle) },
    { label: 'Band Funding', value: safe(application.band_funding) },
    { label: 'Other Income Description', value: application.other_income_desc || '' },
    { label: 'Other Income Amount', value: safe(application.other_income_amount) }
  ];
  const expenseItems = [
    { label: 'Rent/Mortgage', value: safe(application.rent_mortgage) },
    { label: 'Utilities', value: safe(application.utilities) },
    { label: 'Groceries', value: safe(application.groceries) },
    { label: 'Transit Pass', value: safe(application.transit_pass) },
    { label: 'Childcare', value: safe(application.childcare) },
    { label: 'Other Expenses Description', value: application.other_expenses_desc || '' },
    { label: 'Other Expenses Amount', value: safe(application.other_expenses_amount) }
  ];
  const incomeTotal = sumTable(incomeItems);
  const expenseTotal = sumTable(expenseItems);

  return (
    <BoardItem
      header={<Header

        info={
          <Link
            variant="info"
            onFollow={() => toggleHelpPanel && toggleHelpPanel(<IsetApplicationFormHelpPanelContent />, 'ISET Application Form Help')}
          >
            Info
          </Link>
        }
      >ISET Application Form</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        actions && actions.removeItem &&
          <ButtonDropdown
            items={[{ id: 'remove', text: 'Remove' }]}
            ariaLabel="Board item settings"
            variant="icon"
            onItemClick={() => actions && actions.removeItem && actions.removeItem()}
          />
      }
    >
      <Box variant="small" margin={{ bottom: 's' }}>
        This form displays a read-only record of the information submitted by the applicant.
      </Box>
      <Flashbar items={flashMessages} />
      <Box>
        {sectionHeader('Application Details')}
        {/* Row 1: Tracking ID (2), Assigned Evaluator (3), PTMA Name (5), PTMA Code (2) */}
        <Grid gridDefinition={[
          { colspan: 2 }, // Tracking ID
          { colspan: 3 }, // Assigned Evaluator
          { colspan: 5 }, // PTMA Name
          { colspan: 2 }, // PTMA Code
        ]}>
          <FormField label="Tracking ID"><ReadOnlyInput value={caseData?.tracking_id} /></FormField>
          <FormField label="Assigned Evaluator"><ReadOnlyInput value={application?.assigned_evaluator?.name || ''} /></FormField>
          <FormField label="PTMA Name"><ReadOnlyInput value={ptma?.name || ''} /></FormField>
          <FormField label="PTMA Code"><ReadOnlyInput value={ptma?.iset_code || ''} /></FormField>
        </Grid>
        {/* Row 2: Submitted (2), Last Update (2), Status (2), Priority (2), Stage (4) */}
        <Grid gridDefinition={[
          { colspan: 2 }, // Submitted
          { colspan: 2 }, // Last Update
          { colspan: 2 }, // Status
          { colspan: 2 }, // Priority
          { colspan: 4 }, // Stage
        ]}>
          <FormField label="Submitted"><ReadOnlyInput value={caseData?.submitted_at?.slice(0,10)} /></FormField>
          <FormField label="Last Update"><ReadOnlyInput value={caseData?.last_activity_at?.slice(0,10)} /></FormField>
          <FormField label="Status"><ReadOnlyInput value={application?.case?.status || ''} /></FormField>
          <FormField label="Priority"><ReadOnlyInput value={application?.case?.priority || ''} /></FormField>
          <FormField label="Stage"><ReadOnlyInput value={application?.case?.stage || ''} /></FormField>
        </Grid>
        {sectionHeader('Personal Details')}
        <Grid gridDefinition={[{ colspan: 3 }, { colspan: 3 }, { colspan: 3 }, { colspan: 3 }]}> 
          <FormField label="SIN Number"><ReadOnlyInput value={application.sin_number} /></FormField>
          <FormField label="Last Name"><ReadOnlyInput value={application.last_name} /></FormField>
          <FormField label="First Name"><ReadOnlyInput value={application.first_name} /></FormField>
          <FormField label="Middle Names"><ReadOnlyInput value={application.middle_names} /></FormField>
          <FormField label="Preferred Name"><ReadOnlyInput value={application.preferred_name} /></FormField>
          <FormField label="Date of Birth"><ReadOnlyInput value={application.date_of_birth ? application.date_of_birth.slice(0, 10) : ''} /></FormField>
          <FormField label="Gender"><ReadOnlyInput value={application.gender} /></FormField>
          <FormField label="Indigenous Registration Number"><ReadOnlyInput value={application.indigenous_registration_number} /></FormField>
          <FormField label="Home Community"><ReadOnlyInput value={application.indigenous_home_community} /></FormField>
          <FormField label="Indigenous Group"><ReadOnlyInput value={application.indigenous_group} /></FormField>
        </Grid>
        {sectionHeader('Contact Information')}
        <Grid gridDefinition={[{ colspan: 3 }, { colspan: 3 }, { colspan: 3 }, { colspan: 3 }]}> 
          <FormField label="Street Address"><ReadOnlyInput value={application.street_address} /></FormField>
          <FormField label="City"><ReadOnlyInput value={application.city} /></FormField>
          <FormField label="Province"><ReadOnlyInput value={application.province} /></FormField>
          <FormField label="Postal Code"><ReadOnlyInput value={application.postal_code} /></FormField>
          <FormField label="Mailing Address"><ReadOnlyInput value={application.mailing_address} /></FormField>
          <FormField label="Daytime Phone"><ReadOnlyInput value={application.daytime_phone} /></FormField>
          <FormField label="Alternate Phone"><ReadOnlyInput value={application.alternate_phone} /></FormField>
          <FormField label="Email"><ReadOnlyInput value={application.email} /></FormField>
        </Grid>
        {sectionHeader('Emergency Contact')}
        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}> 
          <FormField label="Emergency Contact Name"><ReadOnlyInput value={application.emergency_contact_name} /></FormField>
          <FormField label="Emergency Contact Phone"><ReadOnlyInput value={application.emergency_contact_phone} /></FormField>
          <FormField label="Relationship to You"><ReadOnlyInput value={application.emergency_contact_relationship} /></FormField>
        </Grid>
        {sectionHeader('Demographics')}
        <Grid gridDefinition={[{ colspan: 3 }, { colspan: 3 }, { colspan: 3 }, { colspan: 3 }]}> 
          <FormField label="Visible Minority"><ReadOnlyInput value={application.visible_minority ? 'Yes' : 'No'} /></FormField>
          <FormField label="Preferred Language"><ReadOnlyInput value={application.preferred_language} /></FormField>
          <FormField label="Marital Status"><ReadOnlyInput value={application.marital_status} /></FormField>
          <FormField label="Spouse Name"><ReadOnlyInput value={application.spouse_name} /></FormField>
          <FormField label="Has Dependents"><ReadOnlyInput value={application.has_dependents ? 'Yes' : 'No'} /></FormField>
          <FormField label="Children Ages"><ReadOnlyInput value={application.children_ages} /></FormField>
        </Grid>
        {sectionHeader('Disability & Social Assistance')}
        {/* Row 1: Has Disability, Receives Social Assistance, Social Assistance Top-up */}
        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}> 
          <FormField label="Has Disability"><ReadOnlyInput value={application.has_disability ? 'Yes' : 'No'} /></FormField>
          <FormField label="Receives Social Assistance"><ReadOnlyInput value={application.receives_social_assistance ? 'Yes' : 'No'} /></FormField>
          <FormField label="Social Assistance Top-up"><ReadOnlyInput value={application.social_assistance_topup} /></FormField>
        </Grid>
        {/* Row 2: Disability Description full width, textarea */}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Disability Description"><ReadOnlyTextarea value={application.disability_description} /></FormField>
        </Grid>
        {sectionHeader('Labour Force & Education History')}
        <Grid gridDefinition={[{ colspan: 3 }, { colspan: 3 }, { colspan: 3 }, { colspan: 3 }]}> 
          <FormField label="Labour Force Status"><ReadOnlyInput value={application.labour_force_status} /></FormField>
          <FormField label="Education Level"><ReadOnlyInput value={application.education_level} /></FormField>
          <FormField label="Year Completed"><ReadOnlyInput value={application.education_year_completed} /></FormField>
          <FormField label="Education Location"><ReadOnlyInput value={application.education_location} /></FormField>
        </Grid>
        {sectionHeader('Employment Goals & Barriers')}
        {/* Row: Long Term Goal full width, textarea */}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Long Term Goal"><ReadOnlyTextarea value={application.employment_goals} /></FormField>
        </Grid>
        {/* Employment Barriers, Other Barriers, Identified Path */}
        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}> 
          <FormField label="Employment Barriers"><ReadOnlyInput value={Array.isArray(application.employment_barriers) ? application.employment_barriers.join(', ') : application.employment_barriers} /></FormField>
          <FormField label="Other Barriers"><ReadOnlyInput value={application.barriers_other_text} /></FormField>
          <FormField label="Identified Path"><ReadOnlyInput value={application.identified_path} /></FormField>
        </Grid>
        {sectionHeader('Financial Supports Requested')}
        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}> 
          <FormField label="Support Types"><ReadOnlyInput value={Array.isArray(application.financial_support_types) ? application.financial_support_types.join(', ') : application.financial_support_types} /></FormField>
          <FormField label="Other Support Detail"><ReadOnlyInput value={application.support_other_detail} /></FormField>
          <FormField label="Childcare Requested"><ReadOnlyInput value={application.childcare_requested ? 'Yes' : 'No'} /></FormField>
          <FormField label="Childcare Funding Source"><ReadOnlyInput value={application.childcare_funding_source} /></FormField>
        </Grid>
        {sectionHeader('Household Income')}
        <Table
          columnDefinitions={[
            { id: 'label', header: 'Type', cell: item => item.label },
            { id: 'value', header: 'Amount ($)', cell: item => item.value }
          ]}
          items={[
            ...incomeItems,
            { label: 'Total', value: incomeTotal.toFixed(2) }
          ]}
          variant="embedded"
          wrapLines
          stripedRows
          empty="No income data"
        />
        {sectionHeader('Household Expenses')}
        <Table
          columnDefinitions={[
            { id: 'label', header: 'Type', cell: item => item.label },
            { id: 'value', header: 'Amount ($)', cell: item => item.value }
          ]}
          items={[
            ...expenseItems,
            { label: 'Total', value: expenseTotal.toFixed(2) }
          ]}
          variant="embedded"
          wrapLines
          stripedRows
          empty="No expense data"
        />
        {sectionHeader('Other Funding Sources')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
          <FormField label="Receives Other Funding"><ReadOnlyInput value={application.receives_other_funding ? 'Yes' : 'No'} /></FormField>
          <FormField label="Other Funding Details"><ReadOnlyInput value={application.other_funding_details} /></FormField>
        </Grid>
      </Box>
    </BoardItem>
  );
};

export default IsetApplicationFormWidget;

// STANDARD: This widget and its parent dashboard follow the correct Board/BoardItem pattern for this project.
// Use this as a reference for future dashboard/widget implementations.
