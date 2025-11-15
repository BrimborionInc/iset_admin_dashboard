START TRANSACTION;

-- step_id=98, position=1 (id 2089)
UPDATE `step_component`
   SET `template_id` = 29,
       `props_overrides` = '{\"id\": \"text-block\", \"html\": \"\", \"name\": \"text-block\", \"text\": {\"en\": \"Review your application\", \"fr\": \"Passez en revue votre demande\"}, \"classes\": \"govuk-heading-m\"}',
       `created_at` = '2025-11-15 11:10:31',
       `updated_at` = '2025-11-15 11:10:31'
 WHERE `step_id` = 98 AND `position` = 1;

-- step_id=98, position=2 (id 2090)
UPDATE `step_component`
   SET `template_id` = 29,
       `props_overrides` = '{\"id\": \"text-block-2\", \"html\": \"\", \"name\": \"text-block-2\", \"text\": {\"en\": \"This is the data you have entered.  Please take some time to review it and esure it is complete and accurate.\", \"fr\": \"Voici les données que vous avez saisies. Veuillez prendre un moment pour les revoir et vous assurer qu\'elles sont complètes et exactes.\"}, \"classes\": \"govuk-body-l\"}',
       `created_at` = '2025-11-15 11:10:31',
       `updated_at` = '2025-11-15 11:10:31'
 WHERE `step_id` = 98 AND `position` = 2;

-- step_id=98, position=3 (id 2091)
UPDATE `step_component`
   SET `template_id` = 24,
       `props_overrides` = '{\"id\": \"summary-list\", \"name\": \"summary-list\", \"classes\": \"\", \"included\": [{\"key\": \"social-insurance-number\", \"labelEn\": \"What is your Social Insurance Number (SIN)?\", \"labelFr\": \"Quel est votre numéro d\'assurance sociale (SIN) ?\", \"stepName\": \"Social Insurance Number\", \"labelOverride\": null}, {\"key\": \"first-name\", \"labelEn\": \"First Name\", \"labelFr\": \"Premier Nom\", \"stepName\": \"Name\", \"labelOverride\": null}, {\"key\": \"last-name\", \"labelEn\": \"Last Name\", \"labelFr\": \"Nom de Famille\", \"stepName\": \"Name\", \"labelOverride\": null}, {\"key\": \"middle-names\", \"labelEn\": \"Middle Name(s)\", \"labelFr\": \"Nom de milieu(s)\", \"stepName\": \"Name\", \"labelOverride\": null}, {\"key\": \"preferred-name\", \"labelEn\": \"Preferred Name (if different)\", \"labelFr\": \"Nom préféré (si différent)\", \"stepName\": \"Name\", \"labelOverride\": null}, {\"key\": \"dob\", \"labelEn\": \"What is your date of birth?\", \"labelFr\": \"Entrez la date\", \"stepName\": \"Date of Birth\", \"labelOverride\": null}, {\"key\": \"preferred-language\", \"labelEn\": \"Preferred Language\", \"labelFr\": \"Langue préférée\", \"stepName\": \"Demographics\", \"labelOverride\": null}, {\"key\": \"contact-email-address\", \"labelEn\": \"Email Address\", \"labelFr\": \"Adresse courriel\", \"stepName\": \"Contact Information\", \"labelOverride\": null}], \"hideEmpty\": true, \"workflowId\": 21, \"emptyFallback\": {\"en\": \"Not provided\", \"fr\": \"Non fourni\"}}',
       `created_at` = '2025-11-15 11:10:31',
       `updated_at` = '2025-11-15 11:10:31'
 WHERE `step_id` = 98 AND `position` = 3;

