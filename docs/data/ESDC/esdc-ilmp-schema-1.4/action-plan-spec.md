
# ILMP 1.4 – Action Plan Specification

This file contains a clean, LLM-friendly Markdown extract of the **Action Plan** section of the ILMP / ALMP 1.4 Data Exchange Guide.

---

## 4. Action Plan

Contains data about the client’s action plan and the associated interventions.

- **XML Schema:** `actionPlanType`

---

## 4.1 Agreement Number

Agreement number (EI or CRF).

- **XML Schema:** `agreementNumber`
- **Format:** Numeric (9)
- **Mandatory:** Yes

**Validation Rules:**
- Must be a valid EI or CRF agreement number.
- Must be between 7 and 9 digits in length.

---

## 4.2 Education Level

Highest level of education attained at the time of creation of the Action Plan.

- **XML Schema:** `educationLevel`
- **Format:** Numeric (2)
- **Mandatory:** No

**Validation Rule:**
Must be one of:
1. No formal education  
2. Up to grade 7–8  
3. Grade 9–10  
4. Grade 11–12  
5. Secondary school diploma or GED  
6. Some post-secondary training  
7. Apprenticeship / trades / vocational diploma  
8. College / CEGEP / non‑university diploma  
9. University certificate or diploma  
10. Bachelor degree  
11. Master’s degree  
12. Doctorate  

---

## 4.3 Education Province

Province where the highest education level was attained.

- **XML Schema:** `educationProvince`
- **Format:** Numeric (2)
- **Mandatory:** No

**Validation Rule:** Must be one of:
1. Newfoundland and Labrador  
2. Nova Scotia  
3. New Brunswick  
4. Prince Edward Island  
5. Quebec  
6. Ontario  
7. Manitoba  
8. Saskatchewan  
9. Alberta  
10. Northwest Territories  
11. British Columbia  
12. Yukon  
14. Outside Canada  
16. Nunavut  

---

## 4.4 Social Assistance Recipient

- **XML Schema:** `socialAssistanceRecipient`
- **Format:** Numeric (1)
- **Mandatory:** Yes

**Allowed Values:**
- 0 = No  
- 1 = Yes  

---

## 4.5 Employment Insurance Claimant

Type of EI claimant at Action Plan start.

- **XML Schema:** `EIClaimant`
- **Format:** Numeric (1)
- **Mandatory:** Yes

**Allowed Values:**
1. Employment insurance claimant  
2. Reach‑back / former claimant  
3. Non‑insured client  

---

## 4.6 Barriers to Employment

One or more barriers may be selected.

- **XML Schema:** `barrierToEmployment`
- **Format:** Numeric (2)
- **Mandatory:** No

**Allowed Values:**
1. None  
2. Lack of labour force attachment  
3. Lack of work experience  
4. Lack of transportation  
5. Remoteness  
6. Language  
7. Education  
8. Economic  
9. Dependent care  
10. Lack of marketable skills  
11. Physical / emotional / mental health  
12. Other  

**Special Rule:**  
If `1 = None` is selected, no other values may be provided.

---

## 4.7 Action Plan Client Status at Intake

- **XML Schema:** `actionPlanPreviousEmployment`
- **Format:** Numeric (2)
- **Mandatory:** No

**Allowed Values:**
1. Unemployed  
2. Employed  
9. Student  

---

## 4.8 Action Plan Employed Client Details at Intake – NOC

- **XML Schema:** `actionPlanPreviousEmploymentNOC`
- **Format:** Numeric (5)
- **Mandatory:** Conditional (required when `actionPlanPreviousEmployment = 2`)

**Validation Rules:**
- 5 digits if NOC version is 2021  
- 4 digits if NOC version is 2016 or older  
- Must be a valid NOC code  

---

## 4.9 Action Plan Employed Client Details at Intake – NOC Version

- **XML Schema:** `actionPlanPreviousEmploymentNOCVersion`
- **Format:** Numeric (4)
- **Mandatory:** Conditional (required when employed)

