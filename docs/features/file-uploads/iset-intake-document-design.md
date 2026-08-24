# ISET Intake Document Collection Design
Purpose: Capture the evolving design for which artifacts the intake experience must collect (or auto-generate) to satisfy NWAC compliance checks.  
Audience: Intake product + engineering + compliance teams.  
Last Updated: 2025-11-19 (Codex)

## Canonical references
- `docs/training/compliance file list.txt` — authoritative checklist from NWAC compliance.
- `src/intakeFormSchema.json` — current fallback JSON rendered by the portal when the DB copy is missing or stale.
- Intake data model (`docs/data/documents-model.md`) — informs how uploads are stored/typed once received.

## Current intake behavior (baseline)
Step `iset-document-upload` defines the entire upload experience. Today it exposes:
- **Status/Treaty Card** and **Government ID** — always shown but optional. No dependency on form answers.
- **Letter of Acceptance** — conditionally shown but the JSON requires `target-program` to equal `Yes` *and* `skills_development`, which can never be true simultaneously, so this control never renders.
- **Applicant Pay Stubs** — shown when `income-employment > 0`.
- **Spouse Pay Stubs** — shown when `marital-status = married` and `income-spousal > 0`.
- **Band Denial Letter** — shown when `income-band-funding` is absent.
- **Band Funding Letter** — shown when `income-band-funding` exists.
- **Medical Documentation** — shown when any disability follow-up (`disability-support_yes_follow`) exists.

Gaps vs. the compliance checklist:
- EI verification package (client consent + EI eligibility) is never requested.
- Indigenous self-declaration letters for non-status applicants are not collected.
- Tuition, statement of account, and confirmation-of-enrollment documents are not tied to the “Financial Supports Requested” answers.
- Budget / living allowance worksheets, income verification beyond salary, proof of monthly expenses, social assistance confirmations, and childcare receipts are missing.
- Resume, acknowledgement forms, and release/consent artifacts rely on offline processes and are not traceable through the intake UI.

## Proposed upload matrix
The intake renderer should dynamically request a document whenever the applicant’s answers imply that the compliance checklist expects it. All uploads inherit the standard MIME whitelist (`.pdf/.jpg/.jpeg/.png/.gif/.heic`) unless otherwise noted.

### Identity & eligibility
| Document | Trigger | Notes |
| --- | --- | --- |
| Status/Treaty Card (front/back) | Always | Flip `required: true`; allow two-file upload so both sides can be captured. |
| Secondary Government ID | Always | Required for photo ID; enforce max size 3 MB. |
| Indigenous Self-Declaration & Reference Letters | `legal-indigenous-identity = first_nations_non_status` OR `registration-number` equals `N/A` | Multi-file slot so applicants can attach the signed declaration plus two letters; include hint referencing the checklist requirement. |

### Employment Insurance
| Document | Trigger | Notes |
| --- | --- | --- |
| EI Consent for Verification | EI status step = “Yes, I receive EI” OR “I expect to receive EI funding for this intervention” | Required when the applicant requests EI-funded interventions; store with its own `storageKey`. |
| EI Eligibility Verification request | Same as above | Case managers use this to forward to ESDC; ensuring both documents arrive together mirrors the checklist. |
| Authorization to Quit (if applicable) | EI status step = “I plan to leave work to attend training and need Service Canada approval” | Optional upload; remind clients it must be obtained before training starts. |

### Program enrollment & tuition
| Document | Trigger | Notes |
| --- | --- | --- |
| Letter of Acceptance | `target-program = skills_development` OR other values that imply formal training | Fix the existing contradictory conditions, optionally AND with `requested-supports` containing `tuition` or `books`. |
| Statement of Account / Tuition Breakdown | `requested-supports` contains `tuition` or `books` | Includes tuition, fees, books, equipment; mark required when tuition support is requested. |
| Confirmation of Band Funding | `income-band-funding` exists | Keep current uploader but set `required: true`. |
| Band Denial Letter | `income-band-funding` does *not* exist AND `legal-indigenous-identity` indicates First Nations | Ensures a denial doc exists when no community funding is declared. |

