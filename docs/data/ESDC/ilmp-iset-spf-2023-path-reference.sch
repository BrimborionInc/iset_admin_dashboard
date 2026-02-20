<?xml version="1.0" encoding="UTF-8"?>
<!--
  PATH ILMP reference Schematron (DRAFT)
  Derived from: ILMP Standard Data File for ISET and SPF 2023.docx

  IMPORTANT: This is a reference ruleset for PATH development, not an official ESDC validator.
-->
<sch:schema xmlns:sch="http://purl.oclc.org/dsdl/schematron"
            xmlns:xs="http://www.w3.org/2001/XMLSchema"
            xmlns:p="urn:awentech:path:ilmp:iset-spf:2023"
            queryBinding="xslt2">
  <sch:title>PATH ILMP (ISET+SPF) 2023 — Reference Validation Rules</sch:title>

  <sch:pattern id="action-plan-rules">
    <sch:rule context="p:ActionPlan">
      <sch:assert test="xs:date(p:ActionPlanStartDate) ge xs:date('2000-01-01')">
        The “Action Plan Start Date” must not be before year 2000.
      </sch:assert>
      <sch:assert test="not(exists(p:ActionPlanResultDate)) or xs:date(p:ActionPlanStartDate) lt xs:date(p:ActionPlanResultDate)">
        The “Action Plan Start Date” must be before the “Action Plan Result Date”.
      </sch:assert>
      <sch:assert test="not(exists(p:ActionPlanResult)) or exists(p:ActionPlanResultDate)">
        An “Action Plan Result Date” is required when the “Action Plan Result Code” is provided.
      </sch:assert>
      <sch:assert test="not(exists(p:ActionPlanResultDate)) or xs:date(p:ActionPlanResultDate) ge xs:date(p:ActionPlanStartDate)">
        The “Action Plan Result Date” must not be before the “Action Plan Start Date”.
      </sch:assert>
      <sch:assert test="not(exists(p:Interventions/p:Intervention/p:InterventionStartDate)) or xs:date(p:ActionPlanStartDate) le min(for $d in p:Interventions/p:Intervention/p:InterventionStartDate return xs:date($d))">
        The “Action Plan Start Date” must be before the “Intervention Start Date”.
      </sch:assert>
      <sch:assert test="exists(p:Interventions/p:Intervention)">
        An Action Plan must have at least one (1) intervention.
      </sch:assert>
    </sch:rule>
  </sch:pattern>

  <sch:pattern id="intake-rules">
    <sch:rule context="p:ActionPlan">
      <sch:assert test="not(p:ClientStatusAtIntake = 'Employed') or normalize-space(p:EmployedClientDetailsAtIntake/p:NationalOccupationalCodeNOC) != ''">
        When the Client Status at the intake is “employed”, the National Occupation Code of the current employment needs to be provided.
      </sch:assert>
      <sch:assert test="not(p:ClientStatusAtIntake = 'Employed') or normalize-space(p:EmployedClientDetailsAtIntake/p:Status) != ''">
        When the Client Status at the intake is “employed”, the status of the current employment needs to be provided.
      </sch:assert>
    </sch:rule>
  </sch:pattern>

  <sch:pattern id="result-rules">
    <sch:rule context="p:ActionPlan">
      <sch:assert test="not(p:ActionPlanResult = 'Employed') or normalize-space(p:ActionPlanResultDetails/p:EmployedResultNOC) != ''">
        When a client finds a job at the end of the action plan, the National Occupation Code (NOC) of the employment needs to be provided.
      </sch:assert>
    </sch:rule>
  </sch:pattern>

  <sch:pattern id="intervention-rules">
    <sch:rule context="p:Intervention">
      <sch:assert test="xs:date(p:InterventionStartDate) ge xs:date('2000-01-01')">
        The “Intervention Start Date” must not be before year 2000.
      </sch:assert>
      <sch:assert test="not(exists(p:InterventionEndDate)) or xs:date(p:InterventionStartDate) le xs:date(p:InterventionEndDate)">
        The “Intervention Start Date” must not be after the “Intervention End Date”.
      </sch:assert>
      <sch:assert test="xs:date(p:InterventionStartDate) ge xs:date(../p:ActionPlanStartDate)">
        The “Intervention Start Date” must not be before the “Action Plan Start Date”.
      </sch:assert>
      <sch:assert test="not(exists(p:InterventionEndDate) and exists(../p:ActionPlanResultDate)) or xs:date(p:InterventionEndDate) le xs:date(../p:ActionPlanResultDate)">
        The “Intervention End Date” must not be later than the "Action Plan Result Date”.
      </sch:assert>
      <sch:assert test="not(exists(../p:ActionPlanResultDate)) or normalize-space(p:InterventionOutcome) != ''">
        When the “Action Plan Result Date” is provided the “Intervention Outcome” is required.
      </sch:assert>
      <sch:assert test="not(p:InterventionCode = 'Work Experience - Job Creation Partnerships' or p:InterventionCode = 'Work Experience - Wage Subsidy' or p:InterventionCode = 'Work Experience - Student Employment' or p:InterventionCode = 'Occupational Skills Training - Certificate' or p:InterventionCode = 'Occupational Skills Training - Diploma' or p:InterventionCode = 'Occupational Skills Training - Degree' or p:InterventionCode = 'Occupational Skills Training - Apprenticeship' or p:InterventionCode = 'Occupational Skills Training - Vocational / Industry Recognized') or normalize-space(p:InterventionRelatedNationalOccupationCode) != ''">
        When the “Intervention Code” is 6 to 13 the “Intervention Related NOC” is required (work experience and training-related interventions).
      </sch:assert>
    </sch:rule>
  </sch:pattern>

  <sch:pattern id="barriers-rules">
    <sch:rule context="p:BarriersToEmployment">
      <sch:assert test="not(p:Barrier = 'None' and count(p:Barrier) gt 1)">
        If “Barriers to Employment” is "None" then no other barriers must be selected.
      </sch:assert>
    </sch:rule>
  </sch:pattern>

  <sch:pattern id="postalcode-province">
    <sch:rule context="p:Client">
      <sch:let name="prov" value="normalize-space(p:PostalAddress/p:PostalAddressProvince)"/>
      <sch:let name="pcRaw" value="upper-case(normalize-space(p:PostalAddress/p:PostalCode))"/>
      <sch:let name="pc" value="replace($pcRaw, '\s', '')"/>
      <sch:let name="first" value="substring($pc, 1, 1)"/>
      <sch:assert test="not(exists($prov)) or not(exists($pc)) or $pc = '' or $pcRaw = 'NO POSTAL CODE' or $prov = 'United States' or $prov = 'Other country' or (($prov = 'Newfoundland / Labrador' and ($first = 'A')) or ($prov = 'Nova Scotia' and ($first = 'B')) or ($prov = 'Prince Edward Island' and ($first = 'C')) or ($prov = 'New Brunswick' and ($first = 'E')) or ($prov = 'Quebec' and ($first = 'G' or $first = 'H' or $first = 'J')) or ($prov = 'Ontario' and ($first = 'K' or $first = 'L' or $first = 'M' or $first = 'N' or $first = 'P')) or ($prov = 'Manitoba' and ($first = 'R')) or ($prov = 'Saskatchewan' and ($first = 'S')) or ($prov = 'Alberta' and ($first = 'T')) or ($prov = 'British Columbia' and ($first = 'V')) or ($prov = 'Northwest Territories' and ($first = 'X')) or ($prov = 'Nunavut' and ($first = 'X')) or ($prov = 'Yukon' and ($first = 'Y')))">
        The first letter of the Postal Code does not match the Province selected.
      </sch:assert>
    </sch:rule>
  </sch:pattern>

</sch:schema>