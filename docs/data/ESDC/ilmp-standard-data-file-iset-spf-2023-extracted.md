# ILMP Standard Data File (ISET + SPF) 2023 — Extracted Reference

**Source file:** `ILMP Standard Data File for ISET and SPF 2023.docx`  
**Extraction date:** 2026-02-19

This Markdown is a *lossless* extraction of the Word document’s main table (**Element / Description / Validation Rule / Rationale for new Element**) plus a set of **suggested XML-friendly names** to help CODEX and PATH development.

> ⚠️ Note  
> The Word document does **not** appear to define the full ILMP submission XML hierarchy (root element, nesting, namespaces, cardinalities).  
> The “XML tag (suggested)” values below are **safe, deterministic name conversions** (human labels → XML-safe PascalCase), not official ESDC tag names.

---

## Operational notes from ESDC email thread (non-ARMS route)

These points were taken from your email conversation with ESDC (Guylaine Girouard), and are included here because they affect PATH workflow and validation.

- **Upload portal:** ESDC Data Gateway (secure upload mailbox). Upload only; users cannot download XML after sending.
- **Access:** Username + password; per Guylaine, no MFA required.
- **Uploader:** Someone in the organization or the case management system provider, with access limited to their organization profile.
- **File naming:** No naming convention (per Guylaine).
- **Size limit:** ~200 MB typical; can be higher if needed (per Guylaine).
- **Upload content strategy:** You may submit full client set each time or only new/modified records; gateway updates only new/modified data per client record (per Guylaine).
- **Validation turnaround:** Validation feedback returned ~5–10 minutes after upload; errors listed in upload history (per Guylaine).
- **Additional artifacts:** None beyond the XML coding in Data Exchange Guide Appendix B example (per Guylaine).
- **Direct system access:** ESDC will not request direct access to the case management system; evaluation is done from submitted data (per Guylaine).
- **Reporting frequency:** At least quarterly; many organizations upload monthly (per Guylaine).

### Upload schedule (minimum quarterly)

| Milestone | Due date | Period |
|---|---:|---|
| Q1 | June 30 | P03 |
| Q2 | September 30 | P06 |
| Q3 | December 31 | P09 |
| Q4 | March 31 | P12 |
| Final FY upload | June 8 |  |
| Note | ESDC allows ~2 extra months after Mar 31 for finalization |  |

---

## Element index (summary)

{summary_md}

---

## Element reference (full detail)

### Social Insurance Number

- **Suggested XML tag:** `SocialInsuranceNumber`
- **Suggested id:** `socialInsuranceNumber`
- **Inferred type:** `integer`
- **Description:** Must be a valid Social Insurance Number
- **Validation rule / error text:** The Social Insurance Number (SIN) is not valid

### Last Name

- **Suggested XML tag:** `LastName`
- **Suggested id:** `lastName`
- **Inferred type:** `string`
- **Description:** Use last name based on valid identification.
- **Validation rule / error text:** The Last Name must not only contain numbers

### Initials

- **Suggested XML tag:** `Initials`
- **Suggested id:** `initials`
- **Inferred type:** `string`
- **Description:** Initials of client’s middle name. If a client does not have an initial(s), leave this field blank.

### First Name

- **Suggested XML tag:** `FirstName`
- **Suggested id:** `firstName`
- **Inferred type:** `string`
- **Description:** Use first name based on valid identification.
- **Validation rule / error text:** The First Name must not only contain numbers

### Date of Birth

- **Suggested XML tag:** `DateOfBirth`
- **Suggested id:** `dateOfBirth`
- **Inferred type:** `date`
- **Description:** Must be within one (1) and one hundred (100) years old.
- **Validation rule / error text:** The Date of Birth must not be a date in the future / The Date of Birth must be between 1 and 100 years inclusively

### Gender

- **Suggested XML tag:** `Gender`
- **Suggested id:** `gender`
- **Inferred type:** `enum`
- **Allowed values:**
  - Male
  - Female
  - Unspecified
- **Description:** Unspecified should be used when a client is unable or does not want to identify with either male or female.

### Aboriginal Group

- **Suggested XML tag:** `AboriginalGroup`
- **Suggested id:** `aboriginalGroup`
- **Inferred type:** `enum`
- **Allowed values:**
  - Registered Indian
  - Non-status Indian
  - Métis
  - Inuit
- **Description:** Based on self-identification or as established the contribution agreement.

### Marital Status