### Household finances (income + expenses)
| Document | Trigger | Notes |
| --- | --- | --- |
| Applicant Pay Stubs (3 months) | `income-employment > 0` | Already present; keep multiple upload enabled. |
| Spouse Pay Stubs | `marital-status = married` AND `income-spousal > 0` | Already present. |
| Social Assistance Letter | `income-social-assist > 0` | Upload from caseworker confirming benefit amount (top-up requirement). |
| Child Benefit / Child Support / Alimony Proof | Corresponding `income-*` field > 0 | Consolidate into “Other Income Proof” with dynamic hint referencing the declared income type. |
| Jordan’s Principle Confirmation | `income-jordans > 0` | Ensure documentation that the amount is approved. |
| Other Income Proof | `income-other > 0` | Applicant must describe the source (`income-other-description`) and upload evidence. |
| Monthly Budget Worksheet (ISET Financial Overview) | `requested-supports` includes `living` | Provide template link, require upload. |
| Rent / Mortgage Proof | `requested-supports` includes `living` AND `expenses-rent > 0` | Lease, mortgage statement, or landlord letter. |
| Utility Bills | `requested-supports` includes `living` AND `expenses-utilities > 0` | Accept combined PDF or multiple files. |
| Transportation Receipts | `requested-supports` includes `transportation` OR `expenses_transport` > 0 | Covers bus passes, mileage logs, parking. |
| Childcare / Dependent care receipts | `expenses-other-list` includes childcare entry OR applicant answered “Yes” to dependent care questions | Aligns with checklist call-out for dependent supports. |

### Program paperwork & acknowledgements
| Document | Trigger | Notes |
| --- | --- | --- |
| Client Application (signed) | System-generated preferred; if not feasible, allow upload before submission | Ideally produced after e-signing; confirm automation plan. |
| Client Funding Agreement | Only after approval; not part of intake submission | Leave as future automation note. |
| Client Acknowledgement of Funding Source | Capture as e-sign question; until automated, offer upload slot flagged as optional if they already have a signed copy. |
| Authorization for Release of Student Information | Trigger when `target-program` indicates formal schooling | Determine whether e-sign covers compliance; add upload placeholder otherwise. |
| Consent for use of image/video/audio | Trigger when applicant opts in | Could live under communications preferences rather than uploads. |
| Resume | Always required per checklist | Provide dedicated uploader on earlier step so case managers can review before financials. |
| Monthly Attendance Form | Applies only after living allowance disbursement; exclude from intake but note in docs that PATH program staff gather it for the Finance handoff. |

### Disability supports
| Document | Trigger | Notes |
| --- | --- | --- |
| Medical Documentation | `disability-support = Yes` AND user completes follow-up | Keep existing control but mark `required: true` so applications requesting disability support cannot be submitted without proof. |
| Specialized Equipment Quotes | When follow-up question lists equipment > $650 | Add new uploader tied to the dynamic list the applicant fills out; require at least one quote file. |

### Catch-all
| Document | Trigger | Notes |
| --- | --- | --- |
| Other Supporting Documents | Applicant selects “Other” in `requested-supports` or leaves compliance notes in a text box | Provide optional uploader with “Describe what you’re attaching” text area; helps capture edge cases without overloading the base schema. |

## EI status step design
We will add a dedicated step named **`ei-status`** immediately after `household-income` so applicants declare EI usage before selecting financial supports. Step definition:

