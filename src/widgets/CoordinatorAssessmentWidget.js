import React, { useState, useEffect, useRef } from 'react';
import { Box, Header, ButtonDropdown, Link, SpaceBetween, Button, Alert, Modal, FormField, Input, Textarea, Checkbox, DatePicker, Select, Grid, ColumnLayout, Table } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const BARRIERS = [
  'None', 'Education', 'Lack of Marketable Skills', 'Lack of Work Experience', 'Remoteness', 'Lack of Transportation', 'Economic', 'Language', 'Lack of Labour Force Attachment', 'Dependent Care', 'Physical, Emotional, or Mental Health', 'Other'
];
const PRIORITIES = [
  'Off Reserve', 'Single Parent Family', 'Woman over 45', 'Literacy', 'Youth', 'Unskilled Clerical/Service Worker', 'No Grade 12', 'Unskilled Labourer', 'Non-Targeted'
];
const ESDC_OPTIONS = [
  { label: 'CRF', value: 'CRF' },
  { label: 'EI Active Claim', value: 'EI Active Claim' },
  { label: 'EI Reach Back', value: 'EI Reach Back' }
];
const RECOMMEND_OPTIONS = [
  { label: 'Recommend funding this intervention', value: 'recommend' },
  { label: 'Do not recommend funding', value: 'no_recommend' },
  { label: 'Recommend alternative intervention', value: 'alternative' }
];

// Section header helper for consistent spacing
const sectionHeader = (label) => (
  <Box variant="h3" margin={{ top: 'l', bottom: 's' }}>{label}</Box>
);

