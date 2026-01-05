Purpose: Combined design, planning, and implementation tracker for adding application-form and financial-overview PDFs to the assessment submission flow.  
Audience: Casework engineers, product, ops.  
Last Updated: 2026-01-04

# Assessment + Application + Financial Overview PDF Tracker

## Scope
- When an assessment is submitted (same trigger that generates the assessment PDF), also generate a PDF version of the application form.
- When an assessment is submitted, also generate a PDF version of the financial overview (monthly budget) from application finance fields.
- Store the application PDF and financial overview PDF alongside the existing assessment PDF in `iset_document`.

## Phase
- Design: Complete.
- Planning: Complete.
- Implementation: Complete (pending validation).

## Current Behavior (baseline)
- Assessment submission with status `pending_approval` generates a PDF via `generateAssessmentPdfBuffer` and stores it as `case_assessment`.
- Application-form PDF is generated on the same trigger and stored as `application_form`.

## Design Notes (emerging)
- Add application-form PDF generation to the same submission path as the assessment PDF.
- Add financial-overview PDF generation to the same submission path as the assessment PDF.
- Application PDF should use the latest edited application data when edits exist.
- Financial overview PDF should use the latest edited application finance data when edits exist.
- Only generate the application PDF when the assessment submission transitions to `pending_approval`.
- Only generate the financial overview PDF when the assessment submission transitions to `pending_approval`.
- Store the application PDF using the existing `document_type.code` of `application_form`, aligned with how `case_assessment` is stored.
- Store the financial overview PDF using the existing `document_type.code` of `financial_overview`.
- Application PDF should surface in Supporting Documents like other uploaded files.
- Financial overview PDF should surface in Supporting Documents like other uploaded files.
- Generating a new application PDF should archive/replace any existing `application_form` document for the application.
- Generating a new financial overview PDF should archive/replace any existing `financial_overview` document for the application.
- Application PDF should include only application-form fields (no internal notes).
- Financial overview PDF should include only the household finance fields (monthly budget snapshot).
- Layout should emulate the paper application form; improvements are allowed.
- English-only output is acceptable.
- Do not include supporting document lists or consent forms in the application PDF.
- Omit applicant-facing instructional rubric text; render a clean data-only form.
- Include full SIN and registration number (no masking); treat as confidential.
- Omit applicant signatures.
- Use checkbox grids for multi-select fields (checked + unchecked) and keep layout dense.
- Minimal header with NWAC logo; omit government footer; keep overall layout dense.
- Use Letter page size (not A4).
- Header should include the Application Overview "Reference #" value.
- Header should include applicant name and application received date.
- "Application received at" should use the same "Received At" value shown in the Application Overview widget.

## Open Questions
- None (assume paper-form section order).

## Decisions
- Use latest edited application data (if edits exist) for the application PDF.
- Use latest edited finance data (if edits exist) for the financial overview PDF.
- Generate the application PDF only when the assessment submission moves to `pending_approval`.
- Generate the financial overview PDF only when the assessment submission moves to `pending_approval`.
- Use `application_form` as the document category/type code (consistent with `case_assessment` handling).
- Use `financial_overview` as the document category/type code.
- Treat the application PDF as a supporting document.
- Treat the financial overview PDF as a supporting document.
- Replace (archive) any existing `application_form` document when generating a new one.
- Replace (archive) any existing `financial_overview` document when generating a new one.
- Use only application-form fields; follow the paper form layout with allowed refinements.
- Use only application finance fields; render a dense monthly budget snapshot.
- English-only PDF output.
- Exclude supporting document lists and consent forms from the application PDF.
- Omit applicant-facing rubric text; include only form field data.
- No masking for SIN or registration number.
- Omit signatures.
- Render multi-selects as checkbox grids (dense layout).
- Minimal header with logo only; omit footer.
- Letter page size.
- Include only the Application Overview "Reference #" in the header.
- Include applicant name and application received date in the header.
- Use the Application Overview "Received At" value for the received date.
- Include all fields from the paper application form (including email).
- Show blanks for unanswered fields.
- Include a confidentiality label on the PDF.
- Render legal indigenous identity as a checkbox group (checked/unchecked).
- No specific font requirements beyond dense/readable.
- Use paper-form section headings; digital-only fields may be omitted.
- Omit digital-only fields (no "Additional fields" section).
- Allow multi-page output; keep layout dense.
- Follow paper-form section order.