-- step_id=98, position=4 (id 2092)
UPDATE `step_component`
   SET `template_id` = 24,
       `props_overrides` = '{\"id\": \"summary-list-2\", \"name\": \"summary-list-2\", \"classes\": \"\", \"included\": [{\"key\": \"biological_sex\", \"labelEn\": \"What is your biological sex?\", \"labelFr\": \"Quel est votre sexe biologique ?\", \"stepName\": \"Gender\", \"labelOverride\": null}, {\"key\": \"gender_identity\", \"labelEn\": \"What is you gender identity?\", \"labelFr\": \"Quelle est votre identité de genre ?\", \"stepName\": \"Gender\", \"labelOverride\": null}], \"hideEmpty\": true, \"workflowId\": 21, \"emptyFallback\": {\"en\": \"Not provided\", \"fr\": \"Non fourni\"}}',
       `created_at` = '2025-11-15 11:10:31',
       `updated_at` = '2025-11-15 11:10:31'
 WHERE `step_id` = 98 AND `position` = 4;

-- step_id=98, position=5 (id 2093)
UPDATE `step_component`
   SET `template_id` = 24,
       `props_overrides` = '{\"id\": \"summary-list-3\", \"name\": \"summary-list-3\", \"classes\": \"\", \"included\": [{\"key\": \"address-street-address\", \"labelEn\": \"Street Address\", \"labelFr\": \"Adresse\", \"stepName\": \"Contact Information\", \"labelOverride\": null}, {\"key\": \"address-city\", \"labelEn\": \"City\", \"labelFr\": \"Ville\", \"stepName\": \"Contact Information\", \"labelOverride\": null}, {\"key\": \"address-province\", \"labelEn\": \"Province or Territory\", \"labelFr\": \"Province ou territoire\", \"stepName\": \"Contact Information\", \"labelOverride\": null}, {\"key\": \"address-postcode\", \"labelEn\": \"Postal Code\", \"labelFr\": \"Code postal\", \"stepName\": \"Contact Information\", \"labelOverride\": null}, {\"key\": \"telephone-day\", \"labelEn\": \"Daytime Phone Number\", \"labelFr\": \"Numéro de téléphone en journée\", \"stepName\": \"Contact Information\", \"labelOverride\": null}, {\"key\": \"telephone-alt\", \"labelEn\": \"Alternative Phone Number (optional)\", \"labelFr\": \"Numéro de téléphone alternatif (facultatif)\", \"stepName\": \"Contact Information\", \"labelOverride\": null}, {\"key\": \"address-mailing-address\", \"labelEn\": \"Mailing Address (if different)\", \"labelFr\": \"Champ multi-lignes\", \"stepName\": \"Contact Information\", \"labelOverride\": null}], \"hideEmpty\": true, \"workflowId\": 21, \"emptyFallback\": {\"en\": \"Not provided\", \"fr\": \"Non fourni\"}}',
       `created_at` = '2025-11-15 11:10:31',
       `updated_at` = '2025-11-15 11:10:31'
 WHERE `step_id` = 98 AND `position` = 5;

-- step_id=98, position=6 (id 2094)
UPDATE `step_component`
   SET `template_id` = 24,
       `props_overrides` = '{\"id\": \"summary-list-4\", \"name\": \"summary-list-4\", \"classes\": \"\", \"included\": [{\"key\": \"emergency-contact-name\", \"labelEn\": \"Emergency Contact Name\", \"labelFr\": \"Emergency Contact Name\", \"stepName\": \"Emergency Contact\", \"labelOverride\": null}, {\"key\": \"emergency-contact-telephone\", \"labelEn\": \"Emergency Contact Phone Number\", \"labelFr\": \"Emergency Contact Phone Number\", \"stepName\": \"Emergency Contact\", \"labelOverride\": null}, {\"key\": \"emergency-contact-relationship\", \"labelEn\": \"Relationship to You\", \"labelFr\": \"Relationship to You\", \"stepName\": \"Emergency Contact\", \"labelOverride\": null}], \"hideEmpty\": true, \"workflowId\": 21, \"emptyFallback\": {\"en\": \"Not provided\", \"fr\": \"Non fourni\"}}',
       `created_at` = '2025-11-15 11:10:31',
       `updated_at` = '2025-11-15 11:10:31'
 WHERE `step_id` = 98 AND `position` = 6;

