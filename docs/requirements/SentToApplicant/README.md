Purpose: Capture requirements and examples for forms sent to applicants for completion/signature (EFT/Wire, consent, funding agreement) to inform the intake-workflow-based document signing design.
Audience: Product, engineering.
Last Updated: 2026-06-18

## Example forms (current state: PDFs sent to participants)
- EFT & Wire Transfer Direct Payment: branched flow (EFT vs Wire); collects payee details, banking/wire details; requires a void cheque upload when EFT is selected; ends with a signature.
- Client Acknowledgement of Funding Source: single-step consent with static text and one signature (timestamped).
- Client Funding Agreement: case manager fills program details, dates, funding table (tuition/materials/fees + total), living allowance table, and then participant signs; includes case manager signature on the PDF.
- Financial Overview: case manager sends either a blank editable form or an editable form pre-filled from current PATH data. The participant-facing form is limited to monthly household income fields, monthly household expense fields, the "other income/source" and "other expenses/list" text fields, and signature; staff/program context such as supports requested, top-up amount, childcare funding status, transportation category/mileage, and student loan/grant details is not collected from the participant in this form. The attestation is "I confirm these income/expense figures are accurate as of today." Pre-filled figures come from original application answers plus current Case Workspace Participant Details updates. On signature, submitted participant-entered income/expense values update the case's Participant Details layer (`iset_case.case_context_json.applicationAnswers` plus convenience fields), not the original application payload.

## Desired approach
- Author in intake workflow studio: model each form as an intake workflow (single-step or mini-workflow) using existing components (paragraphs, inputs, radios, branching, file-upload, `signature-ack`).
- Prefill + lock (post-MVP): case manager completes a prefill payload (e.g., program details, funding amounts) that is rendered read-only to the participant; participant only edits designated fields (if any) and signs.
- Branching: EFT vs Wire determines which banking sections and attachments are required.
- File upload: require void cheque upload for EFT (use existing file-upload component, size/type limits aligned to intake).
- Signatures: MVP is participant-only; post-MVP support multiple `signature-ack` components with defined roles/order (e.g., client, case manager).
- Output: immutable signed snapshot (PDF) with audit metadata and checksum; downloadable by admin and participant after completion.
- Sending UX: case manager composes a secure message and selects one or more workflows flagged as `consent-no-prefill` or `consent-cm-prefill` to attach; subject/body remain editable. Each selection creates a signing request linked to the message thread.
- Checklist tie-in: each consent workflow maps to a supporting-documents checklist item; on submission, the signed PDF is stored in the supporting documents library with the mapped doc type and the checklist item is auto-completed (signing status is the source of truth).
- Data contract (initial): message POST accepts `attachments: [{ workflow_id, due_at?, checklist_doc_type?, financial_overview_mode? }]` for consent workflows; `financial_overview_mode` is `prefill` or `blank` and defaults to `prefill`. Backend creates signing_request rows and returns them on message GET as attachments metadata.
- Current Financial Overview implementation: workflow `52` is a `consent-cm-prefill` workflow with `document_type='financial_overview'`, but the secure-message send path replaces the stored read-only authoring schema with a narrowed editable runtime schema. Sending creates a case-scoped `funding_overview_version`, withdraws unsigned prior Financial Overview signing requests for the same case, stores only participant-editable income/expense initial values in the resolved signing schema, ignores non-participant support/program fields if submitted by an old or tampered payload, and regenerates an official Financial Overview PDF with `signed` in the document name after the client submits/signs.

## Open points to decide
- Exact signer order/roles for post-MVP multi-signer agreements (client + case manager).
- Whether participants can edit any fields on case-manager-prepared agreements or only review/sign (post-MVP).
- Validation rules for banking fields (transit/account lengths, currency handling) and auto-calculation for funding totals (if we add auto-calc).
- Expiry/reminder policy for outstanding requests.