- **Suggested XML tag:** `MaritalStatus`
- **Suggested id:** `maritalStatus`
- **Inferred type:** `enum`
- **Allowed values:**
  - Married or equivalent
  - Single
  - Divorced
  - Widowed
  - Separated
- **Description:** Specifies the client’s marital status.

### Number of Dependent Children

- **Suggested XML tag:** `NumberOfDependentChildren`
- **Suggested id:** `numberOfDependentChildren`
- **Inferred type:** `integer`
- **Description:** Number of dependent children at home aged eighteen (18) or less.
- **Validation rule / error text:** Number of dependent children at home aged eighteen (18) or less.

### Language Spoken

- **Suggested XML tag:** `LanguageSpoken`
- **Suggested id:** `languageSpoken`
- **Inferred type:** `enum`
- **Allowed values:**
  - Aboriginal language(s) only
  - English only
  - French only
  - Aboriginal language(s) and English
  - Aboriginal language(s) and French
  - English and French
  - Aboriginal language(s), English and French
  - None of the above
- **Description:** Language(s) spoken by the client.

### Disability

- **Suggested XML tag:** `Disability`
- **Suggested id:** `disability`
- **Inferred type:** `enum`
- **Allowed values:**
  - No
  - Yes
- **Description:** Based on self-identification.

### Postal Address – Street

- **Suggested XML tag:** `PostalAddressStreet`
- **Suggested id:** `postalAddressStreet`
- **Inferred type:** `string`
- **Description:** Specifies a unique location on a street, roadway, or artery within a municipality, based on identification information provided by municipal and/or officially recognized authorities. May also be a postal office box (i.e. PO Box or postal box).
If the client does not have an address, “No Address” must be used instead. Please do not input your organization’s address.

### Postal Address – City

- **Suggested XML tag:** `PostalAddressCity`
- **Suggested id:** `postalAddressCity`
- **Inferred type:** `string`
- **Description:** An area commonly recognized as constituting a town, village, city, an official municipality, or a local area that is generally deemed locally to have the status of an official municipality or reserve.

If the client does not have a city, the city of the organization may be used.

### Postal Address – Province

- **Suggested XML tag:** `PostalAddressProvince`
- **Suggested id:** `postalAddressProvince`
- **Inferred type:** `enum`
- **Allowed values:**
  - Newfoundland / Labrador
  - Nova Scotia
  - New Brunswick
  - Prince Edward Island
  - Quebec
  - Ontario
  - Manitoba
  - Saskatchewan
  - Alberta
  - British Columbia
  - Northwest Territories
  - Yukon
  - Nunavut
  - United States
  - Other country
- **Description:** The province or country of residence at the time of opening of an Action Plan.

If client does not have an address, use organization’s province.

### Postal Code

- **Suggested XML tag:** `PostalCode`
- **Suggested id:** `postalCode`
- **Inferred type:** `postalCode`
- **Description:** Specifies the client’s postal code (may be outside Canada). A code used by various postal authorities in the world (zip code in the USA) to identify a relatively small (10-1,000 people) delivery location. 

Where the client is homeless (i.e. client has no address and postal code), “No Postal Code” must be used.
- **Validation rule / error text:** The first letter of the Postal Code does not match the Province selected

### Agreement Number

- **Suggested XML tag:** `AgreementNumber`
- **Suggested id:** `agreementNumber`
- **Inferred type:** `integer`
- **Description:** Must be a valid CRF or EI agreement number.
- **Validation rule / error text:** The “Agreement Number” is not valid

### Client Status at Intake

- **Suggested XML tag:** `ClientStatusAtIntake`
- **Suggested id:** `clientStatusAtIntake`
- **Inferred type:** `enum`
- **Allowed values:**
  - Employed
  - Unemployed
  - Student
- **Rationale for new element:** Previously the definition of an eligible client was a person who was unemployed and not in full time school. 

Changes to client eligibility in ISETS and with EI Part II funds, expands that definition to include clients who are in full time school and employed. 

Reporting on the types of clients being served will be necessary to understand how the program impacts the variety of participants.

### Employed Client Details at Intake – National Occupational Code (NOC)

- **Suggested XML tag:** `EmployedClientDetailsAtIntakeNationalOccupationalCodeNOC`
- **Suggested id:** `employedClientDetailsAtIntakeNationalOccupationalCodeNOC`
- **Inferred type:** `noc`
- **Validation rule / error text:** When the Client Status at the intake is “employed”, the National Occupation Code of the current employment needs to be provided.
- **Rationale for new element:** ISETS aims to close the skills gap between Indigenous and non-Indigenous populations. Upskilling to higher level jobs can be analysed with the NOC.

