#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const WORKFLOW_ID = 21;
const APPLY = process.argv.includes('--apply');
const ARG_MAP = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--') && arg.includes('='))
    .map((arg) => {
      const idx = arg.indexOf('=');
      return [arg.slice(2, idx), arg.slice(idx + 1)];
    })
);

function i18n(en, fr) {
  return { en, fr };
}

function clone(value) {
  return structuredClone(value);
}

function ensureObject(parent, key) {
  if (!parent[key] || typeof parent[key] !== 'object' || Array.isArray(parent[key])) {
    parent[key] = {};
  }
  return parent[key];
}

function setText(props, pathParts, en, fr) {
  let cursor = props;
  for (let i = 0; i < pathParts.length - 1; i += 1) {
    cursor = ensureObject(cursor, pathParts[i]);
  }
  cursor[pathParts[pathParts.length - 1]] = i18n(en, fr);
}

function setLabel(props, en, fr) {
  const label = ensureObject(props, 'label');
  label.text = i18n(en, fr);
}

function setHint(props, en, fr) {
  const hint = ensureObject(props, 'hint');
  hint.text = i18n(en, fr);
}

function setLegend(props, en, fr) {
  const fieldset = ensureObject(props, 'fieldset');
  const legend = ensureObject(fieldset, 'legend');
  legend.text = i18n(en, fr);
}

function setValidationMessage(props, key, en, fr) {
  const validation = ensureObject(props, 'validation');
  validation[key] = i18n(en, fr);
}

function setOptionText(props, value, en, fr) {
  const item = Array.isArray(props.items) ? props.items.find((entry) => String(entry.value) === String(value)) : null;
  if (!item) throw new Error(`Missing option ${value} on ${props.name || props.id}`);
  item.text = i18n(en, fr);
}

function setOptionHint(props, value, en, fr) {
  const item = Array.isArray(props.items) ? props.items.find((entry) => String(entry.value) === String(value)) : null;
  if (!item) throw new Error(`Missing option ${value} on ${props.name || props.id}`);
  item.hint = i18n(en, fr);
}

function sectionHtml(title) {
  return `<p style="background-color: #e3e6ea !important; font-weight: 700 !important; font-size: 18px !important; text-align: center !important; padding: 14px 0 !important; margin: 28px 0 14px 0 !important;">${title}</p>\n`;
}

function setSectionHeading(props, en, fr) {
  props.html = i18n(sectionHtml(en), sectionHtml(fr));
  props.text = i18n('', '');
}

function backupPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(process.cwd(), 'tmp', 'db-backups', `workflow21-step-library-pre-trauma-copy-${stamp}.json`);
}

function mustGet(map, id) {
  const row = map.get(id);
  if (!row) throw new Error(`Missing step_component row ${id}`);
  return row;
}