-- step_id=98, position=7 (id 2095)
UPDATE `step_component`
   SET `template_id` = 24,
       `props_overrides` = '{\"id\": \"summary-list-5\", \"name\": \"summary-list-5\", \"classes\": \"\", \"included\": [{\"key\": \"example-radio\", \"labelEn\": \"Legal Indigenous Identity\", \"labelFr\": \"Legal Indigenous Identity\", \"stepName\": \"Indigenous Legal Identity\", \"labelOverride\": null}, {\"key\": \"registration-number\", \"labelEn\": \"What is your registration number?\", \"labelFr\": \"What is your registration number?\", \"stepName\": \"Registration Number\", \"labelOverride\": null}, {\"key\": \"home-comminuty\", \"labelEn\": \"What is your home community?\", \"labelFr\": \"What is your home community?\", \"stepName\": \"Home Community\", \"labelOverride\": null}], \"hideEmpty\": true, \"workflowId\": 21, \"emptyFallback\": {\"en\": \"Not provided\", \"fr\": \"Non fourni\"}}',
       `created_at` = '2025-11-15 11:10:31',
       `updated_at` = '2025-11-15 11:10:31'
 WHERE `step_id` = 98 AND `position` = 7;

-- step_id=98, position=8 (id 2096)
UPDATE `step_component`
   SET `template_id` = 24,
       `props_overrides` = '{\"id\": \"summary-list-6\", \"name\": \"summary-list-6\", \"classes\": \"\", \"included\": [{\"key\": \"visible-minority\", \"labelEn\": \"Visible Minority?\", \"labelFr\": \"Minorité visible?\", \"stepName\": \"Demographics\", \"labelOverride\": null}, {\"key\": \"marital-status\", \"labelEn\": \"Marital Status\", \"labelFr\": \"État civil\", \"stepName\": \"Demographics\", \"labelOverride\": null}, {\"key\": \"spouses-name\", \"labelEn\": \"Spouse\'s Name\", \"labelFr\": \"Nom du conjoint\", \"stepName\": \"Demographics\", \"labelOverride\": null}, {\"key\": \"dependent-children\", \"labelEn\": \"Do you have dependent children?\", \"labelFr\": \"Avez-vous des enfants à charge?\", \"stepName\": \"Demographics\", \"labelOverride\": null}, {\"key\": \"ages-of-children\", \"labelEn\": \"Ages of Children\", \"labelFr\": \"Âges des enfants\", \"stepName\": \"Demographics\", \"labelOverride\": null}, {\"key\": \"has-disability\", \"labelEn\": \"Do you consider yourself to have a disability?\", \"labelFr\": \"Est-ce que vous considérez avoir un handicap ?\", \"stepName\": \"Disability and Social Assistance\", \"labelOverride\": null}, {\"key\": \"social-assistance\", \"labelEn\": \"Are you currently receiving social assistance?\", \"labelFr\": \"Est-ce que vous recevez actuellement de l\'aide sociale ?\", \"stepName\": \"Disability and Social Assistance\", \"labelOverride\": null}, {\"key\": \"top-up-amount\", \"labelEn\": \"what is your allowable top-up amount (if applicable)\", \"labelFr\": \"Quelle est votre montant d\'allowance maximale (si applicable)\", \"stepName\": \"Disability and Social Assistance\", \"labelOverride\": null}, {\"key\": \"labour-force-status\", \"labelEn\": \"What is your current labour force status?\", \"labelFr\": \"Quel est votre statut actuel dans la population active ?\", \"stepName\": \"Labour Force and Education History\", \"labelOverride\": null}, {\"key\": \"example-radio-2\", \"labelEn\": \"What highest level of education did you complete?\", \"labelFr\": \"Quel est le niveau d’éducation le plus élevé que vous avez atteint ?\", \"stepName\": \"Labour Force and Education History\", \"labelOverride\": null}, {\"key\": \"education-year\", \"labelEn\": \"Year you completed your highest level of education\", \"labelFr\": \"Année à laquelle vous avez terminé votre plus haut niveau d’éducation\", \"stepName\": \"Labour Force and Education History\", \"labelOverride\": null}, {\"key\": \"education-location\", \"labelEn\": \"Province or territory where you completed your highest level of education\", \"labelFr\": \"Province ou territoire où vous avez terminé votre plus haut niveau d’éducation\", \"stepName\": \"Labour Force and Education History\", \"labelOverride\": null}], \"hideEmpty\": true, \"workflowId\": 21, \"emptyFallback\": {\"en\": \"Not provided\", \"fr\": \"Non fourni\"}}',
       `created_at` = '2025-11-15 11:10:31',
       `updated_at` = '2025-11-15 11:10:31'
 WHERE `step_id` = 98 AND `position` = 8;

