# ILMP Schema 1.4 — Canonical “Intervention” Module Specification

This document packages the canonical field definitions and design guidance for implementing the **Interventions** section of an ISET case‑management system fully compliant with ESDC’s *Indigenous Labour Market Programs (ILMP) XML Schema 1.4*.

---

## 🧩 Canonical “Intervention” Fields (Schema 1.4)

| UI label | XML element (identifier) | Type / format | Required? | Allowed values & validation |
|---|---|---|---|---|
| **Intervention code** | `<interventionCode>` | Numeric (3) | ✅ Yes | 1–20 (see list below). At least one per Action Plan. |
| **Start date** | `<interventionStartDate>` | Date `YYYY‑MM‑DD` | ✅ Yes | ≥ 2000‑01‑01; ≥ Action Plan Start; ≤ Intervention End. |
| **End date** | `<interventionEndDate>` | Date `YYYY‑MM‑DD` | ⚙️ Conditional | Required when Action Plan has Result Date; ≥ Start; < 60 months after Start. |
| **Outcome** | `<interventionOutcome>` | Numeric (2) | ⚙️ Conditional | Required when Action Plan has Result Date; values: 1 Complete, 2 In progress, 3 Incomplete, 4 Failed to report, 5 Cancelled, 6 Rescheduled. |
| **Duration (days)** | `<interventionDuration>` | Numeric (3) | ⚙️ Conditional | Required when Action Plan has Result Date; 0–999; ≤ (Start→End). |
| **Cost (budgeted/actual)** | `<interventionCost>` | Numeric (6) integer | ⚙️ Conditional | Required when Result Date or End Date present; 0–999999; no decimals. |
| **Related NOC (if applicable)** | `<interventionRelatedNOC>` | Numeric (5) | ⚙️ Conditional | Required for codes 6–13; if Version = 2021 → 5 digits; if ≤ 2016 → 4 digits; must match valid NOC. |
| **Related NOC version** | `<interventionRelatedNOCVersion>` | Numeric (4) | ⚙️ Conditional | Required when NOC given; allowed values 2006/2011/2016/2021 …; digit‑length must match version. |
| **System comment** | `<sysComment>` | Alphanumeric (30) | Optional | Free text for metadata (e.g. creator, timestamp). |

**Intervention code list (1–20)**  
1 Career research & exploration  
2 Diagnostic assessment  
3 Employment counselling  
4 Skills dev – essential skills  
5 Skills dev – academic upgrading  
6 Work experience – Job creation partnerships  
7 Work experience – Wage subsidy  
8 Work experience – Student employment  
9 Occupational skills training – Certificate  
10 Occupational skills training – Diploma  
11 Occupational skills training – Degree  
12 Occupational skills training – Apprenticeship  
13 Occupational skills training – Vocational  
14 Self‑employment  
15 Job search preparation strategies  
16 Job starts supports  
17 Employer referral  
18 Employment retention supports  
19 Referral to agencies  
20 Pre‑career development  

### Validation notes
* **NOC gating** — only require/show NOC fields when `code ∈ {6…13}`; enforce 2021 → 5 digits, ≤ 2016 → 4.  
* **Duration / Cost gating** — triggered by `actionPlanResultDate` presence.  
* **60‑month cap** — `End Date − Start Date < 60 months`.

---

## 🔗 Action Plan Fields That Gate Interventions

| Purpose | XML element | Rule |
|---|---|---|
| Link to contribution agreement | `<agreementNumber>` | 7–9 digits (EI or CRF). |
| Chronology | `<actionPlanStartDate>` | ≥ 2000‑01‑01; < Intervention Start; < Result Date; not future. |
| Result (gating) | `<actionPlanResultCode>` / `<actionPlanResultDate>` | When Result Date set → Outcome, Duration, End Date, Cost become required. |

---

## ⚙️ Recommended Admin Configuration (Per Holder / Tenant)

- `SchemaVersion` → force `1.4` on all exports.  
- Registry of valid `agreementNumber` (EI/CRF).  
- Enum catalog for intervention codes (1–20) with enable/disable flags.  
- Default `interventionRelatedNOCVersion = 2021`; override per‑record if legacy (2016).  
- Enum list for `interventionOutcome` (1–6).  
- Global validation windows (date ≥ 2000‑01‑01; span ≤ 60 months).  

---

## 🧭 UX / Model Guidance

- Dynamic form logic: reveal NOC fields only for codes 6–13; validate digit length by version.  
- Auto‑suggest `interventionDuration` = End − Start; integer only.  
- Enforce Outcome/Cost/End Date when closing Action Plan (Result Date set).  
- Keep code lists and outcome lists as central enums; no free‑text values.

---

## 🧾 Example Valid Intervention (XML)

```xml
<intervention>
  <interventionCode>7</interventionCode>
  <interventionStartDate>2025‑04‑10</interventionStartDate>
  <interventionEndDate>2025‑06‑05</interventionEndDate>
  <interventionOutcome>1</interventionOutcome>
  <interventionDuration>38</interventionDuration>
  <interventionCost>4200</interventionCost>
  <interventionRelatedNOC>42201</interventionRelatedNOC>
  <interventionRelatedNOCVersion>2021</interventionRelatedNOCVersion>
</intervention>
```

This record is valid because Code 7 ⇒ NOC required; Version 2021 ⇒ 5 digits; End ≤ 60 months after Start; integer Cost; Outcome present.

---

## 🧩 Cross‑Reference: Standard Data File (2019)

Use the “ILMP Standard Data File” as a plain‑English dictionary for tooltips and help text (e.g. intervention type definitions, NOC usage rules, education field descriptions).

---

## ✅ Implementation Summary

If you enforce these fields and rules, your Interventions module will export valid ILMP Schema 1.4 records for ESDC submission. `interventionCost` is the bridge to your financial subsystem; budgets and roll‑ups live outside the schema.

---