const CoordinatorAssessmentWidget = ({ actions, toggleHelpPanel, caseData, application_id }) => {
  // State for form fields
  const [assessment, setAssessment] = useState({});
  const [initialAssessment, setInitialAssessment] = useState({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [alert, setAlert] = useState(null);
  const [isChanged, setIsChanged] = useState(false);
  const [showNWACSection, setShowNWACSection] = useState(false);
  const alertAnchorRef = useRef(null);

  // Pre-populate fields from application form as placeholders
  useEffect(() => {
    if (!caseData) return;
    const placeholders = {
      dateOfAssessment: '',
      clientName: caseData.applicant_name || '',
      overview: caseData?.case_summary || '',
      employmentGoals: caseData?.assessment_employment_goals || caseData?.employment_goals || '',
      previousISET: '',
      previousISETDetails: '',
      barriers: Array.isArray(caseData?.assessment_employment_barriers)
        ? caseData.assessment_employment_barriers
        : (Array.isArray(caseData?.employment_barriers) ? caseData.employment_barriers : []),
      priorities: [],
      otherFunding: caseData?.assessment_other_funding_details || caseData?.other_funding_details || '',
      esdcEligibility: '',
      startDate: '',
      endDate: '',
      institution: caseData?.assessment_institution || caseData?.institution || '',
      programName: caseData?.assessment_program_name || '',
      itp: { tuition: '', living: '', other: '', total: '' },
      wage: { wages: '', mercs: '', nonwages: '', other: '', total: '' },
      recommendation: '',
      justification: '',
      nwacReview: '',
      nwacReason: ''
    };
    setAssessment(a => {
      const updated = { ...placeholders, ...a, clientName: placeholders.clientName };
      return updated;
    });
    setInitialAssessment(placeholders);
  }, [caseData]);

  // Track changes
  useEffect(() => {
    setIsChanged(JSON.stringify(assessment) !== JSON.stringify(initialAssessment));
  }, [assessment, initialAssessment]);

  // Handlers
  const handleField = (field, value) => setAssessment(a => ({ ...a, [field]: value }));
  const handleItp = (field, value) => setAssessment(a => ({ ...a, itp: { ...a.itp, [field]: value } }));
  const handleWage = (field, value) => setAssessment(a => ({ ...a, wage: { ...a.wage, [field]: value } }));

  const handleSave = async () => {
    setAlert(null);
    try {
      // Prepare payload for backend (map frontend fields to backend fields)
      const payload = {
        assessment_date_of_assessment: assessment.dateOfAssessment || null,
        assessment_employment_goals: assessment.employmentGoals || null,
        assessment_previous_iset: assessment.previousISET || null,
        assessment_previous_iset_details: assessment.previousISETDetails || null,
        assessment_employment_barriers: assessment.barriers || null,
        assessment_local_area_priorities: assessment.priorities || null,
        assessment_other_funding_details: assessment.otherFunding || null,
        assessment_esdc_eligibility: assessment.esdcEligibility || null,
        assessment_intervention_start_date: assessment.startDate || null,
        assessment_intervention_end_date: assessment.endDate || null,
        assessment_institution: assessment.institution || null,
        assessment_program_name: assessment.programName || null,
        assessment_itp: assessment.itp || [],
        assessment_wage: assessment.wage || [],
        assessment_recommendation: assessment.recommendation || null,
        assessment_justification: assessment.justification || null,
        assessment_nwac_review: assessment.nwacReview || null,
        assessment_nwac_reason: assessment.nwacReason || null
      };
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/cases/${caseData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setAlert({ type: 'success', content: 'Assessment saved successfully. All changes have been recorded.', dismissible: true });
        setInitialAssessment(assessment);
        setIsChanged(false);
        // Scroll to the alert anchor so the alert is visible
        setTimeout(() => {
          alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
      } else {
        setAlert({ type: 'error', content: result.error || 'Failed to save assessment.', dismissible: true });
        setTimeout(() => {
          alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
      }
    } catch (err) {
      setAlert({ type: 'error', content: err.message || 'Failed to save assessment.', dismissible: true });
      setTimeout(() => {
        alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  };
  const handleCancel = () => setShowCancelModal(true);
  const confirmCancel = () => {
    setAssessment(initialAssessment);
    setShowCancelModal(false);
    setAlert(null);
  };
  const handleSubmit = () => {
    // TODO: Validation and submit logic
    setShowNWACSection(true);
    setAlert({ type: 'success', content: 'Assessment submitted for NWAC review.', dismissible: true });
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" disabled={!isChanged} onClick={handleSave}>Save</Button>
              <Button variant="normal" disabled={!isChanged} onClick={handleCancel}>Cancel</Button>
              <Button variant="primary" disabled={true /* TODO: Enable when all required fields complete */} onClick={handleSubmit}>Submit</Button>
            </SpaceBetween>
          }
          info={
            <Link variant="info" onFollow={() => toggleHelpPanel && toggleHelpPanel(null, 'Coordinator Assessment Help')}>Info</Link>
          }
        >
          Coordinator Assessment
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions && actions.removeItem && actions.removeItem()}
        />
      }
    >
      <Box>
        <div ref={alertAnchorRef} style={{ height: 0, margin: 0, padding: 0, border: 0 }} aria-hidden="true" />
        {alert && (
          <Alert type={alert.type} dismissible={alert.dismissible} onDismiss={() => setAlert(null)}>
            {alert.content}
          </Alert>
        )}
        {sectionHeader('Basic Client Information')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
          <FormField label="Date of Assessment">
            <DatePicker onChange={({ detail }) => handleField('dateOfAssessment', detail.value)} value={assessment.dateOfAssessment} />
          </FormField>
          <FormField label="Client Name">
            <Input value={assessment.clientName} readOnly />
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }]}>
          <FormField label="Client Application Overview & Request" stretch={true} >
            <Box width="100%">
              <Textarea placeholder={initialAssessment.overview} value={assessment.overview} onChange={({ detail }) => handleField('overview', detail.value)} />
            </Box>
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }]}>
          <FormField label="Client’s Employment Goal(s)" stretch={true} >
            <Box width="100%">
              <Textarea placeholder={initialAssessment.employmentGoals} value={assessment.employmentGoals} onChange={({ detail }) => handleField('employmentGoals', detail.value)} />
            </Box>
          </FormField>
        </Grid>
        {sectionHeader('Previous ISET Funding')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
          <FormField label="Was the Client previously funded under the ISET Program?">
            <Checkbox checked={assessment.previousISET === 'yes'} onChange={({ detail }) => handleField('previousISET', detail.checked ? 'yes' : 'no')}>Yes</Checkbox>
          </FormField>
          {assessment.previousISET === 'yes' && (
            <Grid gridDefinition={[{ colspan: 12 }]}> 
              <FormField label="If Yes, provide dates and specifics" stretch={true} >
                <Box width="100%">
                  <Textarea value={assessment.previousISETDetails} onChange={({ detail }) => handleField('previousISETDetails', detail.value)} />
                </Box>
              </FormField>
            </Grid>
          )}
        </Grid>
        {sectionHeader('Barriers to Employment')}
        <Grid gridDefinition={[{ colspan: 12 }]}>
          <FormField label="Barriers (select all that apply)">
            <ColumnLayout columns={3} borders="horizontal">
              {BARRIERS.map(barrier => (
                <Checkbox
                  key={barrier}
                  checked={assessment.barriers?.includes(barrier)}
                  onChange={({ detail }) => {
                    const next = assessment.barriers || [];
                    handleField('barriers', detail.checked ? [...next, barrier] : next.filter(b => b !== barrier));
                  }}
                >{barrier}</Checkbox>
              ))}
            </ColumnLayout>
          </FormField>
        </Grid>
        {sectionHeader('Local Area Priorities (Target Areas)')}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Priority Population Groups (select all that apply)">
            <ColumnLayout columns={3} borders="horizontal">
              {PRIORITIES.map(priority => (
                <Checkbox
                  key={priority}
                  checked={assessment.priorities?.includes(priority)}
                  onChange={({ detail }) => {
                    const next = assessment.priorities || [];
                    handleField('priorities', detail.checked ? [...next, priority] : next.filter(p => p !== priority));
                  }}
                >{priority}</Checkbox>
              ))}
            </ColumnLayout>
          </FormField>
        </Grid>
        {sectionHeader('Other Funding Sources')}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Has the Client received any other sources of funding for this intervention?" stretch={true} >
            <Box width="100%">
              <Textarea placeholder={initialAssessment.otherFunding} value={assessment.otherFunding} onChange={({ detail }) => handleField('otherFunding', detail.value)} />
            </Box>
          </FormField>
        </Grid>
        {sectionHeader('ESDC Eligibility')}
        <Grid gridDefinition={[{ colspan: 12 }]}>
          <FormField label="Eligibility">
            <Select
              selectedOption={ESDC_OPTIONS.find(o => o.value === assessment.esdcEligibility) || null}
              onChange={({ detail }) => handleField('esdcEligibility', detail.selectedOption.value)}
              options={ESDC_OPTIONS}
              placeholder="Select eligibility"
            />
          </FormField>
        </Grid>
        {sectionHeader('Intervention Details')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
          <FormField label="Start Date">
            <DatePicker onChange={({ detail }) => handleField('startDate', detail.value)} value={assessment.startDate} />
          </FormField>
          <FormField label="End Date">
            <DatePicker onChange={({ detail }) => handleField('endDate', detail.value)} value={assessment.endDate} />
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
          <FormField label="Training Institution/Employer">
            <Input value={assessment.institution} onChange={({ detail }) => handleField('institution', detail.value)} />
          </FormField>
          <FormField label="Program Name">
            <Input value={assessment.programName} onChange={({ detail }) => handleField('programName', detail.value)} />
          </FormField>
        </Grid>
        <Box margin={{ top: 'l', bottom: 's' }}>
          <Header variant="h3">Individual Training Purchase (ITP)</Header>
        </Box>
        <Table
          stripedRows
          columnDefinitions={[
            { id: 'category', header: 'Funding Category', cell: item => item.label },
            { id: 'requested', header: 'Funding Requested', cell: item => (
              <Input
                type="text"
                value={assessment.itp?.[item.key] || ''}
                onChange={({ detail }) => {
                  const raw = detail.value.replace(/[^\d.]/g, '');
                  handleItp(item.key, raw);
                }}
                onBlur={({ detail }) => {
                  const raw = assessment.itp?.[item.key] || '';
                  const num = raw ? parseFloat(raw) : '';
                  const formatted = num !== '' && !isNaN(num) ? `$ ${num.toFixed(2)}` : '';
                  handleItp(item.key, formatted);
                }}
                ariaLabel={item.label}
              />
            ) },
            { id: 'actions', header: 'Actions', cell: item => (
              <Button size="small" variant="inline-link" onClick={() => handleItp(item.key, '')}>Clear</Button>
            ) }
          ]}
          items={[
            { key: 'tuition', label: 'Tuition' },
            { key: 'books', label: 'Books' },
            { key: 'materials', label: 'Materials' },
            { key: 'living', label: 'Living Allowance' }
          ]}
          variant="embedded"
          header={null}
          footer={
            <Box fontWeight="bold" textAlign="right">
              Total Intervention Cost: $
              {(
                Number((assessment.itp?.tuition || '').replace(/[^\d.]/g, '')) +
                Number((assessment.itp?.books || '').replace(/[^\d.]/g, '')) +
                Number((assessment.itp?.materials || '').replace(/[^\d.]/g, '')) +
                Number((assessment.itp?.living || '').replace(/[^\d.]/g, ''))
              ).toFixed(2)}
            </Box>
          }
        />
        <Box margin={{ top: 'l', bottom: 's' }}>
          <Header variant="h3">Targeted Wage Subsidy / Job Creation Partnership</Header>
        </Box>
        <Table
          stripedRows
          columnDefinitions={[
            { id: 'category', header: 'Funding Category', cell: item => item.label },
            { id: 'requested', header: 'Funding Requested', cell: item => (
              <Input
                type="text"
                value={assessment.wage?.[item.key] || ''}
                onChange={({ detail }) => {
                  if (item.key === 'other') {
                    handleWage(item.key, detail.value);
                  } else {
                    const raw = detail.value.replace(/[^\d.]/g, '');
                    handleWage(item.key, raw);
                  }
                }}
                onBlur={({ detail }) => {
                  if (item.key === 'other') return;
                  const raw = assessment.wage?.[item.key] || '';
                  const num = raw ? parseFloat(raw) : '';
                  const formatted = num !== '' && !isNaN(num) ? `$ ${num.toFixed(2)}` : '';
                  handleWage(item.key, formatted);
                }}
                ariaLabel={item.label}
              />
            ) },
            { id: 'actions', header: 'Actions', cell: item => (
              <Button size="small" variant="inline-link" onClick={() => handleWage(item.key, '')}>Clear</Button>
            ) }
          ]}
          items={[
            { key: 'wages', label: 'Wages' },
            { key: 'mercs', label: 'MERCs' },
            { key: 'nonwages', label: 'Non-Wages' },
            { key: 'other', label: 'Other' }
          ]}
          variant="embedded"
          header={null}
          footer={
            <Box fontWeight="bold" textAlign="right">
              Total Intervention Cost: $
              {(
                Number((assessment.wage?.wages || '').replace(/[^\d.]/g, '')) +
                Number((assessment.wage?.mercs || '').replace(/[^\d.]/g, '')) +
                Number((assessment.wage?.nonwages || '').replace(/[^\d.]/g, '')) +
                Number((assessment.wage?.other || '').replace(/[^\d.]/g, ''))
              ).toFixed(2)}
            </Box>
          }
        />
        {sectionHeader('Coordinator’s Recommendation')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
          <FormField label="Recommendation">
            <Select
              selectedOption={RECOMMEND_OPTIONS.find(o => o.value === assessment.recommendation) || null}
              onChange={({ detail }) => handleField('recommendation', detail.selectedOption.value)}
              options={RECOMMEND_OPTIONS}
              placeholder="Select recommendation"
            />
          </FormField>
          <FormField label="Justification" stretch={true} >
            <Box width="100%">
              <Textarea  value={assessment.justification} onChange={({ detail }) => handleField('justification', detail.value)} />
            </Box>
          </FormField>
        </Grid>
        {showNWACSection && (
          <>
            {sectionHeader('NWAC Review')}
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
              <FormField label="NWAC Review">
                <Select
                  selectedOption={assessment.nwacReview ? { label: assessment.nwacReview, value: assessment.nwacReview } : null}
                  onChange={({ detail }) => handleField('nwacReview', detail.selectedOption.value)}
                  options={[
                    { label: 'Agree with Coordinator Recommendation', value: 'agree' },
                    { label: 'Disagree with Coordinator Recommendation', value: 'disagree' }
                  ]}
                  placeholder="Select review outcome"
                />
              </FormField>
              <FormField label="Reason for Denial by NWAC" stretch={true} >
                <Box width="100%">
                  <Textarea value={assessment.nwacReason} onChange={({ detail }) => handleField('nwacReason', detail.value)} />
                </Box>
              </FormField>
            </Grid>
          </>
        )}
        <Modal
          visible={showCancelModal}
          onDismiss={() => setShowCancelModal(false)}
          header="Discard changes?"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" onClick={confirmCancel}>Discard Changes</Button>
              <Button variant="normal" onClick={() => setShowCancelModal(false)}>Cancel</Button>
            </SpaceBetween>
          }
        >
          <Box>Are you sure you want to discard your changes? This action cannot be undone.</Box>
        </Modal>
      </Box>
    </BoardItem>
  );
};

export default CoordinatorAssessmentWidget;
