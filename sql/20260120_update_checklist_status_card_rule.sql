-- Update checklist to require Status/Treaty Card or two Letters of Reference.
UPDATE iset_runtime_config
   SET v = '{
  "id": "iset-compliance-v1",
  "items": [
    {
      "id": "client-application",
      "label": "Completed Client Application (submitted)",
      "sources": ["application_form"],
      "required": true,
      "documentTypes": ["application_form"]
    },
    {
      "id": "ei-consent",
      "label": "EI Consent Form",
      "sources": ["application_form"],
      "required": true,
      "documentTypes": ["ei_consent"]
    },
    {
      "id": "ei-verification",
      "label": "EI Eligibility Verification (coordinator request)",
      "notes": "Should accompany EI consent.",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["ei_verification"]
    },
    {
      "id": "indigenous-declaration",
      "label": "Indigenous Self-Declaration (intake form) and/or two reference letters",
      "notes": "Two reference letters acceptable when no Status/Treaty card.",
      "sources": ["application_form","application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["indigenous_declaration","identity_document"]
    },
    {
      "id": "conflict-of-interest",
      "label": "Conflict of Interest Form",
      "sources": ["application_form"],
      "required": true,
      "documentTypes": ["conflict_of_interest"]
    },
    {
      "id": "identity-two-ids",
      "label": "Two pieces of ID (front/back)",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "minCount": 2,
      "required": true,
      "documentTypes": ["identity_document"]
    },
    {
      "id": "status-card-or-reference",
      "label": "Status or Treaty Card (or two Letters of Reference)",
      "notes": "If no status card, two letters of reference are required.",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "minCount": 2,
      "documentTypes": ["status_card","letter_of_reference"]
    },
    {
      "id": "band-letter",
      "label": "Band funding confirmation or denial letter",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["band_funding_confirmation","band_funding_denial"]
    },
    {
      "id": "acceptance-letter",
      "label": "Letter of Acceptance (current year/term)",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["acceptance_letter"]
    },
    {
      "id": "statement-of-account",
      "label": "Statement of Account (tuition, books, fees, equipment)",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["statement_of_account"]
    },
    {
      "id": "acknowledgement",
      "label": "Client Acknowledgement of Funding Source (signed/dated)",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["client_acknowledgement"]
    },
    {
      "id": "release-student-info",
      "label": "Client Authorization for Release of Student Information",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["release_student_info"]
    },
    {
      "id": "media-consent",
      "label": "Client consent for use of image/video/audio (if applicable)",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": false,
      "documentTypes": ["media_consent"]
    },
    {
      "id": "financial-overview",
      "label": "ISET Financial Overview (monthly budget)",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["financial_overview"]
    },
    {
      "id": "income-evidence",
      "label": "Income verification (self/spouse: last 3 pay stubs, CTB, ROE, T4s, etc.)",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "minCount": 3,
      "required": true,
      "documentTypes": ["financial_records","financial_evidence"]
    },
    {
      "id": "expense-evidence",
      "label": "Expense verification (lease/mortgage; 3 months utilities; childcare, etc.)",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["financial_evidence"]
    },
    {
      "id": "social-assistance-letter",
      "label": "Social Assistance letter from caseworker (for top-up, if applicable)",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": false,
      "documentTypes": ["supporting_evidence"]
    },
    {
      "id": "resume",
      "label": "Current resume",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["resume"]
    },
    {
      "id": "case-manager-assessment",
      "label": "Case Manager Assessment (summary/recommendation)",
      "sources": ["manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["case_assessment"]
    },
    {
      "id": "funding-agreement",
      "label": "Client Funding Agreement (signed/dated)",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["funding_agreement"]
    },
    {
      "id": "attendance-forms",
      "label": "Monthly Attendance Forms (one per living allowance month)",
      "notes": "Expect one per allowance month.",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "minCount": 1,
      "required": true,
      "documentTypes": ["attendance_form"]
    },
    {
      "id": "medical-documentation",
      "label": "Medical documentation for disability support",
      "sources": ["application_submission","manual_upload","secure_message_attachment"],
      "required": true,
      "documentTypes": ["medical_documentation"]
    }
  ],
  "label": "ISET Compliance Checklist",
  "version": "2026-01-20"
}'
 WHERE scope = 'checklist' AND k = 'checklist.compliance.iset';
