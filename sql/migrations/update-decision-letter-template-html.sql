UPDATE step_component sc
JOIN workflow_step ws ON ws.step_id = sc.step_id
JOIN workflow w ON w.id = ws.workflow_id
SET sc.props_overrides = JSON_SET(
  sc.props_overrides,
  '$.html',
  '<div class="govuk-body">\n  <p class="govuk-body">Date: {{decision_date}}</p>\n  <p class="govuk-body">Applicant: {{applicant_name}}</p>\n  <p class="govuk-body">Tracking ID: {{tracking_id}}</p>\n\n  <hr class="govuk-section-break govuk-section-break--m govuk-section-break--visible">\n\n  <h2 class="govuk-heading-m">{{letter_title}}</h2>\n\n  <p class="govuk-body">Dear {{applicant_name}},</p>\n  <p class="govuk-body">{{decision_intro}}</p>\n  {{{decision_reason_html}}}\n\n  <!-- IF show_next_steps -->\n  <h3 class="govuk-heading-s">Next steps</h3>\n  <ul class="govuk-list govuk-list--bullet">\n    <!-- IF next_step_1 --><li>{{next_step_1}}</li><!-- END next_step_1 -->\n    <!-- IF next_step_2 --><li>{{next_step_2}}</li><!-- END next_step_2 -->\n  </ul>\n  <!-- END show_next_steps -->\n\n  <p class="govuk-body">If you have questions, send us a secure message in the portal.</p>\n\n  <p class="govuk-body">\n    Sincerely,<br>\n    {{coordinator_name}}<br>\n    {{organization_name}}\n  </p>\n</div>\n'
)
WHERE w.document_type IN ('assessment_approval_letter', 'assessment_denial_letter')
  AND sc.position = 1;