```json
{
  "stepId": "ei-status",
  "type": "schema",
  "title": { "en": "Employment Insurance Status", "fr": "Statut d'assurance-emploi" },
  "components": [
    {
      "id": "paragraph",
      "type": "paragraph",
      "text": {
        "en": "Tell us whether you currently receive Employment Insurance (EI) benefits or expect to rely on EI funding for this application.",
        "fr": "Indiquez-nous si vous recevez actuellement des prestations d'assurance-emploi (AE) ou si vous comptez sur l'AE pour cette demande."
      },
      "class": "govuk-body"
    },
    {
      "id": "ei-status",
      "type": "radio",
      "label": {
        "en": "What best describes your Employment Insurance status?",
        "fr": "Quelle option décrit le mieux votre statut d'assurance-emploi?"
      },
      "hint": {
        "en": "EI information helps NWAC determine the correct funding stream (EI or CRF) and what documentation is required.",
        "fr": "Ces renseignements nous aident à déterminer le bon volet de financement (AE ou FCR) et les documents requis."
      },
      "class": "govuk-radios",
      "required": true,
      "storageKey": "ei-status",
      "legendClass": "govuk-fieldset__legend--m",
      "options": [
        {
          "label": {
            "en": "Yes – I currently receive EI benefits",
            "fr": "Oui – Je reçois actuellement des prestations d'AE"
          },
          "value": "receiving"
        },
        {
          "label": {
            "en": "No – I do not receive EI benefits",
            "fr": "Non – Je ne reçois pas de prestations d'AE"
          },
          "value": "not_receiving"
        },
        {
          "label": {
            "en": "I expect to rely on EI for this training (e.g., Authorization to Quit required)",
            "fr": "Je prévois utiliser l'AE pour cette formation (p. ex. autorisation de quitter requise)"
          },
          "value": "expecting"
        },
        {
          "label": {
            "en": "Unsure – I need help determining if EI applies",
            "fr": "Incertain – J'ai besoin d'aide pour savoir si l'AE s'applique"
          },
          "value": "unsure"
        }
      ],
      "normalize": "none"
    },
    {
      "id": "ei-authorization",
      "type": "checkboxes",
      "label": {
        "en": "Which EI-specific items do you have (or expect to need)?",
        "fr": "Quels éléments propres à l'AE avez-vous (ou prévoyez-vous avoir)?"
      },
      "hint": {
        "en": "Select all that apply. We will prompt you to upload the documents later in the process.",
        "fr": "Sélectionnez toutes les options applicables. Nous vous demanderons de téléverser ces documents plus tard."
      },
      "class": "govuk-checkboxes",
      "required": false,
      "storageKey": "ei-items",
      "legendClass": "govuk-fieldset__legend--s",
      "conditions": {
        "all": [
          { "ref": "ei-status", "op": "in", "value": ["receiving", "expecting"] }
        ]
      },
      "options": [
        {
          "label": {
            "en": "Signed Client Consent for EI Verification",
            "fr": "Consentement du client pour la vérification de l'AE"
          },
          "value": "consent"
        },
        {
          "label": {
            "en": "EI Eligibility Verification Form",
            "fr": "Formulaire de vérification d'admissibilité à l'AE"
          },
          "value": "eligibility"
        },
        {
          "label": {
            "en": "Authorization to Quit (Service Canada)",
            "fr": "Autorisation de quitter (Service Canada)"
          },
          "value": "authorization"
        }
      ],
      "normalize": "none"
    }
  ],
  "nextStepId": "financial-supports-requested"
}
```

This step ensures the renderer captures EI intent before the upload step. Downstream, we can drive document visibility with:
- `ei-status in {receiving, expecting}` → show required uploaders for client consent + eligibility verification.
- `ei-items` contains `authorization` → show optional upload for Authorization to Quit.
- Applicants selecting `unsure` can trigger help text or a follow-up message instructing them to contact a case manager; we can also log this state so staff can follow up.

## Automation vs. manual uploads
- **Generated downstream**: client application, acknowledgements, funding agreement, attendance forms. Action: confirm with ops whether these should be removed from the applicant-facing list or if we must capture scanned copies for legacy reasons.
- **Applicant uploads**: everything else listed above. The renderer should prevent submission while any triggered document slot is empty (unless explicitly marked optional).
- **Future idea**: deliver pre-filled PDF templates (budget worksheet, EI consent) through the applicant dashboard so they can complete and re-upload in one flow.

## Open questions / next steps
1. Should we translate all new hints before go-live, or can we launch in English-first mode?
2. Do we prefer single combined uploads (e.g., tuition statement + fees) or separate slots per cost type?
3. How do we surface template download links inside the renderer without redeploying (content management vs. hardcoded copy)?

_Maintainer: Codex (GitHub Copilot CLI agent). Update this doc whenever upload logic, compliance requirements, or automation decisions change._