## Planning Notes
- Field mapping (paper form → answer keys):
- Header: Reference # = `submission_snapshot.reference_number`/`tracking_id`, Name = `first-name` + `middle-names` + `last-name`, Received At = `application.created_at`.
- Applicant details: SIN `social-insurance-number`; Title (not captured → blank); DOB `dob`; Gender checkboxes from `gender_identity` (female vs gender diverse); Indigenous group from `legal-indigenous-identity`; Registration number from `sfn-/nsfn-/metis-/inuit-registration-number`; Home community `home-comminuty`.
- Contact info: Address fields `address-street-address`, `address-city`, `address-province`, `address-postcode`, `address-mailing-address`; phones `telephone-day`, `telephone-alt`; email `contact-email-address`.
- Emergency contact: `emergency-contact-name`, `emergency-contact-telephone`, `emergency-contact-relationship`.
- Demographics: Visible minority `visible-minority`; Preferred language `preferred-language`; Marital status `marital-status`; Spouse name `spouses-name`; Dependent children `dependent-children` + `ages-of-children`; Disability `has-disability` + `disability-description`; Social assistance `social-assistance` + `top-up-amount`.
- Education & labour: Labour force `labour-force-status`; Education list from `highest-education` (single selection checked); Year completed `education-year`; Education location `education-location`.
- Employment goals/barriers: `long-term-goal`; barriers `barriers` + `other-barrier`.
- Training program: `target-program` (single selection checked).
- Supports: `requested-supports` + `other-requested-support`; Childcare requested derived from `requested-supports` includes `childcare`; Childcare funding status `childcare-fuding-status` (include Not applicable if childcare not requested).
- Other funding sources: map to `loan-grant` + `loan-grant-details` (closest available fields).
- Financial overview fields (digital finance → answer keys):
- Income amounts: `income-employment`, `income-spousal`, `income-social-assist`, `income-child-support`, `income-child-benefit`, `income-jordans`, `income-band-funding`, `income-alimony`, `income-other-description` (amount).
- Expense amounts: `expenses-rent`, `expenses-groceries`, `expenses-electricity`, `expenses-heating`, `expenses-water`, `expenses-sewerage`, `expenses-garbage`, `expenses_bus_pass`, `expenses-parking`, `expenses-other-total`.
- Other income sources: `income-other` (text).
- Other expenses list: `expenses-other-list` (text).
- Transport categories: `expenses-transport` (bus pass, parking, mileage) + mileage value `expenses_transport_mileage`.
- Student loan/grant flag + details: `loan-grant` + `loan-grant-details`.
- Social assistance status + top-up: `social-assistance` + `top-up-amount`.
- Childcare funding status: `childcare-fuding-status` (include Not applicable when childcare not requested).

## Implementation Notes
- Added `tmp_application_form_template.html` and server-side application PDF helpers (`generateApplicationFormPdfBuffer`, `buildApplicationFormPdfFields`, `storeApplicationFormPdfDocument`).
- Wired application PDF generation into assessment submission when status moves to `pending_approval`.
- Uses `application_form` document category and archives prior active application_form docs per application.
- Added `tmp_financial_overview_template.html` and server-side financial overview PDF helpers (`generateFinancialOverviewPdfBuffer`, `buildFinancialOverviewPdfFields`, `storeFinancialOverviewPdfDocument`).
- Wired financial overview PDF generation into assessment submission when status moves to `pending_approval`.
- Uses `financial_overview` document category and archives prior active financial_overview docs per application.