### Employed Client Details at Intake – Status

- **Suggested XML tag:** `EmployedClientDetailsAtIntakeStatus`
- **Suggested id:** `employedClientDetailsAtIntakeStatus`
- **Inferred type:** `enum`
- **Allowed values:**
  - Full-time
  - Part-time
- **Validation rule / error text:** When the Client Status at the intake is “employed”, the status of the current employment needs to be provided.

### Education Level

- **Suggested XML tag:** `EducationLevel`
- **Suggested id:** `educationLevel`
- **Inferred type:** `enum`
- **Allowed values:**
  - No formal education
  - Up to Grade 7-8 (Secondaire I-II)
  - Grade 9-10 (Secondaire III)
  - Grade 11-12 (Secondaire IV-V)
  - Secondary School Diploma or GED
  - Some post-secondary training
  - Apprenticeship or trades certificate or diploma
  - College, CEGEP, or other non-university certificate or diploma
  - University certificate or diploma
  - University - Bachelor Degree
  - University - Master’s Degree
  - University - Doctorate
- **Description:** Highest level of education attained at the time of creation of Action Plan.
No formal education: did not attend school 
Up to Grade 7-8: includes primary level grades 1-6,      7 and 8 (Grade 7-8 = Sec I-II)
Grades 9-10 (Sec III)
Grade 11-12 (Sec IV-V credits, but not enough to graduate). 
High school (Sec V) diploma or equivalent (includes those recognized by the Ministère d’éducation du Québec (MEQ) and First Nation secondary school diploma (as these are often recognized by CEGEPS for enrolment, but not by the MEQ).
Some post-secondary training: client attended post-secondary training but did not complete a program.
Apprenticeship and journeyman cards (trades certificate) or vocational training diploma (DEP- diplômes d’études professionnelles) work related safety cards and other trade certifications.
College, CEGEP, or other non-university certificate or diploma
College refers to a technical, applied arts, or applied science school. These are post-secondary institutions granting certificates, diplomas and associate's degree.
CEGEP includes: 
A 2 year Diploma of College Studies (DCS) that are pre-university diploma programs that may not be used to secure employment
A 3 year Diploma of College Studies (DCS) that are technical training certificates that can secure employment; 
Attestation of College Studies (ACS) is similar to a DCS, but more technical with a duration of 6 months to one year or a specific number of training hours for each program
other non-university certificate or diploma 
University certificate or diploma below bachelor level (includes credited and non-credited geared to support/compliment/validate current employment)

### Social Assistance Recipient

- **Suggested XML tag:** `SocialAssistanceRecipient`
- **Suggested id:** `socialAssistanceRecipient`
- **Inferred type:** `enum`
- **Allowed values:**
  - No
  - Yes
- **Description:** Is the client a Social Assistance Recipient at the time of the creation of the Action Plan?

### Employment Insurance Claimant

- **Suggested XML tag:** `EmploymentInsuranceClaimant`
- **Suggested id:** `employmentInsuranceClaimant`
- **Inferred type:** `enum`
- **Allowed values:**
  - Employment insurance claimant
  - Reach-back client/former claimant
  - Non-insured client
- **Description:** Type of Employment Insurance Claimant when starting the Action Plan.

### Barriers to employment – choose all that apply

- **Suggested XML tag:** `BarriersToEmploymentChooseAllThatApply`
- **Suggested id:** `barriersToEmploymentChooseAllThatApply`
- **Inferred type:** `enum[]`
- **Allowed values:** (multi-select)
  - None
  - Lack of labour force attachment
  - Lack of work experience
  - Lack of transportation
  - Remoteness
  - Language
  - Education
  - Economic
  - Dependent care
  - Lack of marketable skills
  - Physical or mental health
  - Other barrier not listed above
- **Description:** A barrier to employment can be lack of work experience or transportation, physical or mental health issues, no access to care for children or family member, etc.

None: Client does not have barrier to employment.
Lack of labour force attachment: a client who has been out of the job market for more than 3 years.
Lack of work experience: Client has little or no work experience
Lack of transportation: Client who does not have access to any type of transportation to get to their place of employment or to a counsellor.
Remoteness: Client lives in a remote area that has little or no access to job opportunities or no suitable jobs locally.
Language: Client lacks fluency in the language required for the local job market.
Education: Client who has insufficient education (i.e. less than high school).
Economic: Client does not have financial resources to purchase required equipment (boots, uniforms); costs for relocation, etc., needed to obtain employment.
Dependent care: Client does not have access to care for children or family member.
Lack of marketable skills: As a result of a shift in labour market demand, the client does not have the required marketable skills (i.e. IT innovation).
Client has a physical or mental health barrier
Other barrier not listed above: Client who identifies a barrier not provided in the list.
- **Validation rule / error text:** If “Barriers to Employment” is "None" then no other barriers must be selected

### Action Plan Start Date

- **Suggested XML tag:** `ActionPlanStartDate`
- **Suggested id:** `actionPlanStartDate`
- **Inferred type:** `date`
- **Description:** Start date of Action Plan.

A client shall not have more than one active Action Plan at a time. In order to have a new Action Plan, an Action Plan Result Date of the previous Action Plan must be provided. 

Please do not change the Action Plan Start Date on a client Action Plan after an upload has been completed at the Data Gateway.  HRSDC uses the client SIN, Action Plan Start Date, and Agreement Number to validate program results.  By changing the Action Plan Start Date, the client file will be rejected.
- **Validation rule / error text:** The “Action Plan Start Date” must not be a date in the future / The “Action Plan Start Date” must not be before year 2000 / The “Action Plan Start Date” must be before the “Action Plan Result Date” / The “Action Plan Start Date” must be before the “Intervention Start Date”

### Action Plan Result Date

- **Suggested XML tag:** `ActionPlanResultDate`
- **Suggested id:** `actionPlanResultDate`
- **Inferred type:** `date`
- **Description:** End date of Action Plan. Date when the final outcome of the Action Plan was reached. Current Action Plan Result Date must have a value in order to start another Action Plan.
- **Validation rule / error text:** The “Action Plan Result Date” must not be a date in the future / The “Action Plan Result Date” must not be before the “Action Plan Start Date” / An “Action Plan Result Date” is required when the “Action Plan Result Code” is provided

### Action Plan Result

- **Suggested XML tag:** `ActionPlanResult`
- **Suggested id:** `actionPlanResult`
- **Inferred type:** `enum`
- **Allowed values:**
  - Unemployed but available for work
  - Employed
  - Self-Employed
  - Returned to School
  - Unspecified – client could not be reached
  - No longer in labour force
  - Stay in School
  - Ready for Work
- **Description:** Final result of the Action Plan. The result is the final outcome of the Action Plan.
Unemployed but available for work: clients who may not have completed interventions and need more interventions before ready to fully participate in the labour market in their chosen career path, some skills and work experience. 
Employed
Self-Employed
Return to School: geared towards those that did not complete secondary/post-secondary education – activities that encourage to pursue longer-term education certificates, diplomas, degrees.
Unspecified – unable to reach client: Client cannot be reached by telephone or by other means.
No longer in labour force: Client may be deceased, incarcerated, no longer actively searching for work.
Stay in School: geared towards youth enrolled in secondary education – allows activities/incentives for youth to keep enrolled in education, continue along the employment continuum without breaks/periods where no engaged in education/employment.
Ready for work: Client has completed all of the interventions and he/she ready to go on the labour market, but did not found a job at the end of the action plan.
- **Rationale for new element:** Expanded Action Plan Results speaks to successful interventions that result in youth staying in school or others may successfully complete their training but not find work. Skills gained are still a success.

### Details on the Employed Result - National Occupation Code (NOC)

- **Suggested XML tag:** `DetailsOnTheEmployedResultNationalOccupationCodeNOC`
- **Suggested id:** `detailsOnTheEmployedResultNationalOccupationCodeNOC`
- **Inferred type:** `noc`
- **Validation rule / error text:** When a client finds a job at the end of the action plan, the National Occupation Code of the employment needs to be provided.
- **Rationale for new element:** Knowing this closes a gap in understanding what sorts of jobs people find.

### Details on the Return to School Result

- **Suggested XML tag:** `DetailsOnTheReturnToSchoolResult`
- **Suggested id:** `detailsOnTheReturnToSchoolResult`
- **Inferred type:** `enum`
- **Allowed values:**
  - Secondary school diploma or GED
  - College, CEGEP, or other non-university certificate or diploma
  - University certificate or diploma
  - University - Bachelor degree
- **Validation rule / error text:** When a client returns to school at the end of the action plan, the type of school that the client is going back to needs to be provided.
- **Rationale for new element:** Knowing this closes a gap in understanding what type of school participant move on to. Key to this is that the client goes for further studies without the financial support of the ISETS.

### Highest Level of Education on Exit

- **Suggested XML tag:** `HighestLevelOfEducationOnExit`
- **Suggested id:** `highestLevelOfEducationOnExit`
- **Inferred type:** `enum`
- **Allowed values:**
  - No formal education
  - Up to Grade 7-8 (Secondaire I-II)
  - Grade 9-10 (Secondaire III)
  - Grade 11-12 (Secondaire IV-V)
  - Secondary School Diploma or GED
  - Some post-secondary training
  - Apprenticeship or trades certificate or diploma
  - College, CEGEP, or other non-university certificate or diploma
  - University certificate or diploma
  - University - Bachelor Degree
  - University - Master’s Degree
  - University – Doctorate
- **Description:** Provide the highest level of education of the client after completing the action plan.
- **Rationale for new element:** Success for ISETS extends beyond the client finding a job or returning to school. Up grading of education levels will be supported in ISETS and changes in education credentials is also seen as a measure of success.

### Intervention Code

- **Suggested XML tag:** `InterventionCode`
- **Suggested id:** `interventionCode`
- **Inferred type:** `enum`
- **Allowed values:**
  - Career Research and Exploration
  - Diagnostic Assessment
  - Employment Counselling
  - Skills Development - Essential Skills
  - Skills Development - Academic Upgrading
  - Work Experience - Job Creation Partnerships
  - Work Experience - Wage Subsidy
  - Work Experience - Student Employment
  - Occupational Skills Training - Certificate
  - Occupational Skills Training - Diploma
  - Occupational Skills Training - Degree
  - Occupational Skills Training - Apprenticeship
  - Occupational Skills Training - Vocational / Industry Recognized
  - Self-employment
  - Job Search Preparation Strategies
  - Job Starts Supports
  - Employer Referral
  - Employment Retention Supports
  - Referral to Agencies
  - Pre-Career Development
- **Description:** See Attached

20. Pre-Career Development 

Developmental activity or activities engaged by a client that moves the client along towards being ready, willing and able to work. Activities under this intervention include, but are not limited to: language, life skills, cultural awareness etc.
- **Rationale for new element:** A 20th intervention expands the range of services and supports that give credit to the agreement holder that have been missing from the reporting in the past.

### Intervention Start Date

- **Suggested XML tag:** `InterventionStartDate`
- **Suggested id:** `interventionStartDate`
- **Inferred type:** `date`
- **Description:** Start date of the intervention. An Action Plan must have at least one (1) intervention.
- **Validation rule / error text:** The “Intervention Start Date” must not be before year 2000 / The “Intervention Start Date” must not be before the “Action Plan Start Date” / The “Intervention Start Date” must not be after the “Intervention End Date”

### Intervention End Date

- **Suggested XML tag:** `InterventionEndDate`
- **Suggested id:** `interventionEndDate`
- **Inferred type:** `date`
- **Description:** End date of the intervention. An Action Plan must have at least one (1) Intervention. It may contain many interventions.
- **Validation rule / error text:** The “Intervention End Date” must not be later than the "Action Plan Result Date”

### Intervention Outcome

- **Suggested XML tag:** `InterventionOutcome`
- **Suggested id:** `interventionOutcome`
- **Inferred type:** `enum`
- **Allowed values:**
  - Completed
  - In progress
  - Incomplete
  - Failed to report
  - Cancelled
  - Rescheduled
- **Description:** Outcome of Intervention.
- **Validation rule / error text:** When the “Action Plan Result Date” is provided the “Intervention Outcome” is required

### Intervention Related National Occupation Code

- **Suggested XML tag:** `InterventionRelatedNationalOccupationCode`
- **Suggested id:** `interventionRelatedNationalOccupationCode`
- **Inferred type:** `noc`
- **Description:** National Occupation Code related to training or work experience based interventions.

Applicable to:
6 - Work Experience - Job Creation Partnerships 
7 - Work Experience - Wage Subsidy
8 - Work Experience - Student Employment
9 - Occupational Skills Training - Certificate
10 - Occupational Skills Training - Diploma
11 - Occupational Skills Training - Degree
12 - Occupational Skills Training - Apprenticeship
13 - Occupational Skills Training - Vocational
- **Validation rule / error text:** When the “Intervention Code” is 6 to 13 the “Intervention Related NOC” is required / The “Intervention Related NOC” must be a valid NOC
- **Rationale for new element:** The following intervention was removed from the list. 

4 – Skills Development – Essential Skills

As mentioned at the National Data Workshop, the NOC should not be required for the Essential skills intervention. Most of these interventions are not related to a specific occupation.