-- step_id=98, position=9 (id 2097)
UPDATE `step_component`
   SET `template_id` = 24,
       `props_overrides` = '{\"id\": \"summary-list-7\", \"name\": \"summary-list-7\", \"classes\": \"\", \"included\": [{\"key\": \"barriers\", \"labelEn\": \"What barriers are you currently facing?\", \"labelFr\": \"Quels obstacles rencontrez-vous actuellement ?\", \"stepName\": \"Employment Goals and Barriers\", \"labelOverride\": null}, {\"key\": \"other-barrier\", \"labelEn\": \"Other barrier (please specify)\", \"labelFr\": \"Autre obstacle (veuillez préciser)\", \"stepName\": \"Employment Goals and Barriers\", \"labelOverride\": null}, {\"key\": \"target-program\", \"labelEn\": \"Have you already identified a training program or employer?\", \"labelFr\": \"Avez-vous déjà identifié un programme de formation ou un employeur ?\", \"stepName\": \"Employment Goals and Barriers\", \"labelOverride\": null}, {\"key\": \"requested-supports\", \"labelEn\": \"Which of the following supports are you requesting?\", \"labelFr\": \"Quels sont les soutiens suivants que vous demandez ?\", \"stepName\": \"Financial Supports Requested\", \"labelOverride\": null}, {\"key\": \"other-requested-support\", \"labelEn\": \"Other support (please specify)\", \"labelFr\": \"Autre soutien (veuillez préciser)\", \"stepName\": \"Financial Supports Requested\", \"labelOverride\": null}, {\"key\": \"disability-support\", \"labelEn\": \"Are you requesting support in relation to your disability?\", \"labelFr\": \"Demandez-vous un soutien en lien avec votre handicap ?\", \"stepName\": \"Financial Supports Requested\", \"labelOverride\": null}, {\"key\": \"disability-support_yes_follow\", \"labelEn\": \"Requested support\", \"labelFr\": \"Requested support\", \"stepName\": \"Financial Supports Requested\", \"labelOverride\": null}], \"hideEmpty\": true, \"workflowId\": 21, \"emptyFallback\": {\"en\": \"Not provided\", \"fr\": \"Non fourni\"}}',
       `created_at` = '2025-11-15 11:10:31',
       `updated_at` = '2025-11-15 11:10:31'
 WHERE `step_id` = 98 AND `position` = 9;

