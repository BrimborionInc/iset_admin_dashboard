import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../auth/apiClient';
import { Box, Header, ButtonDropdown, Link, SpaceBetween, Button, Alert, Modal, FormField, Input, Textarea, Checkbox, DatePicker, Select, Grid, ColumnLayout, Table, RadioGroup } from '@cloudscape-design/components';
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

// Helper to format date as YYYY-MM-DD
const formatDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string' && date.length >= 10) return date.slice(0, 10);
  const d = new Date(date);
  if (isNaN(d)) return '';
  return d.toISOString().slice(0, 10);
};

const CoordinatorAssessmentWidget = ({ actions, toggleHelpPanel, caseData, application_id }) => {
  // State for form fields
  const [assessment, setAssessment] = useState({});
  const [initialAssessment, setInitialAssessment] = useState({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [alert, setAlert] = useState(null);
  const [isChanged, setIsChanged] = useState(false);
  const [showNWACSection, setShowNWACSection] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isEditingAssessment, setIsEditingAssessment] = useState(false);
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);
  const alertAnchorRef = useRef(null);

  // Pre-populate fields from application form as placeholders
  useEffect(() => {
    if (!caseData) return;
    const parseOrDefault = (val, def) => {
      if (!val) return def;
      try {
        if (typeof val === 'string') return JSON.parse(val);
        if (typeof val === 'object') return val;
      } catch (e) { return def; }
      return def;
    };
    const placeholders = {
      dateOfAssessment: caseData.assessment_date_of_assessment || '',
      clientName: caseData.applicant_name || '',
      overview: caseData?.case_summary || '',
      employmentGoals: caseData?.assessment_employment_goals || caseData?.employment_goals || '',
      previousISET: '',
      previousISETDetails: '',
      barriers: Array.isArray(caseData?.assessment_employment_barriers)
        ? caseData.assessment_employment_barriers
        : (Array.isArray(caseData?.employment_barriers) ? caseData.employment_barriers : []),
      priorities: Array.isArray(caseData?.assessment_local_area_priorities)
        ? caseData.assessment_local_area_priorities
        : [],
      otherFunding: caseData?.assessment_other_funding_details || caseData?.other_funding_details || '',
      esdcEligibility: caseData.assessment_esdc_eligibility || '',
      startDate: caseData.assessment_intervention_start_date || '',
      endDate: caseData.assessment_intervention_end_date || '',
      institution: caseData?.assessment_institution || caseData?.institution || '',
      programName: caseData?.assessment_program_name || '',
      itp: parseOrDefault(caseData.assessment_itp, { tuition: '', books: '', materials: '', living: '' }),
      wage: parseOrDefault(caseData.assessment_wage, { wages: '', mercs: '', nonwages: '', other: '' }),
      recommendation: caseData.assessment_recommendation || '',
      justification: caseData.assessment_justification || '',
      nwacReview: caseData.assessment_nwac_review || '',
      nwacReason: caseData.assessment_nwac_reason || ''
    };
    setAssessment(a => ({ ...placeholders, ...a }));
    setInitialAssessment(placeholders);
  }, [caseData]);

  // Show NWAC section if stage is 'assessment_submitted' or 'review_complete' on load
  useEffect(() => {
    if (caseData?.stage === 'assessment_submitted' || caseData?.stage === 'review_complete') {
      setShowNWACSection(true);
    } else {
      setShowNWACSection(false);
    }
  }, [caseData?.stage]);

  // Track changes
  useEffect(() => {
    setIsChanged(JSON.stringify(assessment) !== JSON.stringify(initialAssessment));
  }, [assessment, initialAssessment]);

  // Handlers
  // Enhanced handleField to clear error for the field if value is now valid
  const handleField = (field, value) => {
    setAssessment(a => ({ ...a, [field]: value }));
    if (hasSubmitted) {
      setFieldErrors(prev => {
        const next = { ...prev };
        // Re-validate just this field
        let error = undefined;
        switch (field) {
          case 'overview':
            if (!value || !value.trim()) error = 'Client application overview is required.';
            break;
          case 'employmentGoals':
            if (!value || !value.trim()) error = 'Employment goals are required.';
            break;
          case 'barriers':
            if (!Array.isArray(value) || value.length === 0) error = 'Select at least one barrier to employment.';
            break;
          case 'esdcEligibility':
            if (!value) error = 'Eligibility is required.';
            break;
          case 'startDate':
            if (!value) error = 'Start date is required.';
            break;
          case 'endDate':
            if (!value) error = 'End date is required.';
            break;
          case 'institution':
            if (!value || !value.trim()) error = 'Training institution or employer is required.';
            break;
          case 'programName':
            if (!value || !value.trim()) error = 'Program name is required.';
            break;
          case 'recommendation':
            if (!value) error = 'Recommendation is required.';
            break;
          case 'justification':
            if (!value || !value.trim()) error = 'Justification is required.';
            break;
          case 'previousISETDetails':
            if (assessment.previousISET === 'yes' && (!value || !value.trim())) error = 'Details for previous ISET funding are required.';
            break;
          case 'nwacReason':
            if (assessment.nwacReview && !value) error = 'Reason for denial by NWAC is required.';
            break;
          default:
            break;
        }
        if (!error) {
          delete next[field];
        } else {
          next[field] = error;
        }
        return next;
      });
    }
  };
  const handleCancel = () => setShowCancelModal(true);
  const confirmCancel = () => {
    setAssessment(initialAssessment);
    setShowCancelModal(false);
    setAlert(null);
  };
  const validateAssessment = (assessment) => {
    const errors = {};
    // 1. Overview
    if (!assessment.overview || !assessment.overview.trim()) {
      errors.overview = 'Client application overview is required.';
    }
    // 2. Employment Goals
    if (!assessment.employmentGoals || !assessment.employmentGoals.trim()) {
      errors.employmentGoals = 'Employment goals are required.';
    }
    // 3. Barriers
    if (!Array.isArray(assessment.barriers) || assessment.barriers.length === 0) {
      errors.barriers = 'Select at least one barrier to employment.';
    }
    // 4. ESDC Eligibility
    if (!assessment.esdcEligibility) {
      errors.esdcEligibility = 'Eligibility is required.';
    }
    // 5. Start Date (no longer mandatory)
    // 6. End Date (no longer mandatory)
    // 7. Institution (no longer mandatory)
    // 8. Program Name (no longer mandatory)
    // 9. ITP/Wage: validation removed, no funding required
    // 10. Recommendation
    if (!assessment.recommendation) {
      errors.recommendation = 'Recommendation is required.';
    }
    // 11. Justification
    if (!assessment.justification || !assessment.justification.trim()) {
      errors.justification = 'Justification is required.';
    }
    // 12. Conditional: Previous ISET Details
    if (assessment.previousISET === 'yes' && (!assessment.previousISETDetails || !assessment.previousISETDetails.trim())) {
      errors.previousISETDetails = 'Details for previous ISET funding are required.';
    }
    // 13. Conditional: NWAC fields
    if (assessment.nwacReview && !assessment.nwacReason) {
      errors.nwacReason = 'Reason for denial by NWAC is required.';
    }
    return errors;
  };
  const handleSubmit = async () => {
    setHasSubmitted(true);
    const errors = validateAssessment(assessment);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      console.log('Assessment validation failed:', errors);
      // Scroll to first error field
      setTimeout(() => {
        const firstErrorField = document.querySelector('[data-error-focus="true"]');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstErrorField.focus();
        } else {
          alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 0);
      return;
    }
    console.log('Assessment validation succeeded, proceeding to save.');
    // --- POST-VALIDATION WORKFLOW ---
    // 1. If assessment_date_of_assessment is missing, set to today (2025-06-11)
    let dateOfAssessment = assessment.dateOfAssessment;
    if (!dateOfAssessment) {
      dateOfAssessment = '2025-06-11';
    }
    dateOfAssessment = formatDate(dateOfAssessment);

    // 2. Save assessment (PUT /api/cases/:id)
    const payload = {
      ...assessment,
      dateOfAssessment,
      assessment_date_of_assessment: dateOfAssessment,
      assessment_employment_goals: assessment.employmentGoals || null,
      assessment_previous_iset: assessment.previousISET || null,
      assessment_previous_iset_details: assessment.previousISETDetails || null,
      assessment_employment_barriers: assessment.barriers || null,
      assessment_local_area_priorities: assessment.priorities || null,
      assessment_other_funding_details: assessment.otherFunding || null,
      assessment_esdc_eligibility: assessment.esdcEligibility || null,
      assessment_intervention_start_date: formatDate(assessment.startDate) || null,
      assessment_intervention_end_date: formatDate(assessment.endDate) || null,
      assessment_institution: assessment.institution || null,
      assessment_program_name: assessment.programName || null,
      assessment_itp: assessment.itp || [],
      assessment_wage: assessment.wage || [],
      assessment_recommendation: assessment.recommendation || null,
      assessment_justification: assessment.justification || null,
      assessment_nwac_review: assessment.nwacReview || null,
      assessment_nwac_reason: assessment.nwacReason || null,
      case_summary: assessment.overview || null
    };
    try {
      // Save assessment
      const res = await apiFetch(`/api/cases/${caseData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to save assessment.');

      // 3. Update stage to 'assessment_submitted' if not already
      if (caseData.stage !== 'assessment_submitted') {
        const stageRes = await apiFetch(`/api/cases/${caseData.id}/stage`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: 'assessment_submitted' })
        });
        if (!stageRes.ok) throw new Error('Failed to update case stage.');
      }

      // 4. Reload caseData (to update stage, etc.)
      if (typeof actions?.refreshCaseData === 'function') {
        await actions.refreshCaseData();
      }
      setIsEditingAssessment(false);
      setShowNWACSection(true);
      setAlert({ type: 'success', content: 'Assessment submitted successfully. NWAC review fields are now available.', dismissible: true });
      setTimeout(() => {
        alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } catch (err) {
      setAlert({ type: 'error', content: err.message || 'Failed to submit assessment.', dismissible: true });
      setTimeout(() => {
        alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  };

  // Enhanced handleItp and handleWage to clear funding error if valid
  const handleItp = (field, value) => {
    setAssessment(a => ({ ...a, itp: { ...a.itp, [field]: value } }));
    if (hasSubmitted) {
      setFieldErrors(prev => {
        const next = { ...prev };
        return next;
      });
    }
  };
  const handleWage = (field, value) => {
    setAssessment(a => ({ ...a, wage: { ...a.wage, [field]: value } }));
    if (hasSubmitted) {
      setFieldErrors(prev => {
        const next = { ...prev };
        return next;
      });
    }
  };

  const handleSave = async () => {
    setAlert(null);
    try {
      // Prepare payload for backend (map frontend fields to backend fields)
      const payload = {
        assessment_date_of_assessment: formatDate(assessment.dateOfAssessment) || null,
        assessment_employment_goals: assessment.employmentGoals || null,
        assessment_previous_iset: assessment.previousISET || null,
        assessment_previous_iset_details: assessment.previousISETDetails || null,
        assessment_employment_barriers: assessment.barriers || null,
        assessment_local_area_priorities: assessment.priorities || null,
        assessment_other_funding_details: assessment.otherFunding || null,
        assessment_esdc_eligibility: assessment.esdcEligibility || null,
        assessment_intervention_start_date: formatDate(assessment.startDate) || null,
        assessment_intervention_end_date: formatDate(assessment.endDate) || null,
        assessment_institution: assessment.institution || null,
        assessment_program_name: assessment.programName || null,
        assessment_itp: assessment.itp || [],
        assessment_wage: assessment.wage || [],
        assessment_recommendation: assessment.recommendation || null,
        assessment_justification: assessment.justification || null,
        assessment_nwac_review: assessment.nwacReview || null,
        assessment_nwac_reason: assessment.nwacReason || null,
        case_summary: assessment.overview || null
      };
      console.log('Saving assessment. Payload:', payload);
      const res = await apiFetch(`/api/cases/${caseData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      console.log('Save response:', res.status, result);
      if (res.ok && result.success) {
        setAlert({ type: 'success', content: 'Assessment saved successfully. All changes have been recorded.', dismissible: true });
        setInitialAssessment(assessment);
        setIsChanged(false);
        // Refresh caseData from backend to reflect latest changes
        if (typeof actions?.refreshCaseData === 'function') {
          await actions.refreshCaseData();
        }
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
      console.error('Save error:', err);
      setAlert({ type: 'error', content: err.message || 'Failed to save assessment.', dismissible: true });
      setTimeout(() => {
        alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  };

  // UI logic: if stage is 'assessment_submitted', make assessment fields readOnly, show NWAC review fields, change heading, and validate NWAC review on submit
  const isAssessmentSubmitted = caseData?.stage === 'assessment_submitted';
  const isReviewComplete = caseData?.stage === 'review_complete';
  // Disable all fields (including NWAC) if review is complete
  const isAssessmentDisabled = (isAssessmentSubmitted && !isEditingAssessment) || isReviewComplete;
  const isNWACFieldsDisabled = isReviewComplete;

  // For NWAC review validation
  const validateNWACReview = (assessment) => {
    const errors = {};
    if (!assessment.nwacReviewStatus) {
      errors.nwacReviewStatus = 'Approve/Reject selection is required.';
    }
    if (!assessment.nwacReview) {
      errors.nwacReview = 'NWAC review outcome is required.';
    }
    if (assessment.nwacReviewStatus === 'reject' && (!assessment.nwacReason || !assessment.nwacReason.trim())) {
      errors.nwacReason = 'Reason for denial by NWAC is required.';
    }
    return errors;
  };

  const handleNWACSubmit = async () => {
    setHasSubmitted(true);
    const errors = validateNWACReview(assessment);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setTimeout(() => {
        const firstErrorField = document.querySelector('[data-error-focus="true"]');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstErrorField.focus();
        } else {
          alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 0);
      return;
    }
    // Send full assessment payload to backend
    const payload = {
      assessment_date_of_assessment: formatDate(assessment.dateOfAssessment) || null,
      assessment_employment_goals: assessment.employmentGoals || null,
      assessment_previous_iset: assessment.previousISET || null,
      assessment_previous_iset_details: assessment.previousISETDetails || null,
      assessment_employment_barriers: assessment.barriers || null,
      assessment_local_area_priorities: assessment.priorities || null,
      assessment_other_funding_details: assessment.otherFunding || null,
      assessment_esdc_eligibility: assessment.esdcEligibility || null,
      assessment_intervention_start_date: formatDate(assessment.startDate) || null,
      assessment_intervention_end_date: formatDate(assessment.endDate) || null,
      assessment_institution: assessment.institution || null,
      assessment_program_name: assessment.programName || null,
      assessment_itp: assessment.itp || [],
      assessment_wage: assessment.wage || [],
      assessment_recommendation: assessment.recommendation || null,
      assessment_justification: assessment.justification || null,
      assessment_nwac_review: assessment.nwacReview || null,
      assessment_nwac_reason: assessment.nwacReason || null,
      case_summary: assessment.overview || null,
      status: assessment.nwacReviewStatus === 'approve' ? 'approved' : 'rejected'
    };
    try {
      // 1. Update case with NWAC review and status
      const res = await apiFetch(`/api/cases/${caseData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to save NWAC review.');
      // 2. Update stage to 'review_complete'
      const stageRes = await apiFetch(`/api/cases/${caseData.id}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'review_complete' })
      });
      if (!stageRes.ok) throw new Error('Failed to update case stage to review_complete.');
      // 3. Log NWAC review submitted event
      const userId = caseData?.user_id || caseData?.applicant_user_id || null;
      if (userId) {
        await apiFetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'nwac_review_submitted',
            caseId: caseData.id,
            payload: {
              message: 'NWAC review submitted.',
              nwac_review: assessment.nwacReview,
              timestamp: new Date().toISOString(),
            },
          }),
        });
        // 4. Log event for approval/rejection
        await apiFetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: assessment.nwacReviewStatus === 'approve' ? 'case_approved' : 'case_rejected',
            caseId: caseData.id,
            payload: {
              message: assessment.nwacReviewStatus === 'approve' ? 'Case approved by NWAC.' : 'Case rejected by NWAC.',
              reason: assessment.nwacReason || '',
              nwac_review: assessment.nwacReview,
              timestamp: new Date().toISOString(),
            },
          }),
        });

      }
      // 5. Refresh caseData to reflect new stage
      if (typeof actions?.refreshCaseData === 'function') {
        await actions.refreshCaseData();
      }
      setAlert({ type: 'success', content: 'NWAC review submitted and review marked complete.', dismissible: true });
      setInitialAssessment(a => ({ ...a, ...payload }));
      setIsChanged(false);
      setTimeout(() => {
        alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } catch (err) {
      setAlert({ type: 'error', content: err.message || 'Failed to submit NWAC review.', dismissible: true });
      setTimeout(() => {
        alertAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          actions={
            <SpaceBetween direction="horizontal" size="s">
              {isReviewComplete && (
                <Button variant="normal" onClick={() => setShowEditConfirmModal(true)}>Edit</Button>
              )}
              {!isReviewComplete && isAssessmentSubmitted && !isEditingAssessment && (
                <Button variant="normal" onClick={() => setShowEditConfirmModal(true)}>Edit</Button>
              )}
              {!isReviewComplete && (!isAssessmentSubmitted || isEditingAssessment) && <Button variant="primary" disabled={!isChanged} onClick={handleSave}>Save</Button>}
              {!isReviewComplete && (!isAssessmentSubmitted || isEditingAssessment) && <Button variant="normal" disabled={!isChanged} onClick={handleCancel}>Cancel</Button>}
              {!isReviewComplete && (!isAssessmentSubmitted || isEditingAssessment) && <Button variant="primary" disabled={false} onClick={handleSubmit}>Submit</Button>}
              {!isReviewComplete && isAssessmentSubmitted && !isEditingAssessment && caseData?.stage !== 'review_complete' && (
                <Button variant="primary" onClick={handleNWACSubmit}>Submit NWAC Review</Button>
              )}
            </SpaceBetween>
          }
          info={
            <Link variant="info" onFollow={() => toggleHelpPanel && toggleHelpPanel(null, isAssessmentSubmitted ? 'NWAC Assessment Help' : 'Coordinator Assessment Help')}>Info</Link>
          }
        >
          {isAssessmentSubmitted ? 'NWAC Assessment' : 'Coordinator Assessment'}
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
        <Box variant="small" margin={{ bottom: 's' }}>
          This form is used by the coordinator to assess the applicant’s needs, eligibility, and funding recommendation. Complete all required sections before submitting. After submission, NWAC review fields will become available.
        </Box>
        <div ref={alertAnchorRef} style={{ height: 0, margin: 0, padding: 0, border: 0 }} aria-hidden="true" />
        {alert && (
          <Alert type={alert.type} dismissible={alert.dismissible} onDismiss={() => setAlert(null)}>
            {alert.content}
          </Alert>
        )}
        {showNWACSection && (
          <>
            {sectionHeader('NWAC Review')}
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
              <FormField label="NWAC Review" errorText={hasSubmitted && fieldErrors.nwacReview ? fieldErrors.nwacReview : undefined}>
                <SpaceBetween direction="horizontal" size="xs">
                  <RadioGroup
                    value={assessment.nwacReviewStatus || ''}
                    onChange={({ detail }) => {
                      if (detail.value === 'approve' && assessment.nwacReason) {
                        setShowApproveConfirmModal(true);
                      } else {
                        handleField('nwacReviewStatus', detail.value);
                        if (detail.value === 'approve') handleField('nwacReason', '');
                      }
                    }}
                    items={[
                      { value: 'approve', label: 'Approve' },
                      { value: 'reject', label: 'Reject' }
                    ]}
                    ariaLabel="NWAC Review Status"
                    disabled={isReviewComplete}
                  />
                </SpaceBetween>
              </FormField>
              <FormField label="NWAC Review (Original)" errorText={hasSubmitted && fieldErrors.nwacReview ? fieldErrors.nwacReview : undefined}>
                <Select
                  selectedOption={assessment.nwacReview ? { label: assessment.nwacReview, value: assessment.nwacReview } : null}
                  onChange={({ detail }) => handleField('nwacReview', detail.selectedOption.value)}
                  options={[
                    { label: 'Agree with Coordinator Recommendation', value: 'agree' },
                    { label: 'Disagree with Coordinator Recommendation', value: 'disagree' }
                  ]}
                  placeholder="Select review outcome"
                  disabled={isReviewComplete}
                />
              </FormField>
            </Grid>
            {/* Move Reason for Denial outside the 6-6 grid for full width */}
            {assessment.nwacReviewStatus === 'reject' && (
              <Grid gridDefinition={[{ colspan: 12 }]}> 
                <FormField label="Reason for Denial by NWAC" stretch={true} >
                  <Box width="100%">
                    <Textarea value={assessment.nwacReason} onChange={({ detail }) => handleField('nwacReason', detail.value)} disabled={isReviewComplete} />
                  </Box>
                </FormField>
              </Grid>
            )}
            {/* Approve confirmation modal */}
            <Modal
              visible={showApproveConfirmModal}
              onDismiss={() => setShowApproveConfirmModal(false)}
              header="Clear Reason for Denial?"
              footer={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="primary" onClick={() => {
                    handleField('nwacReason', '');
                    handleField('nwacReviewStatus', 'approve');
                    setShowApproveConfirmModal(false);
                  }}>Clear and Approve</Button>
                  <Button variant="normal" onClick={() => setShowApproveConfirmModal(false)}>Cancel</Button>
                </SpaceBetween>
              }
            >
              <Box>Switching to "Approve" will clear the Reason for Denial. Do you want to continue?</Box>
            </Modal>
          </>
        )}
        {sectionHeader('Assessment Overview')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
          <FormField label="Date of Assessment">
            <DatePicker onChange={({ detail }) => handleField('dateOfAssessment', detail.value)} value={assessment.dateOfAssessment} readOnly={isAssessmentSubmitted} disabled={isAssessmentDisabled} />
          </FormField>
          <FormField label="Client Name">
            <Input value={assessment.clientName} readOnly disabled={isAssessmentDisabled} />
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Client Application Overview & Request" stretch={true} errorText={hasSubmitted && fieldErrors.overview ? fieldErrors.overview : undefined}
            description="Summarize the client's application, background, and the specific request or intervention being considered. Include any relevant context from the application form.">
            <Box width="100%">
              <Textarea placeholder={initialAssessment.overview} value={assessment.overview} onChange={({ detail }) => handleField('overview', detail.value)} data-error-focus={hasSubmitted && fieldErrors.overview ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
            </Box>
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Client’s Employment Goal(s)" stretch={true} errorText={hasSubmitted && fieldErrors.employmentGoals ? fieldErrors.employmentGoals : undefined}
            description="Describe the client's short- and long-term employment goals as discussed during assessment. Reference the goals stated in the application form if available.">
            <Box width="100%">
              <Textarea placeholder={initialAssessment.employmentGoals} value={assessment.employmentGoals} onChange={({ detail }) => handleField('employmentGoals', detail.value)} data-error-focus={hasSubmitted && fieldErrors.employmentGoals ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
            </Box>
          </FormField>
        </Grid>
        {sectionHeader('Previous ISET Funding')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
          <FormField label="Was the Client previously funded under the ISET Program?"
            description="Indicate if the client has received ISET funding in the past. If yes, provide details below.">
            <Checkbox checked={assessment.previousISET === 'yes'} onChange={({ detail }) => handleField('previousISET', detail.checked ? 'yes' : 'no')} disabled={isAssessmentDisabled}>Yes</Checkbox>
          </FormField>
          {assessment.previousISET === 'yes' && (
            <Grid gridDefinition={[{ colspan: 12 }]}> 
              <FormField label="If Yes, provide dates and specifics" stretch={true} errorText={hasSubmitted && fieldErrors.previousISETDetails ? fieldErrors.previousISETDetails : undefined}
                description="List the dates and details of any previous ISET funding the client has received.">
                <Box width="100%">
                  <Textarea value={assessment.previousISETDetails} onChange={({ detail }) => handleField('previousISETDetails', detail.value)} data-error-focus={hasSubmitted && fieldErrors.previousISETDetails ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
                </Box>
              </FormField>
            </Grid>
          )}
        </Grid>
        {sectionHeader('Barriers to Employment')}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Barriers (select all that apply)" errorText={hasSubmitted && fieldErrors.barriers ? fieldErrors.barriers : undefined}
            description="Select all barriers that may impact the client's ability to obtain or maintain employment. These may be self-identified or observed during assessment.">
            <ColumnLayout columns={3} borders="horizontal">
              {BARRIERS.map(barrier => (
                <Checkbox
                  key={barrier}
                  checked={assessment.barriers?.includes(barrier)}
                  onChange={({ detail }) => {
                    const next = assessment.barriers || [];
                    handleField('barriers', detail.checked ? [...next, barrier] : next.filter(b => b !== barrier));
                  }}
                  disabled={isAssessmentDisabled}
                >{barrier}</Checkbox>
              ))}
            </ColumnLayout>
          </FormField>
        </Grid>
        {sectionHeader('Local Area Priorities (Target Areas)')}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Priority Population Groups (select all that apply)"
            description="Identify if the client belongs to any priority population groups targeted by your local area or program.">
            <ColumnLayout columns={3} borders="horizontal">
              {PRIORITIES.map(priority => (
                <Checkbox
                  key={priority}
                  checked={assessment.priorities?.includes(priority)}
                  onChange={({ detail }) => {
                    const next = assessment.priorities || [];
                    handleField('priorities', detail.checked ? [...next, priority] : next.filter(p => p !== priority));
                  }}
                  disabled={isAssessmentDisabled}
                >{priority}</Checkbox>
              ))}
            </ColumnLayout>
          </FormField>
        </Grid>
        {sectionHeader('Other Funding Sources')}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Has the Client received any other sources of funding for this intervention?" stretch={true}
            description="Describe any other funding the client has received or applied for in relation to this intervention.">
            <Box width="100%">
              <Textarea placeholder={initialAssessment.otherFunding} value={assessment.otherFunding} onChange={({ detail }) => handleField('otherFunding', detail.value)} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
            </Box>
          </FormField>
        </Grid>
        {sectionHeader('ESDC Eligibility')}
        <Grid gridDefinition={[{ colspan: 12 }]}> 
          <FormField label="Eligibility" errorText={hasSubmitted && fieldErrors.esdcEligibility ? fieldErrors.esdcEligibility : undefined}
            description="Select the client's eligibility category for ESDC funding. This is required for reporting and program compliance.">
            <Select
              selectedOption={ESDC_OPTIONS.find(o => o.value === assessment.esdcEligibility) || null}
              onChange={({ detail }) => handleField('esdcEligibility', detail.selectedOption.value)}
              options={ESDC_OPTIONS}
              placeholder="Select eligibility"
              ariaLabel="Eligibility"
              data-error-focus={hasSubmitted && fieldErrors.esdcEligibility ? 'true' : undefined}
              tabIndex={-1}
              disabled={isAssessmentDisabled}
            />
          </FormField>
        </Grid>
        {sectionHeader('Intervention Details')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
          <FormField label="Start Date" errorText={hasSubmitted && fieldErrors.startDate ? fieldErrors.startDate : undefined}
            description="Enter the planned start date for the intervention or training.">
            <DatePicker onChange={({ detail }) => handleField('startDate', detail.value)} value={assessment.startDate} ariaLabel="Start Date" data-error-focus={hasSubmitted && fieldErrors.startDate ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
          </FormField>
          <FormField label="End Date" errorText={hasSubmitted && fieldErrors.endDate ? fieldErrors.endDate : undefined}
            description="Enter the planned end date for the intervention or training.">
            <DatePicker onChange={({ detail }) => handleField('endDate', detail.value)} value={assessment.endDate} ariaLabel="End Date" data-error-focus={hasSubmitted && fieldErrors.endDate ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
          </FormField>
        </Grid>
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
          <FormField label="Training Institution/Employer" errorText={hasSubmitted && fieldErrors.institution ? fieldErrors.institution : undefined}
            description="Provide the name of the training institution or employer for this intervention.">
            <Input value={assessment.institution} onChange={({ detail }) => handleField('institution', detail.value)} ariaLabel="Training Institution/Employer" data-error-focus={hasSubmitted && fieldErrors.institution ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
          </FormField>
          <FormField label="Program Name" errorText={hasSubmitted && fieldErrors.programName ? fieldErrors.programName : undefined}
            description="Enter the name of the program or position the client will participate in.">
            <Input value={assessment.programName} onChange={({ detail }) => handleField('programName', detail.value)} ariaLabel="Program Name" data-error-focus={hasSubmitted && fieldErrors.programName ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
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
                readOnly={isAssessmentDisabled}
                disabled={isAssessmentDisabled}
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
            <>
              <Box fontWeight="bold" textAlign="right">
                Total Intervention Cost: $
                {(
                  Number((assessment.itp?.tuition || '').replace(/[^\d.]/g, '')) +
                  Number((assessment.itp?.books || '').replace(/[^\d.]/g, '')) +
                  Number((assessment.itp?.materials || '').replace(/[^\d.]/g, '')) +
                  Number((assessment.itp?.living || '').replace(/[^\d.]/g, ''))
                ).toFixed(2)}
              </Box>
            </>
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
                readOnly={isAssessmentDisabled}
                disabled={isAssessmentDisabled}
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
            <>
              <Box fontWeight="bold" textAlign="right">
                Total Intervention Cost: $
                {(
                  Number((assessment.wage?.wages || '').replace(/[^\d.]/g, '')) +
                  Number((assessment.wage?.mercs || '').replace(/[^\d.]/g, '')) +
                  Number((assessment.wage?.nonwages || '').replace(/[^\d.]/g, '')) +
                  Number((assessment.wage?.other || '').replace(/[^\d.]/g, ''))
                ).toFixed(2)}
              </Box>
            </>
          }
        />
        {sectionHeader('Coordinator’s Recommendation')}
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}> 
          <FormField label="Recommendation" errorText={hasSubmitted && fieldErrors.recommendation ? fieldErrors.recommendation : undefined}
            description="Select your recommendation for this application. If not recommending funding, provide an alternative or rationale below.">
            <Select
              selectedOption={RECOMMEND_OPTIONS.find(o => o.value === assessment.recommendation) || null}
              onChange={({ detail }) => handleField('recommendation', detail.selectedOption.value)}
              options={RECOMMEND_OPTIONS}
              placeholder="Select recommendation"
              ariaLabel="Recommendation"
              data-error-focus={hasSubmitted && fieldErrors.recommendation ? 'true' : undefined}
              tabIndex={-1}
              disabled={isAssessmentDisabled}
            />
          </FormField>
          <FormField label="Justification" stretch={true} errorText={hasSubmitted && fieldErrors.justification ? fieldErrors.justification : undefined}
            description="Provide a clear justification for your recommendation, referencing the client's needs, goals, and eligibility.">
            <Box width="100%">
              <Textarea  value={assessment.justification} onChange={({ detail }) => handleField('justification', detail.value)} data-error-focus={hasSubmitted && fieldErrors.justification ? 'true' : undefined} tabIndex={-1} readOnly={isAssessmentDisabled} disabled={isAssessmentDisabled} />
            </Box>
          </FormField>
        </Grid>
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
        <Modal
          visible={showEditConfirmModal}
          onDismiss={() => setShowEditConfirmModal(false)}
          header="Edit Submitted Assessment?"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" onClick={() => { setIsEditingAssessment(true); setShowEditConfirmModal(false); }}>Edit Assessment</Button>
              <Button variant="normal" onClick={() => setShowEditConfirmModal(false)}>Cancel</Button>
            </SpaceBetween>
          }
        >
          <Box>Are you sure you want to edit the previously submitted assessment? This will allow you to make changes and resubmit. Your changes will not be saved until you click Save or Submit.</Box>
        </Modal>
      </Box>
    </BoardItem>
  );
};

export default CoordinatorAssessmentWidget;