Allowed values:
- 2006  
- 2011  
- 2016  
- 2021  

---

## 4.10 Action Plan Employed Client Details at Intake – Status

- **XML Schema:** `actionPlanPreviousEmploymentScheduleType`
- **Format:** Numeric (1)
- **Mandatory:** Conditional

**Allowed Values:**
- 1 = Full‑time  
- 2 = Part‑time  

---

## 4.11 Action Plan Start Date

- **XML Schema:** `actionPlanStartDate`
- **Format:** Date (YYYY‑MM‑DD)
- **Mandatory:** No

**Validation Rules:**
- Must be YYYY‑MM‑DD  
- Must be after 2000  
- Must be before Action Plan Result Date  
- Must be before Intervention Start Date  
- Must not be a future date  

---

## 4.12 Action Plan Result Code

- **XML Schema:** `actionPlanResultCode`
- **Format:** Numeric (1)
- **Mandatory:** Conditional (required when result date is present)

**Allowed Values:**
1. Unemployed but available for work  
2. Employed  
3. Self‑employed  
4. Returned to school  
5. Unspecified / could not be reached  
6. No longer in labour force  
7. Stay in school  
9. Ready for work  

---

## 4.13 Action Plan Result Related NOC

- **XML Schema:** `actionPlanResultRelatedNOC`
- **Format:** Numeric (5)
- **Mandatory:** Conditional (required when result code = 2)

Validation:
- 5 digits for NOC 2021  
- 4 digits for earlier NOC versions  
- Must be valid NOC  

---

## 4.14 Action Plan Result NOC Version

- **XML Schema:** `actionPlanResultRelatedNOCVersion`
- **Format:** Numeric (4)
- **Mandatory:** Conditional

Allowed:
- 2006  
- 2011  
- 2016  
- 2021  

---

## 4.15 Returned to School – Details

- **XML Schema:** `actionPlanFutureEducationLevel`
- **Format:** Numeric (2)
- **Mandatory:** Conditional (`actionPlanResultCode = 4`)

Allowed values:
- 5 = Secondary diploma / GED  
- 8 = College / CEGEP / non‑university diploma  
- 9 = University certificate / diploma  
- 10 = Bachelor degree  

---

## 4.16 Action Plan Result Education Level

- **XML Schema:** `actionPlanResultEducationLevel`
- **Format:** Numeric (2)
- **Mandatory:** Conditional

Allowed values:
1. No formal education  
2. Up to grade 7–8  
3. Grade 9–10  
4. Grade 11–12  
5. Secondary / GED  
6. Some post‑secondary  
7. Apprenticeship / trades / vocational  
8. College  
9. University certificate / diploma  
10. Bachelor  
11. Master’s  
12. Doctorate  

---

## 4.17 Action Plan Result Date

- **XML Schema:** `actionPlanResultDate`
- **Format:** Date (YYYY‑MM‑DD)
- **Mandatory:** Conditional

Validation:
- Must be >= Action Plan Start Date  
- Must be >= last Intervention End Date  
- Must not be a future date  

---

## 4.18 Childcare Need

- **XML Schema:** `actionPlanChildCareNeed`
- **Format:** Numeric (1)
- **Mandatory:** No

Allowed:
- 0 = No  
- 1 = Yes  

---

## 4.19 Childcare Funded Code

- **XML Schema:** `actionPlanChildCareFundedCode`
- **Format:** Numeric (1)
- **Mandatory:** No

Allowed values:
1. Not applicable  
2. FNICCI  
3. EI/CRF  
4. Provincial funding / subsidy  
5. No funding received  
6. Daycare space not available  
7. Assisted by family / Self‑funded  

Rules:
- If Need = 0 → Funded Code must be 1  
- If Need = 1 → Funded Code cannot be 1  

---

## 4.20 System Comment

- **XML Schema:** `sysComment`
- **Format:** Alphanumeric (30)
- **Mandatory:** No