-- step_id=98, position=10 (id 2098)
UPDATE `step_component`
   SET `template_id` = 24,
       `props_overrides` = '{\"id\": \"summary-list-8\", \"name\": \"summary-list-8\", \"classes\": \"\", \"included\": [{\"key\": \"income-employment\", \"labelEn\": \"Employment Income\", \"labelFr\": \"Revenu d\'emploi\", \"stepName\": \"Household Income\", \"labelOverride\": null}, {\"key\": \"income-spousal\", \"labelEn\": \"Spousal Income\", \"labelFr\": \"Revenu du conjoint\", \"stepName\": \"Household Income\", \"labelOverride\": null}, {\"key\": \"income-social-assist\", \"labelEn\": \"Social Assistance\", \"labelFr\": \"Aide sociale\", \"stepName\": \"Household Income\", \"labelOverride\": null}, {\"key\": \"income-child-support\", \"labelEn\": \"Child Support\", \"labelFr\": \"Pension alimentaire pour enfants\", \"stepName\": \"Household Income\", \"labelOverride\": null}, {\"key\": \"income-child-benefit\", \"labelEn\": \"Child Tax Benefit\", \"labelFr\": \"Prestation fiscale pour enfants\", \"stepName\": \"Household Income\", \"labelOverride\": null}, {\"key\": \"income-jordans\", \"labelEn\": \"Jordan’s Principle\", \"labelFr\": \"Principe de Jordan\", \"stepName\": \"Household Income\", \"labelOverride\": null}, {\"key\": \"income-band-funding\", \"labelEn\": \"Band Funding\", \"labelFr\": \"Financement de la bande\", \"stepName\": \"Household Income\", \"labelOverride\": null}, {\"key\": \"income-alimony\", \"labelEn\": \"Alimony/Spousal Support\", \"labelFr\": \"Pension alimentaire/Prestation conjointe\", \"stepName\": \"Household Income\", \"labelOverride\": null}, {\"key\": \"income-other\", \"labelEn\": \"Other Income (if applicable)\", \"labelFr\": \"Autres revenus (le cas échéant)\", \"stepName\": \"Household Income\", \"labelOverride\": null}, {\"key\": \"income-other-description\", \"labelEn\": \"Other Income\", \"labelFr\": \"Autres revenus\", \"stepName\": \"Household Income\", \"labelOverride\": null}], \"hideEmpty\": true, \"workflowId\": 21, \"emptyFallback\": {\"en\": \"Not provided\", \"fr\": \"Non fourni\"}}',
       `created_at` = '2025-11-15 11:10:31',
       `updated_at` = '2025-11-15 11:10:31'
 WHERE `step_id` = 98 AND `position` = 10;

-- step_id=98, position=11 (id 2099)
UPDATE `step_component`
   SET `template_id` = 24,
       `props_overrides` = '{\"id\": \"summary-list-9\", \"name\": \"summary-list-9\", \"classes\": \"\", \"included\": [{\"key\": \"expenses-rent\", \"labelEn\": \"Rent/Mortgage\", \"labelFr\": \"Loyer/Hypothèque\", \"stepName\": \"Household Expenses\", \"labelOverride\": null}, {\"key\": \"expenses-groceries\", \"labelEn\": \"Groceries\", \"labelFr\": \"Épicerie\", \"stepName\": \"Household Expenses\", \"labelOverride\": null}, {\"key\": \"expenses-utilities\", \"labelEn\": \"Utilities (Hydro, water, natural gas, sewer, garbage)\", \"labelFr\": \"Services publics (Hydro, eau, gaz naturel, égout, poubelle)\", \"stepName\": \"Household Expenses\", \"labelOverride\": null}, {\"key\": \"expenses_transport\", \"labelEn\": \"Transport Expenses\", \"labelFr\": \"Frais de transport\", \"stepName\": \"Household Expenses\", \"labelOverride\": null}, {\"key\": \"expenses_bus_pass\", \"labelEn\": \"Bus Pass\", \"labelFr\": \"Passe d\'autobus\", \"stepName\": \"Household Expenses\", \"labelOverride\": null}, {\"key\": \"expenses-parking\", \"labelEn\": \"Parking Charges\", \"labelFr\": \"Frais de stationnement\", \"stepName\": \"Household Expenses\", \"labelOverride\": null}, {\"key\": \"expenses_transport_mileage\", \"labelEn\": \"Mileage\", \"labelFr\": \"Mileage\", \"stepName\": \"Household Expenses\", \"labelOverride\": null}, {\"key\": \"expenses-other-list\", \"labelEn\": \"Additional Training-Related Expenses\", \"labelFr\": \"Dépenses supplémentaires liées à la formation\", \"stepName\": \"Household Expenses\", \"labelOverride\": null}, {\"key\": \"example-input-5\", \"labelEn\": \"Other Expenses\", \"labelFr\": \"Autres dépenses\", \"stepName\": \"Household Expenses\", \"labelOverride\": null}], \"hideEmpty\": true, \"workflowId\": 21, \"emptyFallback\": {\"en\": \"Not provided\", \"fr\": \"Non fourni\"}}',
       `created_at` = '2025-11-15 11:10:31',
       `updated_at` = '2025-11-15 11:10:31'
 WHERE `step_id` = 98 AND `position` = 11;

COMMIT;
