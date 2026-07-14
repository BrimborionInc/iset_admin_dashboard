-- DEV authoring install for the participant-facing Client Monthly Attendance Report.
-- This is workflow-authoring data, not a schema migration. Promote workflow 54 with:
--   npm run data:sync:plan -- --dataset workflow-authoring --workflow-id 54 --target-env test
-- after the release candidate receives DEV GO and TEST mutation is explicitly approved.

DELIMITER //

DROP PROCEDURE IF EXISTS install_client_monthly_attendance_workflow//
CREATE PROCEDURE install_client_monthly_attendance_workflow()
BEGIN
  IF EXISTS (
    SELECT 1 FROM workflow
     WHERE id = 54
       AND name <> 'Client Monthly Attendance Report'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'workflow id 54 is already used by another workflow';
  END IF;

  IF EXISTS (
    SELECT 1 FROM step
     WHERE id IN (161, 162, 163)
       AND name NOT IN ('Monthly Attendance Details', 'Monthly Attendance Absences', 'Monthly Attendance Declaration')
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'one of step ids 161-163 is already used by another step';
  END IF;

  INSERT INTO workflow (id, name, status, workflow_type, document_type, created_at, updated_at)
  VALUES (54, 'Client Monthly Attendance Report', 'active', 'consent-cm-prefill', 'attendance_form', NOW(), NOW())
  ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    status = VALUES(status),
    workflow_type = VALUES(workflow_type),
    document_type = VALUES(document_type),
    updated_at = NOW();

  INSERT INTO step (id, name, status, ui_meta, created_at, updated_at)
  VALUES
    (161, 'Monthly Attendance Details', 'active', NULL, NOW(), NOW()),
    (162, 'Monthly Attendance Absences', 'active', NULL, NOW(), NOW()),
    (163, 'Monthly Attendance Declaration', 'active', NULL, NOW(), NOW())
  ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    status = VALUES(status),
    ui_meta = VALUES(ui_meta),
    updated_at = NOW();

  DELETE FROM workflow_route_option WHERE workflow_id = 54;
  DELETE FROM workflow_route WHERE workflow_id = 54;
  DELETE FROM workflow_step WHERE workflow_id = 54;
  DELETE FROM step_component WHERE step_id IN (161, 162, 163);

  INSERT INTO workflow_step (workflow_id, step_id, is_start)
  VALUES (54, 161, 1), (54, 162, 0), (54, 163, 0);

  INSERT INTO workflow_route (workflow_id, source_step_id, mode, field_key, default_next_step_id)
  VALUES
    (54, 161, 'by_option', 'attendance-status', NULL),
    (54, 162, 'linear', NULL, 163);

  INSERT INTO workflow_route_option (workflow_id, source_step_id, option_value, next_step_id)
  VALUES
    (54, 161, 'full_attendance', 163),
    (54, 161, 'absences', 162);

  INSERT INTO step_component (step_id, position, template_id, props_overrides, created_at, updated_at)
  VALUES
    (161, 1, 29, JSON_OBJECT(
      'id', 'attendance-introduction',
      'name', 'attendance-introduction',
      'classes', 'govuk-body',
      'html', JSON_OBJECT(
        'en', '<p>As a client funded under the Indigenous Skills and Employment Training (ISET) program and approved for a Living Allowance while attending an educational or training institution/program, I understand that I must:</p><ul class="govuk-list govuk-list--bullet"><li>attend every mandatory class, lesson, training, or other required program event;</li><li>complete every required assignment, examination, evaluation, or other task;</li><li>where possible, actively participate in compulsory and non-compulsory events;</li><li>provide supporting documentation, such as a doctor''s note, for absences; and</li><li>immediately advise NWAC or my ISET Case Manager when I have three or more absences in one month.</li></ul>',
        'fr', '<p>En tant que cliente ou client financé dans le cadre du Programme de formation pour les compétences et l''emploi destiné aux Autochtones (FCEA) et autorisé à recevoir une allocation de subsistance pendant que je fréquente un établissement ou un programme d''enseignement ou de formation, je comprends que je dois :</p><ul class="govuk-list govuk-list--bullet"><li>assister à chaque cours, leçon, formation ou autre activité obligatoire du programme;</li><li>effectuer chaque travail, examen, évaluation ou autre tâche obligatoire;</li><li>dans la mesure du possible, participer activement aux activités obligatoires et facultatives;</li><li>fournir les documents justificatifs, comme un billet du médecin, pour mes absences; et</li><li>aviser immédiatement l''AFAC ou ma gestionnaire ou mon gestionnaire de cas FCEA lorsque j''ai trois absences ou plus au cours d''un mois.</li></ul>'
      )
    ), NOW(), NOW()),
    (161, 2, 26, JSON_OBJECT(
      'id', 'attendance-client-name', 'name', 'attendance-client-name', 'type', 'text',
      'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Client name', 'fr', 'Nom de la cliente ou du client'), 'classes', 'govuk-label--m'),
      'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Enter your full legal name.', 'fr', 'Inscrivez votre nom légal complet.')),
      'value', JSON_OBJECT('en', ''), 'autocomplete', 'name',
      'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Enter your full name.', 'fr', 'Entrez votre nom complet.'))
    ), NOW(), NOW()),
    (161, 3, 26, JSON_OBJECT(
      'id', 'attendance-institution', 'name', 'attendance-institution', 'type', 'text',
      'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Educational or training institution', 'fr', 'Établissement d''enseignement ou de formation'), 'classes', 'govuk-label--m'),
      'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Enter the name of the school or training provider you attended this month.', 'fr', 'Inscrivez le nom de l''établissement d''enseignement ou du fournisseur de formation que vous avez fréquenté ce mois-ci.')),
      'value', JSON_OBJECT('en', ''),
      'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Enter the institution.', 'fr', 'Entrez le nom de l''établissement.'))
    ), NOW(), NOW()),
    (161, 4, 26, JSON_OBJECT(
      'id', 'attendance-program-name', 'name', 'attendance-program-name', 'type', 'text',
      'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Program name', 'fr', 'Nom du programme'), 'classes', 'govuk-label--m'),
      'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Enter the name of the program or course you attended this month.', 'fr', 'Inscrivez le nom du programme ou du cours que vous avez suivi ce mois-ci.')),
      'value', JSON_OBJECT('en', ''),
      'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Enter the program name.', 'fr', 'Entrez le nom du programme.'))
    ), NOW(), NOW()),
    (161, 5, 26, JSON_OBJECT(
      'id', 'attendance-reporting-month', 'name', 'attendance-reporting-month', 'type', 'month',
      'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Attendance reporting month', 'fr', 'Mois visé par le rapport de présence'), 'classes', 'govuk-label--m'),
      'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Select the month covered by this report.', 'fr', 'Sélectionnez le mois visé par ce rapport.')),
      'value', JSON_OBJECT('en', ''),
      'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Select the reporting month.', 'fr', 'Sélectionnez le mois visé.'))
    ), NOW(), NOW()),
    (161, 6, 1, JSON_OBJECT(
      'id', 'attendance-status', 'name', 'attendance-status',
      'fieldset', JSON_OBJECT('legend', JSON_OBJECT('text', JSON_OBJECT('en', 'Attendance for this reporting month', 'fr', 'Présence pendant le mois visé'), 'classes', 'govuk-fieldset__legend--m', 'isPageHeading', false)),
      'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Select one option.', 'fr', 'Sélectionnez une option.')),
      'items', JSON_ARRAY(
        JSON_OBJECT('text', JSON_OBJECT('en', 'I attended every mandatory class, lesson, and training required under my program.', 'fr', 'J''ai assisté à chaque cours, leçon et formation obligatoire de mon programme.'), 'value', 'full_attendance'),
        JSON_OBJECT('text', JSON_OBJECT('en', 'I am reporting one or more absences.', 'fr', 'Je déclare une ou plusieurs absences.'), 'value', 'absences')
      ),
      'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Select your attendance status.', 'fr', 'Sélectionnez votre situation de présence.'))
    ), NOW(), NOW()),

    (162, 1, 29, JSON_OBJECT(
      'id', 'attendance-absence-instructions', 'name', 'attendance-absence-instructions', 'classes', 'govuk-body',
      'text', JSON_OBJECT('en', 'Record the first absence, then add another only if needed. Supporting documentation is required.', 'fr', 'Inscrivez la première absence, puis ajoutez-en une autre seulement au besoin. Les documents justificatifs sont obligatoires.')
    ), NOW(), NOW()),
    (162, 2, 26, JSON_OBJECT(
      'id', 'attendance-absence-date-1', 'name', 'attendance-absence-date-1', 'type', 'date',
      'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Absence 1 date', 'fr', 'Date de l''absence 1'), 'classes', 'govuk-label--m'),
      'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Enter a date in the reporting month.', 'fr', 'Entrez une date comprise dans le mois visé.')),
      'value', JSON_OBJECT('en', ''),
      'dateBounds', JSON_OBJECT('monthField', 'attendance-reporting-month'),
      'repeatable', JSON_OBJECT('group', 'attendance-absences', 'index', 1, 'minItems', 1, 'maxItems', 4, 'addLabel', JSON_OBJECT('en', 'Add another absence', 'fr', 'Ajouter une autre absence'), 'removeLabel', JSON_OBJECT('en', 'Remove this absence', 'fr', 'Supprimer cette absence')),
      'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Enter the first absence date.', 'fr', 'Entrez la date de la première absence.'))
    ), NOW(), NOW()),
    (162, 3, 32, JSON_OBJECT(
      'id', 'attendance-absence-reason-1', 'name', 'attendance-absence-reason-1', 'rows', 3,
      'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Reason for absence 1', 'fr', 'Raison de l''absence 1'), 'classes', 'govuk-label--m'),
      'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Briefly explain the absence.', 'fr', 'Expliquez brièvement l''absence.')),
      'value', JSON_OBJECT('en', ''),
      'repeatable', JSON_OBJECT('group', 'attendance-absences', 'index', 1, 'minItems', 1, 'maxItems', 4, 'addLabel', JSON_OBJECT('en', 'Add another absence', 'fr', 'Ajouter une autre absence'), 'removeLabel', JSON_OBJECT('en', 'Remove this absence', 'fr', 'Supprimer cette absence')),
      'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Enter the reason for the first absence.', 'fr', 'Entrez la raison de la première absence.'))
    ), NOW(), NOW()),
    (162, 4, 26, JSON_OBJECT('id', 'attendance-absence-date-2', 'name', 'attendance-absence-date-2', 'type', 'date', 'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Absence 2 date', 'fr', 'Date de l''absence 2'), 'classes', 'govuk-label--m'), 'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Enter a date in the reporting month.', 'fr', 'Entrez une date comprise dans le mois visé.')), 'value', JSON_OBJECT('en', ''), 'dateBounds', JSON_OBJECT('monthField', 'attendance-reporting-month'), 'repeatable', JSON_OBJECT('group', 'attendance-absences', 'index', 2, 'minItems', 1, 'maxItems', 4, 'addLabel', JSON_OBJECT('en', 'Add another absence', 'fr', 'Ajouter une autre absence'), 'removeLabel', JSON_OBJECT('en', 'Remove this absence', 'fr', 'Supprimer cette absence')), 'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Enter the second absence date.', 'fr', 'Entrez la date de la deuxième absence.'))), NOW(), NOW()),
    (162, 5, 32, JSON_OBJECT('id', 'attendance-absence-reason-2', 'name', 'attendance-absence-reason-2', 'rows', 3, 'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Reason for absence 2', 'fr', 'Raison de l''absence 2'), 'classes', 'govuk-label--m'), 'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Briefly explain the absence.', 'fr', 'Expliquez brièvement l''absence.')), 'value', JSON_OBJECT('en', ''), 'repeatable', JSON_OBJECT('group', 'attendance-absences', 'index', 2, 'minItems', 1, 'maxItems', 4, 'addLabel', JSON_OBJECT('en', 'Add another absence', 'fr', 'Ajouter une autre absence'), 'removeLabel', JSON_OBJECT('en', 'Remove this absence', 'fr', 'Supprimer cette absence')), 'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Enter the reason for the second absence.', 'fr', 'Entrez la raison de la deuxième absence.'))), NOW(), NOW()),
    (162, 6, 26, JSON_OBJECT('id', 'attendance-absence-date-3', 'name', 'attendance-absence-date-3', 'type', 'date', 'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Absence 3 date', 'fr', 'Date de l''absence 3'), 'classes', 'govuk-label--m'), 'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Enter a date in the reporting month.', 'fr', 'Entrez une date comprise dans le mois visé.')), 'value', JSON_OBJECT('en', ''), 'dateBounds', JSON_OBJECT('monthField', 'attendance-reporting-month'), 'repeatable', JSON_OBJECT('group', 'attendance-absences', 'index', 3, 'minItems', 1, 'maxItems', 4, 'addLabel', JSON_OBJECT('en', 'Add another absence', 'fr', 'Ajouter une autre absence'), 'removeLabel', JSON_OBJECT('en', 'Remove this absence', 'fr', 'Supprimer cette absence')), 'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Enter the third absence date.', 'fr', 'Entrez la date de la troisième absence.'))), NOW(), NOW()),
    (162, 7, 32, JSON_OBJECT('id', 'attendance-absence-reason-3', 'name', 'attendance-absence-reason-3', 'rows', 3, 'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Reason for absence 3', 'fr', 'Raison de l''absence 3'), 'classes', 'govuk-label--m'), 'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Briefly explain the absence.', 'fr', 'Expliquez brièvement l''absence.')), 'value', JSON_OBJECT('en', ''), 'repeatable', JSON_OBJECT('group', 'attendance-absences', 'index', 3, 'minItems', 1, 'maxItems', 4, 'addLabel', JSON_OBJECT('en', 'Add another absence', 'fr', 'Ajouter une autre absence'), 'removeLabel', JSON_OBJECT('en', 'Remove this absence', 'fr', 'Supprimer cette absence')), 'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Enter the reason for the third absence.', 'fr', 'Entrez la raison de la troisième absence.'))), NOW(), NOW()),
    (162, 8, 26, JSON_OBJECT('id', 'attendance-absence-date-4', 'name', 'attendance-absence-date-4', 'type', 'date', 'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Absence 4 date', 'fr', 'Date de l''absence 4'), 'classes', 'govuk-label--m'), 'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Enter a date in the reporting month.', 'fr', 'Entrez une date comprise dans le mois visé.')), 'value', JSON_OBJECT('en', ''), 'dateBounds', JSON_OBJECT('monthField', 'attendance-reporting-month'), 'repeatable', JSON_OBJECT('group', 'attendance-absences', 'index', 4, 'minItems', 1, 'maxItems', 4, 'addLabel', JSON_OBJECT('en', 'Add another absence', 'fr', 'Ajouter une autre absence'), 'removeLabel', JSON_OBJECT('en', 'Remove this absence', 'fr', 'Supprimer cette absence')), 'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Enter the fourth absence date.', 'fr', 'Entrez la date de la quatrième absence.'))), NOW(), NOW()),
    (162, 9, 32, JSON_OBJECT('id', 'attendance-absence-reason-4', 'name', 'attendance-absence-reason-4', 'rows', 3, 'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Reason for absence 4', 'fr', 'Raison de l''absence 4'), 'classes', 'govuk-label--m'), 'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Briefly explain the absence.', 'fr', 'Expliquez brièvement l''absence.')), 'value', JSON_OBJECT('en', ''), 'repeatable', JSON_OBJECT('group', 'attendance-absences', 'index', 4, 'minItems', 1, 'maxItems', 4, 'addLabel', JSON_OBJECT('en', 'Add another absence', 'fr', 'Ajouter une autre absence'), 'removeLabel', JSON_OBJECT('en', 'Remove this absence', 'fr', 'Supprimer cette absence')), 'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Enter the reason for the fourth absence.', 'fr', 'Entrez la raison de la quatrième absence.'))), NOW(), NOW()),
    (162, 10, 19, JSON_OBJECT(
      'id', 'attendance-supporting-documents', 'name', 'attendance-supporting-documents',
      'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Supporting documentation', 'fr', 'Documents justificatifs'), 'classes', 'govuk-label--m'),
      'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Upload documentation supporting the absence, such as a doctor''s note.', 'fr', 'Téléversez les documents justifiant l''absence, comme un billet du médecin.')),
      'accept', '.pdf,.jpg,.jpeg,.png,.heic,.doc,.docx', 'multiple', true, 'maxSizeMb', 10,
      'showMimeList', true, 'showMaxSize', true, 'documentType', 'medical_documentation',
      'documentLabel', JSON_OBJECT('en', 'Attendance absence supporting documentation', 'fr', 'Document justificatif d''absence'),
      'validation', JSON_OBJECT('required', true, 'rules', JSON_ARRAY(), 'requiredMessage', JSON_OBJECT('en', 'Upload supporting documentation.', 'fr', 'Téléversez un document justificatif.'))
    ), NOW(), NOW()),

    (163, 1, 29, JSON_OBJECT(
      'id', 'attendance-declaration', 'name', 'attendance-declaration', 'classes', 'govuk-inset-text',
      'text', JSON_OBJECT(
        'en', 'I declare that the information in this report is true. I understand and acknowledge that false or misleading statements or omitted information may result in immediate suspension or revocation of funding and may require repayment to Employment and Social Development Canada (ESDC) of money that I was not entitled to receive.',
        'fr', 'Je déclare que les renseignements contenus dans ce rapport sont véridiques. Je comprends et reconnais que toute déclaration fausse ou trompeuse ou toute omission de renseignements peut entraîner la suspension ou la révocation immédiate du financement et peut m''obliger à rembourser à Emploi et Développement social Canada (EDSC) les sommes auxquelles je n''avais pas droit.'
      )
    ), NOW(), NOW()),
    (163, 2, 35, JSON_OBJECT(
      'id', 'attendance-client-signature', 'name', 'attendance-client-signature', 'required', true,
      'label', JSON_OBJECT('text', JSON_OBJECT('en', 'Type your full legal name to sign', 'fr', 'Tapez votre nom légal complet pour signer'), 'classes', 'govuk-label--m'),
      'hint', JSON_OBJECT('text', JSON_OBJECT('en', 'Your submission date and time will be recorded automatically.', 'fr', 'La date et l''heure de votre soumission seront enregistrées automatiquement.')),
      'actionLabel', JSON_OBJECT('text', JSON_OBJECT('en', 'Sign report', 'fr', 'Signer le rapport')),
      'clearLabel', JSON_OBJECT('text', JSON_OBJECT('en', 'Clear', 'fr', 'Effacer')),
      'placeholder', JSON_OBJECT('text', JSON_OBJECT('en', 'First Last', 'fr', 'Prénom Nom')),
      'statusSignedText', JSON_OBJECT('text', JSON_OBJECT('en', 'Signed', 'fr', 'Signé')),
      'statusUnsignedText', JSON_OBJECT('text', JSON_OBJECT('en', 'Not signed', 'fr', 'Non signé')),
      'boxPadding', 'm', 'handwritingFont', 'cursive'
    ), NOW(), NOW());
END//

CALL install_client_monthly_attendance_workflow()//
DROP PROCEDURE install_client_monthly_attendance_workflow//

DELIMITER ;

SELECT w.id, w.name, w.status, w.workflow_type, w.document_type, COUNT(ws.step_id) AS step_count
FROM workflow w
LEFT JOIN workflow_step ws ON ws.workflow_id = w.id
WHERE w.id = 54
GROUP BY w.id, w.name, w.status, w.workflow_type, w.document_type;