async function main() {
  const config = {
    host: ARG_MAP.get('host') || process.env.DB_HOST,
    port: Number(ARG_MAP.get('port') || process.env.DB_PORT || 3306),
    user: ARG_MAP.get('user') || process.env.DB_USER,
    password: ARG_MAP.get('password') || process.env.DB_PASS,
    database: ARG_MAP.get('database') || process.env.DB_NAME,
    multipleStatements: false,
  };

  for (const key of ['host', 'user', 'password', 'database']) {
    if (!config[key]) {
      throw new Error(`Missing database setting: ${key.toUpperCase()}`);
    }
  }

  const conn = await mysql.createConnection(config);
  try {
    const [stepRows] = await conn.query(
      `SELECT s.*
       FROM workflow_step ws
       JOIN step s ON s.id = ws.step_id
       WHERE ws.workflow_id = ?
       ORDER BY ws.step_id`,
      [WORKFLOW_ID]
    );

    const [componentRows] = await conn.query(
      `SELECT sc.id,
              sc.step_id,
              s.name AS step_name,
              sc.position,
              ct.template_key,
              sc.props_overrides
       FROM workflow_step ws
       JOIN step s ON s.id = ws.step_id
       JOIN step_component sc ON sc.step_id = s.id
       JOIN component_template ct ON ct.id = sc.template_id
       WHERE ws.workflow_id = ?
       ORDER BY sc.id`,
      [WORKFLOW_ID]
    );

    fs.mkdirSync(path.join(process.cwd(), 'tmp', 'db-backups'), { recursive: true });
    const originalBackupPath = backupPath();
    fs.writeFileSync(
      originalBackupPath,
      JSON.stringify(
        {
          workflowId: WORKFLOW_ID,
          createdAt: new Date().toISOString(),
          applyRequested: APPLY,
          steps: stepRows,
          stepComponents: componentRows,
        },
        null,
        2
      )
    );

    const rowsById = new Map(componentRows.map((row) => [row.id, clone(row)]));
    const updated = new Map();

    function update(id, mutator) {
      const base = clone(mustGet(rowsById, id).props_overrides);
      mutator(base);
      updated.set(id, base);
    }

    const consentStep1Collect = {
      en: 'By signing below, you give the Native Women’s Association of Canada (NWAC) and its ISET partners permission to collect and use the information we need to review your application and decide what support you may be eligible for. This includes your Social Insurance Number (SIN), which we use to confirm your eligibility.',
      fr: 'En signant ci-dessous, vous donnez à l’Association des femmes autochtones du Canada (AFAC) et à ses partenaires ISET la permission de recueillir et d’utiliser les renseignements dont nous avons besoin pour examiner votre demande et déterminer à quels soutiens vous pourriez être admissible. Cela comprend votre numéro d’assurance sociale (NAS), que nous utilisons pour confirmer votre admissibilité.',
    };

    const consentStep1Purpose = {
      en: 'We ask only for the information needed to process your application, provide ISET services, understand program results, and report on how the program is working.',
      fr: 'Nous demandons seulement les renseignements nécessaires pour traiter votre demande, offrir les services ISET, comprendre les résultats du programme et rendre compte de son fonctionnement.',
    };

    const consentStep1Confidentiality = {
      en: 'We will keep your information confidential and protect it with reasonable security measures.',
      fr: 'Nous garderons vos renseignements confidentiels et les protégerons au moyen de mesures de sécurité raisonnables.',
    };

    const consentStep1Limits = {
      en: 'We will not use or share your personal information for other reasons unless you agree or we are required to by law. We will keep it only as long as it is needed for your application and the program.',
      fr: 'Nous n’utiliserons ni ne communiquerons vos renseignements personnels pour d’autres raisons sans votre accord, sauf si la loi nous y oblige. Nous les conserverons seulement pendant la période nécessaire pour votre demande et le programme.',
    };

    const consentCollect = {
      en: 'By signing below, you confirm that the Native Women’s Association of Canada (NWAC) and its ISET delivery partners may collect and use the personal and sensitive information needed to assess your request for ISET funding. This includes your Social Insurance Number (SIN), which is used only to confirm eligibility for ISET supports such as skills training or wage subsidies funded by Employment and Social Development Canada (ESDC).',
      fr: 'En signant ci-dessous, vous confirmez que l’Association des femmes autochtones du Canada (AFAC) et ses partenaires de prestation du programme ISET peuvent recueillir et utiliser les renseignements personnels et sensibles nécessaires pour évaluer votre demande de financement dans le cadre d’ISET. Cela comprend votre numéro d’assurance sociale (NAS), qui est utilisé uniquement pour confirmer votre admissibilité à des soutiens ISET, comme la formation professionnelle ou les subventions salariales financées par Emploi et Développement social Canada (EDSC).',
    };

    const consentLegal = {
      en: 'Your information is collected and managed under the Privacy Act (R.S.C. 1985, c. P-21), the Department of Employment and Social Development Act (S.C. 2005, c. 34), and the Access to Information Act (R.S.C. 1985, c. A-1). It is used to assess eligibility, administer ISET services, measure program results, evaluate the program, and meet reporting obligations.',
      fr: 'Vos renseignements sont recueillis et gérés en vertu de la Loi sur la protection des renseignements personnels (L.R.C. 1985, ch. P-21), de la Loi sur le ministère de l’Emploi et du Développement social (L.C. 2005, ch. 34) et de la Loi sur l’accès à l’information (L.R.C. 1985, ch. A-1). Ils servent à évaluer l’admissibilité, à administrer les services ISET, à mesurer les résultats du programme, à en évaluer l’efficacité et à répondre aux exigences de reddition de comptes.',
    };

    const consentConfidentiality = {
      en: 'NWAC and its ISET delivery partners will treat this information as confidential and use reasonable safeguards to protect it from unauthorized access, use, or disclosure.',
      fr: 'L’AFAC et ses partenaires de prestation du programme ISET traiteront ces renseignements de façon confidentielle et prendront des mesures de protection raisonnables pour prévenir tout accès, usage ou divulgation non autorisés.',
    };

    const consentLimits = {
      en: 'Your personal information will not be used or shared for other purposes unless you consent or the law requires it. It will be kept only as long as necessary for these purposes.',
      fr: 'Vos renseignements personnels ne seront pas utilisés ni communiqués à d’autres fins, sauf avec votre consentement ou si la loi l’exige. Ils seront conservés seulement pendant la durée nécessaire à ces fins.',
    };

    const indigenousProgramScope = {
      en: 'I understand that the Indigenous Skills and Employment Training (ISET) program helps increase Indigenous participation in the Canadian labour market and supports access to meaningful, sustainable employment. The program provides training and employment supports to Indigenous women in all their gender diversity in Canada, including First Nations applicants with or without status, Inuit applicants, and Métis applicants living on reserve, off reserve, in urban centres, or in rural or remote communities.',
      fr: 'Je comprends que le programme de formation et d’emploi des compétences des Autochtones (ISET) contribue à accroître la participation des Autochtones au marché du travail canadien et à soutenir l’accès à un emploi significatif et durable. Le programme offre des soutiens à la formation et à l’emploi aux femmes autochtones dans toute leur diversité de genre au Canada, y compris aux membres des Premières Nations avec ou sans statut, aux Inuit et aux Métis vivant dans une réserve, hors réserve, dans un centre urbain ou dans une communauté rurale ou éloignée.',
    };

    const indigenousEligibilityReview = {
      en: 'I understand that NWAC may review my eligibility if information about my Indigenous identity is incomplete, false, or misleading. If a review confirms that I was not eligible, funding may be paused or ended, any funding agreement may be cancelled, and ineligible funds may need to be repaid to ESDC.',
      fr: 'Je comprends que l’AFAC peut revoir mon admissibilité si les renseignements fournis au sujet de mon identité autochtone sont incomplets, faux ou trompeurs. Si une vérification confirme que je n’étais pas admissible, le financement peut être suspendu ou prendre fin, toute entente de financement peut être annulée et les fonds non admissibles peuvent devoir être remboursés à EDSC.',
    };

    update(2100, (props) => setText(props, ['text'], 'How we use your information', 'Comment nous utilisons vos renseignements'));
    update(2101, (props) => setText(props, ['text'], consentStep1Collect.en, consentStep1Collect.fr));
    update(2102, (props) => setText(props, ['text'], consentStep1Purpose.en, consentStep1Purpose.fr));
    update(2103, (props) => setText(props, ['text'], consentStep1Confidentiality.en, consentStep1Confidentiality.fr));
    update(2104, (props) => setText(props, ['text'], consentStep1Limits.en, consentStep1Limits.fr));
    update(2105, (props) => {
      setHint(
        props,
        'I have read how my information will be used and I agree to continue with my application.',
        'J’ai lu comment mes renseignements seront utilisés et j’accepte de poursuivre ma demande.'
      );
      setLabel(props, 'Type your full name to sign this consent', 'Tapez votre nom complet pour signer ce consentement');
      setText(props, ['actionLabel', 'text'], 'Sign now', 'Signer maintenant');
      setText(props, ['placeholder', 'text'], 'First name Last name', 'Prénom Nom de famille');
    });

    update(2756, (props) => setText(props, ['text'], 'Indigenous identity declaration', 'Déclaration d’identité autochtone'));
    update(2757, (props) => setText(props, ['text'], indigenousProgramScope.en, indigenousProgramScope.fr));
    update(2758, (props) => setText(props, ['text'], indigenousEligibilityReview.en, indigenousEligibilityReview.fr));
    update(2759, (props) => {
      setHint(
        props,
        'For example: Mohawks of Kahnawà:ke; Inuit of Nunatsiavut; Métis Nation of Alberta, Region 3.',
        'Par exemple : Mohawks de Kahnawà:ke; Inuit du Nunatsiavut; Nation métisse de l’Alberta, région 3.'
      );
      setLabel(props, 'My Nation, community, or treaty area', 'Ma Nation, ma communauté ou mon territoire visé par un traité');
      setValidationMessage(props, 'requiredMessage', 'Please tell us your Nation, community, or treaty area.', 'Veuillez indiquer votre Nation, votre communauté ou votre territoire visé par un traité.');
    });
    update(2760, (props) => {
      setHint(
        props,
        'I declare that I identify as an Indigenous person in Canada. For this program, Indigenous means First Nations, Inuit, or Métis.',
        'Je déclare que je m’identifie comme une personne autochtone au Canada. Pour ce programme, cela signifie être membre des Premières Nations, Inuit ou Métis.'
      );
      setLabel(props, 'Type your full name to sign this declaration', 'Tapez votre nom complet pour signer cette déclaration');
      setText(props, ['placeholder', 'text'], 'First name Last name', 'Prénom Nom de famille');
    });

    update(4328, (props) => {
      setHint(
        props,
        'We ask for your Social Insurance Number to confirm eligibility and process your application. It will only be used for that purpose and will not be shared without your consent unless required by law. Enter your 9-digit SIN (for example, 123 456 789).',
        'Nous demandons votre numéro d’assurance sociale pour confirmer votre admissibilité et traiter votre demande. Il sera utilisé uniquement à cette fin et ne sera pas communiqué sans votre consentement, sauf si la loi l’exige. Entrez votre NAS à 9 chiffres (par exemple : 123 456 789).'
      );
      setValidationMessage(props, 'requiredMessage', 'Please enter your Social Insurance Number (SIN).', 'Veuillez saisir votre numéro d’assurance sociale (NAS).');
    });

    update(3183, (props) => setText(props, ['text'], 'What name appears on your identification?', 'Quel nom figure sur vos pièces d’identité ?'));
    update(3184, (props) => setText(props, ['text'], 'Enter your full legal name as it appears on your identification documents.', 'Entrez votre nom légal complet tel qu’il figure sur vos pièces d’identité.'));
    update(3185, (props) => setLabel(props, 'First name', 'Prénom'));
    update(3186, (props) => setLabel(props, 'Last name', 'Nom de famille'));
    update(3187, (props) => {
      setLabel(props, 'Middle name(s)', 'Deuxième(s) prénom(s)');
      setHint(props, 'Optional.', 'Facultatif.');
    });
    update(3188, (props) => {
      setLabel(props, 'Preferred name (if different)', 'Prénom usuel (s’il est différent)');
      setHint(props, 'Optional.', 'Facultatif.');
    });

    update(3557, (props) => setHint(props, 'For example, 27 3 2007.', 'Par exemple : 27 3 2007.'));

    update(1656, (props) => setText(props, ['text'], 'Gender information', 'Renseignements sur le genre'));
    update(1657, (props) => setText(props, ['text'], 'These questions help us understand who the program is reaching. ISET supports Indigenous women in all their gender diversity.', 'Ces questions nous aident à comprendre qui le programme rejoint. ISET soutient les femmes autochtones dans toute leur diversité de genre.'));
    update(1658, (props) => {
      setHint(props, 'Use the sex recorded at birth, if you know it.', 'Utilisez le sexe inscrit à la naissance, si vous le connaissez.');
      setLegend(props, 'What sex were you assigned at birth?', 'Quel sexe vous a-t-on assigné à la naissance ?');
      setValidationMessage(props, 'requiredMessage', 'Please select the sex you were assigned at birth.', 'Veuillez sélectionner le sexe qui vous a été assigné à la naissance.');
      setValidationMessage(props, 'errorMessage', 'Please select the sex you were assigned at birth.', 'Veuillez sélectionner le sexe qui vous a été assigné à la naissance.');
    });
    update(1659, (props) => {
      setHint(props, 'Select the gender identity that best fits you now.', 'Sélectionnez l’identité de genre qui vous correspond le mieux actuellement.');
      setLegend(props, 'Which gender identity best describes you?', 'Quelle identité de genre vous correspond le mieux ?');
      setOptionText(props, 'female', 'Woman', 'Femme');
      setOptionText(props, 'male', 'Man', 'Homme');
      setOptionText(props, 'other', 'Another identity', 'Une autre identité');
      setValidationMessage(props, 'requiredMessage', 'Please select your gender identity.', 'Veuillez sélectionner votre identité de genre.');
    });

    update(4412, (props) => setText(props, ['text'], 'How can we reach you?', 'Comment pouvons-nous vous joindre ?'));
    update(4413, (props) => setText(props, ['text'], 'Share the best ways to reach you about your application.', 'Indiquez les meilleures façons de vous joindre au sujet de votre demande.'));
    update(4416, (props) => setHint(props, 'Select the province or territory where you live.', 'Sélectionnez la province ou le territoire où vous résidez.'));
    update(4421, (props) => {
      setLabel(props, 'Mailing address (if different)', 'Adresse postale (si elle est différente)');
      setHint(props, 'Leave this blank if it is the same as your street address.', 'Laissez ce champ vide si elle est la même que votre adresse.');
    });

    update(2267, (props) => setText(props, ['text'], 'Share the name of someone we can contact if there is an emergency or if we cannot reach you. This can be a family member, friend, partner, or another person you trust.', 'Indiquez le nom d’une personne que nous pouvons contacter en cas d’urgence ou si nous ne pouvons pas vous joindre. Il peut s’agir d’un membre de votre famille, d’un ami, d’un partenaire ou d’une autre personne de confiance.'));
    update(2268, (props) => {
      setValidationMessage(props, 'errorMessage', 'Please enter the name of your emergency contact.', 'Veuillez indiquer le nom de la personne à contacter en cas d’urgence.');
      setValidationMessage(props, 'requiredMessage', 'Please enter the name of your emergency contact.', 'Veuillez indiquer le nom de la personne à contacter en cas d’urgence.');
    });
    update(2269, (props) => {
      setValidationMessage(props, 'errorMessage', 'Please enter your emergency contact’s phone number.', 'Veuillez indiquer le numéro de téléphone de la personne à contacter en cas d’urgence.');
      setValidationMessage(props, 'requiredMessage', 'Please enter your emergency contact’s phone number.', 'Veuillez indiquer le numéro de téléphone de la personne à contacter en cas d’urgence.');
    });
    update(2270, (props) => {
      setHint(props, 'For example: parent, sibling, friend, partner, or support worker.', 'Par exemple : parent, frère ou sœur, ami(e), partenaire ou personne de soutien.');
      setValidationMessage(props, 'errorMessage', 'Please tell us how this person knows you.', 'Veuillez préciser le lien de cette personne avec vous.');
      setValidationMessage(props, 'requiredMessage', 'Please tell us how this person knows you.', 'Veuillez préciser le lien de cette personne avec vous.');
    });

    update(2271, (props) => {
      setHint(props, 'Select the option that best matches your legal status, citizenship, or enrolment for program eligibility.', 'Sélectionnez l’option qui correspond le mieux à votre statut, à votre citoyenneté ou à votre inscription pour l’admissibilité au programme.');
      setLegend(props, 'Which Indigenous identity category best describes you for this program?', 'Quelle catégorie d’identité autochtone vous décrit le mieux pour ce programme ?');
      setValidationMessage(props, 'errorMessage', 'Please select the Indigenous identity category that best describes you.', 'Veuillez sélectionner la catégorie d’identité autochtone qui vous décrit le mieux.');
      setValidationMessage(props, 'requiredMessage', 'Please select the Indigenous identity category that best describes you.', 'Veuillez sélectionner la catégorie d’identité autochtone qui vous décrit le mieux.');
    });

    update(4378, (props) => {
      setHint(props, 'This can be a status card number, a Métis citizenship number, or an Inuit enrolment or beneficiary number.', 'Il peut s’agir d’un numéro de carte de statut, d’un numéro de citoyenneté métisse ou d’un numéro d’inscription ou de bénéficiaire inuit.');
      setLegend(props, 'Do you have a status, citizenship, or enrolment number?', 'Avez-vous un numéro de statut, de citoyenneté ou d’inscription ?');
      setValidationMessage(props, 'requiredMessage', 'Please select yes or no.', 'Veuillez sélectionner oui ou non.');
    });
    update(4379, (props) => {
      setLabel(props, 'Status registration number', 'Numéro d’inscription au statut');
      setValidationMessage(props, 'requiredMessage', 'Please enter your status registration number.', 'Veuillez saisir votre numéro d’inscription au statut.');
    });
    update(4380, (props) => {
      setLabel(props, 'Community or membership number', 'Numéro de communauté ou d’adhésion');
      setValidationMessage(props, 'requiredMessage', 'Please enter your community or membership number.', 'Veuillez saisir votre numéro de communauté ou d’adhésion.');
    });
    update(4381, (props) => {
      setLabel(props, 'Métis citizenship or registration number', 'Numéro de citoyenneté ou d’inscription métis');
      setValidationMessage(props, 'requiredMessage', 'Please enter your Métis citizenship or registration number.', 'Veuillez saisir votre numéro de citoyenneté ou d’inscription métis.');
    });
    update(4382, (props) => {
      setLabel(props, 'Inuit enrolment or beneficiary number', 'Numéro d’inscription ou de bénéficiaire inuit');
      setValidationMessage(props, 'requiredMessage', 'Please enter your Inuit enrolment or beneficiary number.', 'Veuillez saisir votre numéro d’inscription ou de bénéficiaire inuit.');
    });

    update(2769, (props) => {
      setHint(props, 'If you would like, tell us the First Nation, Inuit, or Métis community you consider home.', 'Si vous le souhaitez, indiquez la Première Nation, la communauté inuit ou la communauté métisse que vous considérez comme votre communauté d’origine.');
      setLabel(props, 'What is your home community?', 'Quelle est votre communauté d’origine ?');
    });

    update(4349, (props) => setText(props, ['text'], 'Additional information', 'Renseignements complémentaires'));
    update(4350, (props) => setText(props, ['text'], 'This information helps us understand your household circumstances and support equitable access to services. We ask only for information that is relevant to your application.', 'Ces renseignements nous aident à comprendre la situation de votre ménage et à soutenir un accès équitable aux services. Nous demandons seulement l’information pertinente à votre demande.'));
    update(4351, (props) => {
      setHint(props, 'We will use this language when we contact you whenever possible.', 'Nous utiliserons cette langue lorsque nous communiquerons avec vous, dans la mesure du possible.');
      setLegend(props, 'Which language would you like us to use when we contact you?', 'Quelle langue souhaitez-vous que nous utilisions pour communiquer avec vous ?');
      setValidationMessage(props, 'requiredMessage', 'Please select a language.', 'Veuillez sélectionner une langue.');
    });
    update(4352, (props) => {
      setHint(props, 'This question is used for federal reporting only.', 'Cette question est utilisée uniquement pour la déclaration fédérale.');
      setLegend(props, 'For federal reporting, other than Indigenous identity, do you identify as a member of a visible minority group?', 'Pour la déclaration fédérale, outre l’identité autochtone, vous identifiez-vous comme membre d’un groupe de minorité visible ?');
      setValidationMessage(props, 'requiredMessage', 'Please select yes or no.', 'Veuillez sélectionner oui ou non.');
    });
    update(4353, (props) => {
      setLegend(props, 'What is your marital status?', 'Quel est votre état civil ?');
      setOptionText(props, 'married', 'Married or common-law', 'Marié(e) ou conjoint(e) de fait');
      setOptionText(props, 'single', 'Single', 'Célibataire');
      setOptionText(props, 'separated', 'Separated', 'Séparé(e)');
      setOptionText(props, 'divorced', 'Divorced', 'Divorcé(e)');
      setOptionText(props, 'widowed', 'Widowed', 'Veuf ou veuve');
      setValidationMessage(props, 'requiredMessage', 'Please select your marital status.', 'Veuillez sélectionner votre état civil.');
    });
    update(4354, (props) => {
      setLabel(props, 'Spouse or partner’s name', 'Nom du conjoint, de la conjointe ou du partenaire');
      setHint(props, 'Only complete this if it applies to you.', 'Remplissez ce champ seulement si cela s’applique à vous.');
      setValidationMessage(props, 'requiredMessage', 'Please tell us your spouse or partner’s name.', 'Veuillez indiquer le nom de votre conjoint, de votre conjointe ou de votre partenaire.');
    });
    update(4355, (props) => {
      setLegend(props, 'Do you currently have dependent children?', 'Avez-vous actuellement des enfants à charge ?');
      setValidationMessage(props, 'requiredMessage', 'Please select yes or no.', 'Veuillez sélectionner oui ou non.');
    });
    update(4356, (props) => {
      setLabel(props, 'Children’s ages', 'Âge des enfants');
      setValidationMessage(props, 'requiredMessage', 'Please tell us the ages of your children.', 'Veuillez indiquer l’âge de vos enfants.');
    });

    update(4357, (props) => setText(props, ['text'], 'Support needs and social assistance', 'Besoins de soutien et aide sociale'));
    update(4358, (props) => setText(props, ['text'], 'We ask these questions only to understand whether you may need accommodations or other supports during your plan.', 'Nous posons ces questions uniquement pour comprendre si vous pourriez avoir besoin de mesures d’adaptation ou d’autres soutiens pendant votre parcours.'));
    update(4359, (props) => setLegend(props, 'Do you identify as a person with a disability, or do you have a disability-related support need?', 'Vous identifiez-vous comme une personne en situation de handicap, ou avez-vous un besoin de soutien lié à un handicap ?'));
    update(4360, (props) => {
      setLabel(props, 'Please tell us about any disability-related support needs', 'Veuillez décrire tout besoin de soutien lié à un handicap');
      setHint(props, 'Only share what you are comfortable sharing. A short description of the support or accommodation you need is enough.', 'Indiquez seulement ce que vous êtes à l’aise de partager. Une courte description du soutien ou de la mesure d’adaptation dont vous avez besoin suffit.');
      setValidationMessage(props, 'requiredMessage', 'Please tell us about the support or accommodation you need.', 'Veuillez décrire le soutien ou la mesure d’adaptation dont vous avez besoin.');
    });
    update(4361, (props) => {
      setHint(props, 'Choose the option that best describes your situation.', 'Choisissez l’option qui décrit le mieux votre situation.');
      setLegend(props, 'Are you currently receiving social assistance or income assistance?', 'Recevez-vous actuellement de l’aide sociale ou un soutien du revenu ?');
      setValidationMessage(props, 'requiredMessage', 'Please select yes or no.', 'Veuillez sélectionner oui ou non.');
    });
    update(4362, (props) => {
      setHint(props, 'Enter the monthly amount you are allowed to receive in addition to your social assistance benefits. Leave this blank if you are unsure.', 'Entrez le montant mensuel que vous avez le droit de recevoir en plus de vos prestations d’aide sociale. Laissez ce champ vide si vous n’êtes pas certain(e).');
      setLabel(props, 'If you know it, what is your allowable top-up amount?', 'Si vous le connaissez, quel est votre montant maximal permis ?');
    });

    update(3558, (props) => setText(props, ['text'], 'Employment and education history', 'Parcours d’emploi et de formation'));
    update(3559, (props) => setText(props, ['text'], 'Tell us about your current work or study situation and the highest level of education you have completed.', 'Parlez-nous de votre situation actuelle de travail ou d’études et du plus haut niveau d’études que vous avez terminé.'));
    update(3560, (props) => {
      setLegend(props, 'What best describes your current work or study situation?', 'Quelle option décrit le mieux votre situation actuelle de travail ou d’études ?');
      setOptionText(props, 'unemployed', 'Unemployed', 'Sans emploi');
      setOptionText(props, 'underemployed', 'Underemployed', 'En sous-emploi');
      setOptionText(props, 'employed-full-time', 'Employed full-time', 'En emploi à temps plein');
      setOptionText(props, 'employed-part-time', 'Employed part-time', 'En emploi à temps partiel');
      setOptionText(props, 'employed-on-approved-leave', 'Employed on approved leave', 'En emploi, en congé autorisé');
      setOptionText(props, 'self-employed', 'Self-employed', 'Travail autonome');
      setOptionText(props, 'student', 'Student', 'Étudiant(e)');
      setOptionText(props, 'other', 'Other', 'Autre');
    });
    update(3561, (props) => setLegend(props, 'What is the highest level of education you have completed?', 'Quel est le plus haut niveau d’études que vous avez terminé ?'));
    update(3562, (props) => {
      setLabel(props, 'Year you completed your highest level of education', 'Année où vous avez terminé votre plus haut niveau d’études');
      setHint(props, 'Leave this blank if it does not apply.', 'Laissez ce champ vide si cela ne s’applique pas.');
    });
    update(3563, (props) => {
      setHint(props, 'If you completed your education outside Canada, select “Other country”.', 'Si vous avez terminé vos études à l’extérieur du Canada, sélectionnez « Autre pays ».');
      setLabel(props, 'Province, territory, or country where you completed your highest level of education', 'Province, territoire ou pays où vous avez terminé votre plus haut niveau d’études');
      setOptionText(props, 'us', 'United States', 'États-Unis');
      const other = Array.isArray(props.items) ? props.items.find((entry) => String(entry.value) === '14') : null;
      if (other) other.text = i18n('Other country', 'Autre pays');
    });

    update(1937, (props) => setText(props, ['text'], 'Employment and training goals', 'Objectifs d’emploi et de formation'));
    update(1938, (props) => setText(props, ['text'], 'Tell us about the work or training you want to pursue and any supports that may help you get there.', 'Parlez-nous du travail ou de la formation que vous souhaitez poursuivre et des soutiens qui pourraient vous aider à y parvenir.'));
    update(1939, (props) => {
      setLabel(props, 'What work or training goal would you like ISET to support?', 'Quel objectif de travail ou de formation souhaitez-vous que le programme ISET soutienne ?');
      setHint(props, 'Tell us about the goal you want to work toward.', 'Décrivez l’objectif vers lequel vous souhaitez progresser.');
    });
    update(1940, (props) => {
      setHint(props, 'Select all that apply.', 'Sélectionnez toutes les réponses qui s’appliquent.');
      setLegend(props, 'What challenges or circumstances may affect your training or employment plans right now?', 'Quels défis ou quelles circonstances peuvent avoir une incidence sur vos projets de formation ou d’emploi en ce moment ?');
      setOptionText(props, 'education', 'Education or training', 'Éducation ou formation');
      setOptionText(props, 'funding', 'Funding or finances', 'Financement ou finances');
      setOptionText(props, 'lack-of-job-opportunities', 'Limited local job opportunities', 'Possibilités d’emploi limitées dans votre région');
      setOptionText(props, 'location', 'Location or transportation', 'Lieu de résidence ou transport');
    });
    update(1941, (props) => {
      setLabel(props, 'Other challenge (please specify)', 'Autre défi (veuillez préciser)');
      setHint(props, 'Tell us about another challenge or support need.', 'Décrivez un autre défi ou besoin de soutien.');
    });
    update(1942, (props) => {
      setHint(props, 'Choose the option that best fits where you are right now.', 'Choisissez l’option qui correspond le mieux à votre situation actuelle.');
      setLegend(props, 'What kind of program or support are you interested in right now?', 'Quel type de programme ou de soutien vous intéresse en ce moment ?');
      setOptionText(props, 'jcp', 'Job Creation Partnership', 'Partenariat de création d’emplois');
      setOptionText(props, 'self_support', 'Self-employment supports', 'Soutien au travail autonome');
    });

    update(3635, (props) => setText(props, ['text'], 'Supports requested', 'Soutiens demandés'));
    update(3636, (props) => setText(props, ['text'], 'Tell us which supports would help you take part in your training or employment plan.', 'Indiquez les soutiens qui vous aideraient à participer à votre parcours de formation ou d’emploi.'));
    update(3637, (props) => {
      setHint(props, 'Select all that apply.', 'Sélectionnez toutes les réponses qui s’appliquent.');
      setLegend(props, 'Which supports are you requesting at this time?', 'Quels soutiens demandez-vous en ce moment ?');
      setOptionText(props, 'books', 'Books and program materials', 'Livres et matériel de programme');
      setOptionText(props, 'living', 'Living allowance', 'Allocation de subsistance');
    });
    update(3638, (props) => {
      setHint(props, 'Which options best describe your current childcare arrangement? Select all that apply.', 'Quelles options décrivent le mieux votre situation actuelle en matière de garde d’enfants ? Sélectionnez toutes les réponses qui s’appliquent.');
      setLegend(props, 'Current childcare arrangement', 'Situation actuelle en matière de garde d’enfants');
      setOptionText(props, 'no-funding-received', 'No childcare funding received', 'Aucun financement pour la garde d’enfants');
      setOptionText(props, 'provincial-funding-subsidy', 'Provincial funding or subsidy', 'Financement ou subvention provinciale');
      setOptionText(props, 'daycare-not-available', 'No childcare spaces available', 'Aucune place en service de garde disponible');
      setOptionText(props, 'assisted-by-family', 'Supported by family', 'Soutien de la famille');
    });
    update(3639, (props) => setLabel(props, 'Other support requested', 'Autre soutien demandé'));
    update(3640, (props) => {
      setHint(props, 'If you need disability-related supports to take part in training or education, tell us here. We may ask for medical or professional documentation later if it is needed to assess your request.', 'Si vous avez besoin de soutiens liés à un handicap pour participer à une formation ou à des études, indiquez-le ici. Nous pourrions demander plus tard une documentation médicale ou professionnelle si elle est nécessaire pour évaluer votre demande.');
      setLegend(props, 'Are you requesting disability-related supports for training or education?', 'Demandez-vous des soutiens liés à un handicap pour une formation ou des études ?');
    });
    update(3641, (props) => {
      setLabel(props, 'Disability-related support requested', 'Soutien lié à un handicap demandé');
      setHint(props, 'Tell us what support you are requesting.', 'Indiquez le soutien que vous demandez.');
      setLegend(props, 'Disability-related support requested', 'Soutien lié à un handicap demandé');
    });

    update(3579, (props) => setText(props, ['text'], 'Tell us about the monthly income available in your household. This helps us understand your financial situation and assess requested supports. We may ask for documents later to confirm amounts.', 'Indiquez le revenu mensuel disponible dans votre ménage. Cela nous aide à comprendre votre situation financière et à évaluer les soutiens demandés. Nous pourrions demander des documents plus tard pour confirmer les montants.'));
    update(3582, (props) => setLabel(props, 'Social assistance or income assistance', 'Aide sociale ou soutien du revenu'));
    update(3584, (props) => setLabel(props, 'Canada Child Benefit (CCB)', 'Allocation canadienne pour enfants (ACE)'));
    update(3585, (props) => setLabel(props, 'Jordan’s Principle support', 'Soutien lié au principe de Jordan'));
    update(3586, (props) => setLabel(props, 'Band or Nation funding', 'Financement d’une bande ou d’une Nation'));
    update(3587, (props) => setLabel(props, 'Spousal support or alimony', 'Pension alimentaire pour conjoint'));
    update(3588, (props) => {
      setLabel(props, 'Other income source (if applicable)', 'Autre source de revenus (s’il y a lieu)');
      setHint(props, 'Name the source of the income.', 'Indiquez la source du revenu.');
    });
    update(3589, (props) => setLabel(props, 'Other income amount', 'Montant des autres revenus'));

    update(4363, (props) => setText(props, ['text'], 'Household expenses', 'Dépenses du ménage'));
    update(4364, (props) => setText(props, ['text'], 'Tell us about your regular monthly household and training-related expenses. This helps us understand your financial situation and assess requested supports. We may ask for documents later to confirm amounts.', 'Indiquez vos dépenses mensuelles habituelles du ménage et liées à la formation. Cela nous aide à comprendre votre situation financière et à évaluer les soutiens demandés. Nous pourrions demander des documents plus tard pour confirmer les montants.'));
    update(4368, (props) => setHint(props, 'Include costs such as natural gas, heating oil, propane, wood, pellets, or generator fuel when it is your main heat or power source.', 'Incluez les coûts comme le gaz naturel, le mazout, le propane, le bois, les granules ou le carburant de génératrice lorsqu’il s’agit de votre principale source de chauffage ou d’énergie.'));
    update(4370, (props) => {
      setText(props, ['prefix', 'text'], '$', '$');
      setText(props, ['suffix', 'text'], 'per month', 'par mois');
    });
    update(4371, (props) => {
      setText(props, ['prefix', 'text'], '$', '$');
      setText(props, ['suffix', 'text'], 'per month', 'par mois');
    });
    update(4372, (props) => {
      setHint(props, 'Select any transportation costs related to your training or education.', 'Sélectionnez les frais de transport liés à votre formation ou à vos études.');
      setOptionText(props, 'buss_pass', 'Transit pass', 'Laissez-passer de transport en commun');
      setOptionText(props, 'parking', 'Parking at school or training site', 'Stationnement à l’école ou au lieu de formation');
      setOptionText(props, 'mileage', 'Mileage between home and school or training site', 'Kilométrage entre le domicile et l’école ou le lieu de formation');
    });
    update(4373, (props) => setHint(props, 'Monthly cost of a transit pass for school or training.', 'Coût mensuel d’un laissez-passer de transport en commun pour l’école ou la formation.'));
    update(4374, (props) => setHint(props, 'Monthly parking cost at your school or training site.', 'Coût mensuel du stationnement à votre école ou à votre lieu de formation.'));
    update(4375, (props) => {
      setHint(props, 'Estimated kilometres travelled between home and your school or training site each month.', 'Kilomètres estimatifs parcourus entre votre domicile et votre école ou lieu de formation chaque mois.');
      setLegend(props, 'Mileage', 'Kilométrage');
    });
    update(4377, (props) => setHint(props, 'Enter the monthly total for the additional training-related expenses you listed above.', 'Entrez le total mensuel des dépenses supplémentaires liées à la formation que vous avez indiquées ci-dessus.'));

    update(4301, (props) => setText(props, ['text'], 'This is the information you entered. Please review it and make any changes you want before you submit.', 'Voici les renseignements que vous avez saisis. Veuillez les revoir et apporter les changements souhaités avant de soumettre votre demande.'));
    update(4304, (props) => setSectionHeading(props, 'Contact Information', 'Coordonnées'));
    update(4306, (props) => setSectionHeading(props, 'Indigenous Identity & Community', 'Identité autochtone et communauté'));
    update(4308, (props) => setSectionHeading(props, 'Household & Additional Information', 'Ménage et renseignements complémentaires'));
    update(4310, (props) => setSectionHeading(props, 'Education & Employment Background', 'Parcours d’emploi et de formation'));
    update(4312, (props) => setSectionHeading(props, 'Goals & Requested Supports', 'Objectifs et soutiens demandés'));
    update(4314, (props) => setSectionHeading(props, 'Household Income', 'Revenu du ménage'));
    update(4316, (props) => setSectionHeading(props, 'Household Expenses', 'Dépenses du ménage'));

    const summaryLabelMap = new Map([
      ['first-name', i18n('First name', 'Prénom')],
      ['middle-names', i18n('Middle name(s)', 'Deuxième(s) prénom(s)')],
      ['last-name', i18n('Last name', 'Nom de famille')],
      ['preferred-name', i18n('Preferred name', 'Prénom usuel')],
      ['dob', i18n('Date of birth', 'Date de naissance')],
      ['biological_sex', i18n('Sex assigned at birth', 'Sexe assigné à la naissance')],
      ['gender_identity', i18n('Gender identity', 'Identité de genre')],
      ['marital-status', i18n('Marital status', 'État civil')],
      ['address-street-address', i18n('Street address', 'Adresse')],
      ['address-city', i18n('City', 'Ville')],
      ['address-province', i18n('Province or territory', 'Province ou territoire')],
      ['address-postcode', i18n('Postal code', 'Code postal')],
      ['telephone-day', i18n('Daytime phone number', 'Numéro de téléphone de jour')],
      ['contact-email-address', i18n('Email address', 'Adresse courriel')],
      ['emergency-contact-name', i18n('Emergency contact name', 'Nom de la personne à contacter en cas d’urgence')],
      ['emergency-contact-telephone', i18n('Emergency contact phone number', 'Numéro de téléphone de la personne à contacter en cas d’urgence')],
      ['emergency-contact-relationship', i18n('Relationship to you', 'Lien avec vous')],
      ['legal-indigenous-identity', i18n('Indigenous identity category', 'Catégorie d’identité autochtone')],
      ['has_reg_number', i18n('Status, citizenship, or enrolment number', 'Numéro de statut, de citoyenneté ou d’inscription')],
      ['sfn-registration-number', i18n('Status registration number', 'Numéro d’inscription au statut')],
      ['nsfn-registration-number', i18n('Community or membership number', 'Numéro de communauté ou d’adhésion')],
      ['metis-registration-number', i18n('Métis citizenship or registration number', 'Numéro de citoyenneté ou d’inscription métis')],
      ['inuit-registration-number', i18n('Inuit enrolment or beneficiary number', 'Numéro d’inscription ou de bénéficiaire inuit')],
      ['home-comminuty', i18n('Home community', 'Communauté d’origine')],
      ['visible-minority', i18n('Visible minority group', 'Groupe de minorité visible')],
      ['preferred-language', i18n('Preferred language', 'Langue souhaitée')],
      ['dependent-children', i18n('Dependent children', 'Enfants à charge')],
      ['ages-of-children', i18n('Children’s ages', 'Âge des enfants')],
      ['has-disability', i18n('Disability or disability-related support need', 'Handicap ou besoin de soutien lié à un handicap')],
      ['social-assistance', i18n('Social assistance or income assistance', 'Aide sociale ou soutien du revenu')],
      ['top-up-amount', i18n('Allowable top-up amount', 'Montant maximal permis')],
      ['labour-force-status', i18n('Current work or study situation', 'Situation actuelle de travail ou d’études')],
      ['highest-education', i18n('Highest level of education completed', 'Plus haut niveau d’études terminé')],
      ['education-year', i18n('Year highest education completed', 'Année du plus haut niveau d’études terminé')],
      ['education-location', i18n('Place where highest education was completed', 'Lieu où le plus haut niveau d’études a été terminé')],
      ['long-term-goal', i18n('Work or training goal', 'Objectif de travail ou de formation')],
      ['barriers', i18n('Current challenges', 'Défis actuels')],
      ['other-barrier', i18n('Other challenge', 'Autre défi')],
      ['target-program', i18n('Program or support of interest', 'Programme ou soutien recherché')],
      ['requested-supports', i18n('Supports requested', 'Soutiens demandés')],
      ['childcare-fuding-status', i18n('Current childcare arrangement', 'Situation actuelle en matière de garde d’enfants')],
      ['other-requested-support', i18n('Other requested support', 'Autre soutien demandé')],
      ['disability-support', i18n('Disability-related support requested', 'Soutien lié à un handicap demandé')],
      ['disability-support_yes_follow', i18n('Disability-related support details', 'Détails du soutien lié à un handicap')],
      ['loan-grant', i18n('Student loans or grants', 'Prêts ou bourses d’études')],
      ['loan-grant-details', i18n('Student loan or grant details', 'Détails des prêts ou bourses d’études')],
      ['income-employment', i18n('Employment income', 'Revenu d’emploi')],
      ['income-spousal', i18n('Spouse income', 'Revenu du conjoint')],
      ['income-social-assist', i18n('Social assistance or income assistance', 'Aide sociale ou soutien du revenu')],
      ['income-child-support', i18n('Child support', 'Pension alimentaire pour enfants')],
      ['income-child-benefit', i18n('Canada Child Benefit (CCB)', 'Allocation canadienne pour enfants (ACE)')],
      ['income-jordans', i18n('Jordan’s Principle support', 'Soutien lié au principe de Jordan')],
      ['income-band-funding', i18n('Band or Nation funding', 'Financement d’une bande ou d’une Nation')],
      ['income-alimony', i18n('Spousal support or alimony', 'Pension alimentaire pour conjoint')],
      ['income-other', i18n('Other income source', 'Autre source de revenus')],
      ['income-other-description', i18n('Other income amount', 'Montant des autres revenus')],
      ['expenses-rent', i18n('Rent or mortgage', 'Loyer ou hypothèque')],
      ['expenses-groceries', i18n('Groceries', 'Épicerie')],
      ['expenses-electricity', i18n('Electricity or hydro', 'Électricité ou hydro')],
      ['expenses-heating', i18n('Home heating', 'Chauffage du logement')],
      ['expenses-water', i18n('Water', 'Eau')],
      ['expenses-sewerage', i18n('Sewer or wastewater', 'Égouts ou eaux usées')],
      ['expenses-garbage', i18n('Waste management', 'Gestion des déchets')],
      ['expenses-transport', i18n('Transportation costs', 'Frais de transport')],
      ['expenses_bus_pass', i18n('Transit pass', 'Laissez-passer de transport en commun')],
      ['expenses-parking', i18n('Parking', 'Stationnement')],
      ['expenses_transport_mileage', i18n('Mileage', 'Kilométrage')],
      ['expenses-other-list', i18n('Additional training-related expenses', 'Dépenses supplémentaires liées à la formation')],
      ['expenses-other-total', i18n('Other expenses total', 'Total des autres dépenses')],
    ]);

    for (const summaryId of [4303, 4305, 4307, 4309, 4311, 4313, 4315, 4317]) {
      update(summaryId, (props) => {
        props.included = (props.included || []).map((row) => {
          const labels = summaryLabelMap.get(row.key);
          if (!labels) return row;
          return {
            ...row,
            labelEn: labels.en,
            labelFr: labels.fr,
          };
        });
      });
    }

    update(4383, (props) => setText(props, ['text'], 'Documents to upload', 'Documents à téléverser'));
    update(4384, (props) => setText(props, ['text'], 'Based on your answers, please upload any documents that apply to your application. You can upload scans or clear photos from your phone.', 'Selon vos réponses, veuillez téléverser tous les documents qui s’appliquent à votre demande. Vous pouvez téléverser des numérisations ou des photos claires prises avec votre téléphone.'));
    update(4385, (props) => {
      setHint(props, 'Upload a clear image of a government-issued photo ID, such as a driver’s licence, provincial or territorial ID card, or passport. If information appears on both sides, upload clear images of the front and back.', 'Téléversez une image claire d’une pièce d’identité avec photo délivrée par le gouvernement, comme un permis de conduire, une carte d’identité provinciale ou territoriale, ou un passeport. Si des renseignements figurent au recto et au verso, téléversez des images claires des deux côtés.');
      setLabel(props, 'Government-issued photo ID', 'Pièce d’identité avec photo délivrée par le gouvernement');
    });
    update(4386, (props) => {
      setHint(props, 'If you have a status, treaty, citizenship, or enrolment card, upload clear images of each side or of each page needed to confirm eligibility.', 'Si vous avez une carte de statut, de traité, de citoyenneté ou d’inscription, téléversez des images claires de chaque côté ou de chaque page nécessaires pour confirmer votre admissibilité.');
      setLabel(props, 'Status, treaty, citizenship, or enrolment card', 'Carte de statut, de traité, de citoyenneté ou d’inscription');
    });
    update(4387, (props) => {
      setHint(props, 'If you cannot provide a status, citizenship, or enrolment card or number, upload your reference letter or letters from Indigenous leadership confirming your connection to community.', 'Si vous ne pouvez pas fournir de carte ou de numéro de statut, de citoyenneté ou d’inscription, téléversez votre ou vos lettres de référence provenant d’un leadership autochtone confirmant votre lien avec votre communauté.');
      setValidationMessage(props, 'requiredMessage', 'Please upload your reference letter or letters.', 'Veuillez téléverser votre ou vos lettres de référence.');
      props.documentLabel = 'Letters of reference';
    });
    update(4388, (props) => {
      setHint(props, 'If you already have an acceptance letter or another document confirming your participation in a training program, employer placement, or project, upload it here.', 'Si vous avez déjà une lettre d’acceptation ou un autre document confirmant votre participation à un programme de formation, à un placement chez un employeur ou à un projet, téléversez-le ici.');
      setValidationMessage(props, 'requiredMessage', 'Please upload an acceptance letter or other confirmation document.', 'Veuillez téléverser une lettre d’acceptation ou un autre document de confirmation.');
    });
    update(4389, (props) => {
      setHint(props, 'If you reported employment income, please upload your pay stubs from the last 3 months.', 'Si vous avez déclaré un revenu d’emploi, veuillez téléverser vos relevés de paie des 3 derniers mois.');
      setLabel(props, 'Pay stubs (applicant)', 'Relevés de paie de la personne demandeuse');
      setValidationMessage(props, 'requiredMessage', 'Please upload your pay stubs from the last 3 months.', 'Veuillez téléverser vos relevés de paie des 3 derniers mois.');
    });
    update(4390, (props) => {
      setHint(props, 'If you reported spouse income, please upload your spouse’s pay stubs from the last 3 months.', 'Si vous avez déclaré un revenu du conjoint ou de la conjointe, veuillez téléverser les relevés de paie des 3 derniers mois.');
      setLabel(props, 'Pay stubs (spouse)', 'Relevés de paie du conjoint ou de la conjointe');
      setValidationMessage(props, 'requiredMessage', 'Please upload your spouse’s pay stubs from the last 3 months.', 'Veuillez téléverser les relevés de paie du conjoint ou de la conjointe pour les 3 derniers mois.');
    });
    update(4391, (props) => setHint(props, 'If you reported social assistance or income assistance, please upload a recent statement or benefit letter.', 'Si vous avez déclaré de l’aide sociale ou un soutien du revenu, veuillez téléverser un relevé ou une lettre de prestations récente.'));
    update(4392, (props) => setHint(props, 'If you reported child support, please upload a recent court order, agreement, or payment statement.', 'Si vous avez déclaré une pension alimentaire pour enfants, veuillez téléverser une ordonnance, une entente ou un relevé de paiement récent.'));
    update(4393, (props) => {
      setHint(props, 'If you reported Canada Child Benefit, please upload a recent Canada Child Benefit statement or notice.', 'Si vous avez déclaré l’Allocation canadienne pour enfants, veuillez téléverser un relevé ou un avis récent de l’Allocation canadienne pour enfants.');
      setLabel(props, 'Canada Child Benefit (CCB) statement', 'Relevé de l’Allocation canadienne pour enfants (ACE)');
      setValidationMessage(props, 'requiredMessage', 'Please upload a recent Canada Child Benefit (CCB) statement.', 'Veuillez téléverser un relevé récent de l’Allocation canadienne pour enfants (ACE).');
    });
    update(4394, (props) => {
      setHint(props, 'If you reported Jordan’s Principle support, please upload the approval or confirmation document.', 'Si vous avez déclaré un soutien lié au principe de Jordan, veuillez téléverser le document d’approbation ou de confirmation.');
      setValidationMessage(props, 'requiredMessage', 'Please upload your Jordan’s Principle support confirmation.', 'Veuillez téléverser votre confirmation de soutien lié au principe de Jordan.');
    });
    update(4395, (props) => setHint(props, 'If you reported spousal support or alimony, please upload the court order, agreement, or other confirmation document.', 'Si vous avez déclaré une pension alimentaire pour conjoint, veuillez téléverser l’ordonnance, l’entente ou un autre document de confirmation.'));
    update(4396, (props) => {
      setHint(props, 'If you are not receiving band or Nation funding for this plan, please upload the denial letter or other written confirmation you received.', 'Si vous ne recevez pas de financement d’une bande ou d’une Nation pour ce projet, veuillez téléverser la lettre de refus ou toute autre confirmation écrite reçue.');
      setLabel(props, 'Band or Nation funding denial letter', 'Lettre de refus de financement d’une bande ou d’une Nation');
      setValidationMessage(props, 'requiredMessage', 'Please upload the funding denial letter or other written confirmation.', 'Veuillez téléverser la lettre de refus de financement ou une autre confirmation écrite.');
    });
    update(4397, (props) => {
      setHint(props, 'If you are receiving band or Nation funding for this plan, please upload the approval or confirmation letter.', 'Si vous recevez un financement d’une bande ou d’une Nation pour ce projet, veuillez téléverser la lettre d’approbation ou de confirmation.');
      setLabel(props, 'Band or Nation funding confirmation letter', 'Lettre confirmant le financement d’une bande ou d’une Nation');
      setValidationMessage(props, 'requiredMessage', 'Please upload the funding approval or confirmation letter.', 'Veuillez téléverser la lettre d’approbation ou de confirmation du financement.');
    });
    update(4398, (props) => {
      setHint(props, 'If you are requesting disability-related support, please upload any medical or professional documentation that explains the support you need. If you are requesting specialized equipment over $650, please also upload supplier quotes.', 'Si vous demandez un soutien lié à un handicap, veuillez téléverser toute documentation médicale ou professionnelle expliquant le soutien dont vous avez besoin. Si vous demandez de l’équipement spécialisé de plus de 650 $, veuillez aussi téléverser les devis des fournisseurs.');
      setLabel(props, 'Medical or professional documentation', 'Documentation médicale ou professionnelle');
      setValidationMessage(props, 'requiredMessage', 'Please upload supporting documentation.', 'Veuillez téléverser des documents justificatifs.');
    });
    update(4399, (props) => {
      setHint(props, 'If you reported rent or mortgage costs, please upload a lease, rent agreement, mortgage statement, or similar document.', 'Si vous avez déclaré des frais de loyer ou d’hypothèque, veuillez téléverser un bail, une entente de location, un relevé hypothécaire ou un document semblable.');
      setLabel(props, 'Lease, rent agreement, or mortgage statement', 'Bail, entente de location ou relevé hypothécaire');
    });
    update(4400, (props) => {
      setHint(props, 'If you reported electricity or hydro costs, please upload bills or statements from the last 3 months.', 'Si vous avez déclaré des frais d’électricité ou d’hydro, veuillez téléverser les factures ou relevés des 3 derniers mois.');
      setLabel(props, 'Utility bills from the last 3 months', 'Factures de services publics des 3 derniers mois');
      setValidationMessage(props, 'requiredMessage', 'Please upload utility bills from the last 3 months.', 'Veuillez téléverser les factures de services publics des 3 derniers mois.');
    });
    update(4401, (props) => {
      setLabel(props, 'Resume / CV', 'Curriculum vitæ');
      setValidationMessage(props, 'requiredMessage', 'Please upload a current resume or CV.', 'Veuillez téléverser un curriculum vitæ à jour.');
      props.documentLabel = 'Resume / CV';
    });

    update(2044, (props) => setText(props, ['text'], 'Review and submit', 'Vérifier et soumettre'));
    update(2045, (props) => setText(props, ['text'], 'You are ready to submit your application. Please review the statements below and sign to confirm that the information you provided is complete and accurate to the best of your knowledge. After you submit, NWAC will receive your application and you will receive a confirmation email with next steps. You can sign back into your dashboard to check your status and contact your worker if needed.', 'Votre demande est prête à être soumise. Veuillez lire les déclarations ci-dessous et signer pour confirmer que les renseignements fournis sont complets et exacts à votre connaissance. Après la soumission, l’AFAC recevra votre demande et vous recevrez un courriel de confirmation indiquant les prochaines étapes. Vous pourrez vous reconnecter à votre tableau de bord pour vérifier l’état de votre dossier et communiquer avec votre intervenant(e) au besoin.'));
    update(2046, (props) => setText(props, ['text'], consentCollect.en, consentCollect.fr));
    update(2047, (props) => setText(props, ['text'], consentLegal.en, consentLegal.fr));
    update(2048, (props) => setText(props, ['text'], consentConfidentiality.en, consentConfidentiality.fr));
    update(2049, (props) => setText(props, ['text'], consentLimits.en, consentLimits.fr));
    update(2050, (props) => setText(props, ['text'], indigenousProgramScope.en, indigenousProgramScope.fr));
    update(2051, (props) => setText(props, ['text'], indigenousEligibilityReview.en, indigenousEligibilityReview.fr));
    update(2052, (props) => setText(props, ['text'], 'For this program, I declare that I identify as an Indigenous person in Canada, meaning First Nations, Inuit, or Métis.', 'Pour ce programme, je déclare que je m’identifie comme une personne autochtone au Canada, c’est-à-dire membre des Premières Nations, Inuit ou Métis.'));
    update(2053, (props) => {
      setHint(props, 'Type your full legal name and select Sign.', 'Tapez votre nom légal complet, puis sélectionnez Signer.');
      setText(props, ['placeholder', 'text'], 'First name Last name', 'Prénom Nom de famille');
    });

    update(4318, (props) => setText(props, ['text'], 'Conflict of interest declaration', 'Déclaration de conflit d’intérêts'));
    update(4319, (props) => setText(props, ['text'], 'The Indigenous Skills and Employment Training (ISET) program is committed to fair, transparent, and accountable funding decisions.', 'Le programme de formation et d’emploi des compétences des Autochtones (ISET) s’engage à prendre des décisions de financement équitables, transparentes et responsables.'));
    update(4320, (props) => setText(props, ['text'], 'To support fairness, please tell us about any actual, potential, or perceived conflict of interest related to your application.', 'Pour soutenir l’équité, veuillez nous informer de tout conflit d’intérêts réel, potentiel ou perçu lié à votre demande.'));
    update(4321, (props) => setText(props, ['text'], '1. I am not aware of any personal, family, financial, or other relationship with NWAC staff or regional member-association staff that could influence, or appear to influence, the review of my ISET application.', '1. À ma connaissance, je n’ai aucune relation personnelle, familiale, financière ou autre avec un membre du personnel de l’AFAC ou d’une association membre régionale qui pourrait influencer, ou sembler influencer, l’examen de ma demande ISET.'));
    update(4322, (props) => setText(props, ['text'], '2. I have not tried to influence or pressure anyone involved in reviewing my ISET application.', '2. Je n’ai pas tenté d’influencer ni d’exercer de pression sur quiconque participe à l’examen de ma demande ISET.'));
    update(4323, (props) => setText(props, ['text'], '3. I understand that applications are reviewed according to program processes, and I have not asked for my application to be prioritized ahead of others.', '3. Je comprends que les demandes sont examinées selon les processus du programme et je n’ai pas demandé que ma demande soit priorisée avant celles des autres.'));
    update(4324, (props) => setText(props, ['text'], '4. If there is any actual, potential, or perceived conflict of interest or bias, I have described it below.', '4. S’il existe un conflit d’intérêts ou un biais réel, potentiel ou perçu, je l’ai décrit ci-dessous.'));
    update(4325, (props) => {
      setHint(props, 'Please select the option that applies to you.', 'Veuillez sélectionner l’option qui s’applique à vous.');
      setLegend(props, 'I confirm that one of the following applies:', 'Je confirme qu’une des situations suivantes s’applique :');
      setOptionText(props, 'no_conflict', 'I have no conflict of interest or bias to declare', 'Je n’ai aucun conflit d’intérêts ni biais à déclarer');
      setOptionText(props, 'conflict', 'I want to declare a possible conflict of interest or bias', 'Je souhaite déclarer un conflit d’intérêts ou un biais possible');
      setValidationMessage(props, 'requiredMessage', 'Please tell us whether you have a conflict of interest to declare.', 'Veuillez indiquer si vous avez un conflit d’intérêts à déclarer.');
    });
    update(4326, (props) => {
      setLabel(props, 'Please describe the possible conflict of interest or bias', 'Veuillez décrire le conflit d’intérêts ou le biais possible');
      setHint(props, 'Share only the information needed to explain the situation.', 'Indiquez seulement les renseignements nécessaires pour expliquer la situation.');
      setLegend(props, 'Please describe the possible conflict of interest or bias', 'Veuillez décrire le conflit d’intérêts ou le biais possible');
      setValidationMessage(props, 'requiredMessage', 'Please describe the possible conflict of interest or bias.', 'Veuillez décrire le conflit d’intérêts ou le biais possible.');
    });
    update(4327, (props) => {
      setHint(props, 'Type your full legal name and select Sign.', 'Tapez votre nom légal complet, puis sélectionnez Signer.');
      setText(props, ['placeholder', 'text'], 'First name Last name', 'Prénom Nom de famille');
    });

    update(3065, (props) => setText(props, ['text'], 'By signing below, I authorize my training or educational institution, or my employer if my ISET support includes a work placement or wage subsidy, to share information with the Native Women’s Association of Canada (NWAC) and its ISET delivery partners.', 'En signant ci-dessous, j’autorise mon établissement de formation ou d’enseignement, ou mon employeur si mon soutien ISET comprend un placement ou une subvention salariale, à communiquer des renseignements à l’Association des femmes autochtones du Canada (AFAC) et à ses partenaires de prestation du programme ISET.'));
    update(3066, (props) => setText(props, ['text'], 'I understand that this authorization remains in effect unless and until I withdraw it in writing. It applies to information about the funded program, classes, attendance, or wage subsidy under ISET that is funded by Employment and Social Development Canada (ESDC).', 'Je comprends que cette autorisation demeure en vigueur tant que je ne la retire pas par écrit. Elle s’applique aux renseignements sur le programme financé, les cours, l’assiduité ou la subvention salariale dans le cadre d’ISET financé par Emploi et Développement social Canada (EDSC).'));
    update(3067, (props) => setText(props, ['text'], 'If I decide to withdraw this authorization, I understand that I must notify the Registrar’s Office, my employer, and NWAC or its ISET delivery partner in writing.', 'Si je décide de retirer cette autorisation, je comprends que je dois en aviser par écrit le Bureau du registraire, mon employeur et l’AFAC ou son partenaire de prestation ISET.'));
    update(3068, (props) => setText(props, ['text'], 'Under applicable access-to-information and privacy laws, I have privacy rights regarding personal information held by government institutions, including educational institutions.', 'En vertu des lois applicables en matière d’accès à l’information et de protection de la vie privée, j’ai des droits relatifs à la confidentialité des renseignements personnels détenus par les institutions gouvernementales, y compris les établissements d’enseignement.'));
    update(3069, (props) => setText(props, ['text'], 'My signature confirms that I authorize the institution or employer that received ISET funding or a wage subsidy on my behalf to share the information described above with NWAC or its designate.', 'Ma signature confirme que j’autorise l’établissement ou l’employeur qui a reçu un financement ISET ou une subvention salariale en mon nom à communiquer les renseignements décrits ci-dessus à l’AFAC ou à son représentant désigné.'));
    update(3070, (props) => {
      setHint(props, 'Type your full legal name and select Sign.', 'Tapez votre nom légal complet, puis sélectionnez Signer.');
      setText(props, ['actionLabel', 'text'], 'Sign now', 'Signer maintenant');
      setText(props, ['placeholder', 'text'], 'First name Last name', 'Prénom Nom de famille');
    });

    await conn.beginTransaction();
    try {
      for (const [id, props] of updated.entries()) {
        await conn.query('UPDATE step_component SET props_overrides = ? WHERE id = ?', [JSON.stringify(props), id]);
      }
      if (APPLY) {
        await conn.commit();
      } else {
        await conn.rollback();
      }
    } catch (error) {
      await conn.rollback();
      throw error;
    }

    console.log(
      JSON.stringify(
        {
          workflowId: WORKFLOW_ID,
          apply: APPLY,
          updatedCount: updated.size,
          backupPath: originalBackupPath,
          updatedIds: [...updated.keys()].sort((a, b) => a - b),
        },
        null,
        2
      )
    );
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
