import React from 'react';
import { buildLoginUrl } from '../auth/cognito';
import '../css/awentech-landing.css';
import Button from '@cloudscape-design/components/button';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import heroBackground from '../assets/images/awentech/alt-hero.png';

const portalUrl = process.env.REACT_APP_PORTAL_URL || 'http://localhost:3000/';

const copy = {
  en: {
    navItems: [
      { id: 'hero', label: 'Overview' },
      { id: 'release-notes', label: 'Release Notes' },
      { id: 'resources', label: 'Resources' },
      { id: 'contact', label: 'Support' },
    ],
    header: {
      signIn: 'Sign in',
      languageLabel: 'Switch language'
    },
    hero: {
      eyebrow: "Native Women’s Association of Canada (NWAC)",
      title: 'NWAC ISET Program intake & assessment portal',
      lead: "This is the welcome page of the NWAC ISET Program digital intake and application assessment portal. The NWAC Admin Dashboard brings ISET intake, case management, and compliance tracking into a single Cloudscape experience. Built on Awentech’s secure forms platform, administrators can orchestrate workflow design, coordinate assessment reviews, and collaborate with regional delivery teams from one place.",
      primaryCta: 'Sign in to manage NWAC programs',
      secondaryCta: "View the applicants' portal",
      meta: [
        'Secure access with Cognito IAM',
        'WCAG AA compliant applicant journeys',
        'Integrated reporting & notifications'
      ]
    },
    releaseNotes: {
      sectionTitle: 'Release Notes - v0.2.1 (14 Nov 2025)',
      description: 'Release 0.2.1 focuses on communication: program staff now have a Notification Template Editor plus toggles that determine which templates go out with each event.',
      features: {
        heading: 'Updates',
        sections: [
          {
            title: 'Release v0.2.1 — Notification templates',
            paragraphs: [
              'New Notification Template Editor lets administrators adjust submission confirmations, secure message alerts, and decision emails with inline formatting controls, placeholder hints, and preview—all inside the dashboard.',
              'Notification Settings are now live: when an event/role is enabled and linked to a template, the applicant/staff emails use that exact copy with the appropriate placeholders.',
              'Template helpers highlight the available tokens (tracking ID, applicant name, portal link, etc.) so the final email matches the data captured in intake.'
            ]
          },
          {
            title: 'Release v0.2.0 — Case management',
            paragraphs: [
              'This major release introduces the Caseworking module. When an application is approved in the Application assessment module it appears in Caseworking.',
              'Caseworking is where you manage the case from first follow-up to closure. Open a case to a workspace with panels for the case header, secure messaging, supporting documents, notes and tasks, calendar, action plans, interventions, finance, compliance, and an export preview. Drag to reorder, resize, add or remove panels, and your layout is remembered.',
              'Caseworking workspace:',
              '- Create action plans, then activate, close, or archive them as the case progresses; keep plan dates and status up to date.',
              '- Select the current plan to see and edit its interventions. Update status, dates, description, outcomes, and funding pot; add notes for team context.',
              '- Use the calendar to schedule follow-ups and view upcoming reminders and plan milestones in one place; it highlights what’s due next.',
              '- Read and send secure messages; any attachments you open also show up in Supporting documents for quick download.',
              '- Add notes and simple tasks as you go; use follow‑up dates to place reminders on the calendar.',
              '- Check finance totals and pot balances to catch overspend early and confirm funding mappings.',
              '- Review compliance messages to resolve anything blocking export.',
              '- Preview the export to confirm what will be sent before you proceed.',
              '- Confirm the client, agreement, and owner in the case header; reassign ownership when needed.',
              '- You can reset the layout to the default at any time, and each panel includes brief help for common actions.',
              'Intake and assessment updates:',
              '- Updated the Client EI consent step and signature to the new format. Submission is blocked until forms are signed.',
              '- Added a Conflict of Interest step with signature to intake. Submission is blocked until forms are signed.',
              'Printable applicant declarations:',
              '- Client EI consent (PDF)',
              '- Indigenous declaration (PDF)',
              '- Conflict of Interest (PDF)',
              'Assessment widget:',
              '- Added the Assessor conflict of interest block and blocked access until it is checked.',
              'Eligibility rules:',
              '- Eligibility limited to Indigenous Women (First Nations, Métis, Inuit).',
              '- Canadian citizenship required.',
              '- Applicants must be unemployed, under-employed, or at risk.',
              '- Removed age restriction (no age limit).',
              '- Removed Eligibility Check step.',
              'Form standardization and fields:',
              '- Biological sex and gender identity fields standardized.',
              '- Added self-declaration form and treaty/status number fields.',
              '- Added province/territory drop-down for education section.',
              '- Updated Employment Goal wording to align with ISET support.',
              '- Added options for Group Training and Self-employment Supports.',
              "- Corrected 'Band Denial Letter' label and added upload options — now requests a Denial or Approval letter based on whether a funding amount was entered earlier.",
              '- Added disability identification and medical documentation fields, including file upload logic.',
              '- Updated marital status to “Married or equivalent”.',
              '- Removed Internet as an eligible expense.',
              '- Removed “Other expenses” and added a catch-all training expense question.',
              '- Updated transportation options to Bus Pass, Parking Pass, or Mileage.',
              '- Added Alimony and Child Support to household income options.',
              'Configuration and widgets:',
              '- Patch list confirmed and applied to live configuration.',
              '- Added lookup for Indigenous community field.',
              '- Updated the application form widget with the new fields.',
              '- Added an EI consent form modal and save function to the application form widget.'
            ]
          },
          {
            title: 'Patch v0.1.5',
            paragraphs: [
              'New Dashboards:',
              '- Scaffolded the Level 1 “ISET Case Portfolio” dashboard with persistent filters, finance overview, and case table widgets.',
              '- Introduced the Level 2 “Case Workspace” dashboard, wrapping existing case widgets (supporting documents, secure messaging, application events, etc.) as configurable board items.',
              '- Wired new API hook stubs for portfolio and case data, and updated access-control routes plus side-navigation badges.',
              'UI Improvements:',
              '- Added Cloudscape board controls to the case workspace header and surfaced contact message counts in the side-nav footer.',
              '- Restyled the compliance panel into dual cards highlighting ILMP vs. finance checks.',
              '- Ensured documents, messaging, and events widgets now share the case context scaffolding.',
              'Notes:',
              '- All new dashboards and widgets remain scaffolds pending live API integration, CRUD flows, and validation wiring.'
            ]
          },
          {
            title: 'Patch v0.1.4',
            paragraphs: [
              'Bug Fixes:',
              '- Fixed a bug where the "Forgotten password" link was blocked in the public portal.',
              '- Fixed a bug where "case_watch_removed" events were not being captured.',
              '- Fixed a bug where characters with accents were rendered as question marks in the public portal messages module.',
              '- Fixed a bug where regional coordinators could not approve or reject applications.',
              '- Fixed a bug where assessors could sometimes approve or reject applications unexpectedly.',
              'Minor Improvements:',
              '- Changed the messaging for Social Insurance Numbers that fail checksum validation in the Participant Submissions dashboard.',
              '- Extended the ESDC submission XML to cover the intervention. More work is needed in the assessment widget to collect the remaining ESDC-required information: Intervention Code (WG code 1-20), Intervention Start/End Date plus Intervention Duration (weeks/hours), Intervention Outcome, Intervention Cost as a plain number, Intervention Related NOC and NOC Version, Action Plan Result Code and Result Date, Childcare Need and related funding description, Requested Supports per intervention, and Optional Notes or goal narrative.'
            ]
          },
          {
            title: 'Patch v0.1.3',
            paragraphs: [
              'You can test this by moving a submitted application to the "approved" status.',
              'Prepared the upcoming ESDC submissions module with four dashboards: Overview, Participants, Participant Submission Workspace, and Reporting.',
              'Participants dashboard now highlights readiness status, blocking issues, and export progress so coordinators can triage real submissions first.',
              'Overview dashboard stays scaffolded while we wire in live submission KPIs, deadline tracking, and recent submissions summaries.',
              'Participants dashboard queues approved applications for XML generation and links into the Participant Submission Workspace.',
              'Participant Submission Workspace validates a single participant against the ESDC 1.4 schema, including checksum checks for Social Insurance Numbers.',
              'Participant Submission Workspace now generates ILMP XML snapshots, stores checksums, and exposes an inline preview with download and copy actions.',
              'Reporting dashboard remains a scaffold placeholder that will ultimately cover case, intervention, NOC, and finance-integrated reporting.'
            ]
          },
          {
            title: 'Previous Patch (v0.1.2)',
            paragraphs: [
              'Refreshed public portal content (cookies, privacy, about, contact) and connected the Contact Messages dashboard.',
              'Simplified the "ISET Application – Draft Incomplete" card to focus on completion counts.'
            ]
          }
        ]
      },
      knownBugs: {
        heading: 'Known Bugs',
        sections: [
          { title: 'Workflow Studio', paragraphs: ['The "flowchart" views do not pan or zoom consistently, making drag interactions unreliable.'] },
          { title: 'Intake Step Editor', paragraphs: ['Dragging components within the workspace causes flicker and the insertion point is unclear.'] },
          { title: 'Notification Settings', paragraphs: ['Email notifications are currently hard-wired: account verification, password reset, submission confirmation, secure message alerts, and NWAC ISET Team triage notices. The Notification Settings dashboard is disabled until configurable templates return.'] },
          { title: 'Template Editor (checkbox layout)', paragraphs: ['Checkbox options can overlap their labels in dense blocks; refresh or collapse the section to restore spacing while we patch the layout.'] },
          { title: 'Default French Strings', paragraphs: ['Certain intake components ship with default French text that interferes with AI-driven translation.'] },
          { title: 'AI Support', paragraphs: ['The support assistant is not yet fully trained on the solution and can drift off topic.'] }
        ]
      },
      comingNext: {
        heading: 'Coming Soon',
        sections: [
          {
            title: 'Post‑0.2.0 To‑Dos',
            paragraphs: [
              'Tidy the burger menu in the public portal.',
              'In the support section, fix the AI input.',
              'Remove the email from the technical support paragraph.',
              'In the user dashboard, rename Applications to My Applications.',
              'Create dummy draft update.',
              'Include a new widget in the ISET application assessment dashboard for document checklist.',
              'Document Upload function in Documents Widget.',
              'Convert the mileage entry in the intake wizard from a dollar amount to a distance field and apply cost calculations automatically.'
            ]
          }
        ]
      }
    },
    resources: {
      title: 'Built for collaborative delivery',
      description: 'The admin console reuses the same primitives that power the public applicant portal, ensuring parity between what applicants submit and how administrators action requests.',
      cards: [
        { title: 'Environment aware', description: 'Toggle between sandbox and production data sources without code changes. Session state persists across deployments for smooth demonstrations.' },
        { title: 'Secure by design', description: 'AWS Cognito backed authentication, fine-grained role enforcement, and event capture hooks keep program data auditable and access-controlled.' },
        { title: 'Extensible platform', description: 'Compose new widgets, automate notifications, or plug in analytics sources using the existing Cloudscape component library and API clients.' }
      ]
    },
    footer: {
      heading: 'Need access?',
      body: 'Contact the NWAC program administration team to request credentials or onboarding support.',
      primary: 'Sign in',
      secondary: "View the applicants' portal"
    }
  },
  fr: {
    navItems: [
      { id: 'hero', label: 'Aperçu' },
      { id: 'release-notes', label: 'Notes de version' },
      { id: 'resources', label: 'Ressources' },
      { id: 'contact', label: 'Soutien' },
    ],
    header: {
      signIn: 'Se connecter',
      languageLabel: 'Changer de langue'
    },
    hero: {
      eyebrow: 'Association des Femmes Autochtones du Canada (AFAC)',
      title: 'Portail d’accueil et d’évaluation du programme ISET de l’AFAC',
      lead: "Page d’accueil du portail numérique d’accueil et d’évaluation du programme ISET de l’AFAC. Le tableau de bord administratif réunit dans Cloudscape l’accueil, la gestion des dossiers et le suivi de conformité. Construit sur la plateforme de formulaires sécurisés d’Awentech, il permet d’orchestrer les flux, de coordonner les évaluations et de collaborer avec les équipes régionales à partir d’un seul endroit.",
      primaryCta: 'Se connecter pour gérer les programmes de l’AFAC',
      secondaryCta: 'Voir le portail des candidates',
      meta: [
        'Accès sécurisé avec Cognito IAM',
        'Parcours candidates conformes WCAG AA',
        'Rapports et notifications intégrés'
      ]
    },
    releaseNotes: {
      sectionTitle: 'Notes de version - correctif v0.1.4 (24 octobre 2025)',
      description: 'Le correctif v0.1.4 renforce la fiabilité des portails et poursuit la préparation des soumissions vers EDSC.',
      features: {
        heading: 'Mises à jour',
        sections: [
          {
            title: 'Correctif v0.1.4',
            paragraphs: [
              'Corrections de bogues :',
              '- Correction d\'un bogue qui bloquait le lien « Mot de passe oublié » dans le portail public.',
              '- Correction d\'un bogue qui empêchait la capture des événements « case_watch_removed ».',
              '- Correction d\'un bogue qui remplaçait les caractères accentués par des points d\'interrogation dans le module de messages du portail public.',
              '- Correction d\'un bogue qui empêchait les coordonnatrices régionales d\'approuver ou de rejeter des demandes.',
              '- Correction d\'un bogue qui permettait parfois aux évaluatrices d\'approuver ou de rejeter des demandes sans respecter le processus.',
              'Améliorations mineures :',
              '- Modification du message affiché lorsque le NAS échoue la validation de somme de contrôle dans le tableau de bord des soumissions.',
              '- Extension du fichier XML de soumission EDSC pour inclure l\'intervention. Le widget d\'évaluation devra recueillir les informations supplémentaires exigées par EDSC : code d\'intervention (codes WG 1-20), dates de début et de fin plus durée (semaines/heures), résultat d\'intervention, coût d\'intervention saisi comme nombre, CNP associé et version, code de résultat du plan d\'action et date, besoin en garde d\'enfants et description du financement, soutiens demandés par intervention, et notes ou narration d\'objectif.'
            ]
          },
          {
            title: 'Correctif v0.1.3',
            paragraphs: [
              'Prépare le module de soumission vers EDSC avec quatre tableaux de bord : Aperçu, Participantes, Espace de soumission des participantes et Rapports.',
              'Le tableau Aperçu reste en échafaudage pour l’instant et accueillera bientôt des indicateurs, un suivi des échéances et un tableau des dépôts récents.',
              'Le tableau Participantes alimente la file des demandes approuvées, permet de générer des fichiers XML et redirige vers l’Espace de soumission des participantes.',
              'L’Espace de soumission des participantes valide une participante à la fois selon le schéma EDSC 1.4, y compris la vérification du numéro d’assurance sociale.',
              'Le tableau Rapports demeure un espace réservé avant l’arrivée des rapports par dossier, des codes CNP et de l’intégration financière.'
            ]
          },
          {
            title: 'Correctif précédent (v0.1.2)',
            paragraphs: [
              'Actualisation du contenu public (témoin, confidentialité, à propos, contact) et connexion du tableau des messages de contact.',
              'Simplification de la carte « Demande ISET – Brouillon incomplet » pour mettre de l’avant le nombre de sections complétées.'
            ]
          }
        ]
      },
      knownBugs: {
        heading: 'Bugs connus',
        sections: [
          { title: 'Studio des parcours', paragraphs: ['Les vues « organigramme » ne gèrent pas correctement le déplacement ou le zoom, ce qui rend le glisser-déposer instable.'] },
          { title: 'Éditeur d’étapes', paragraphs: ['Le déplacement des composants dans l’aire de travail provoque un scintillement et le point d’insertion demeure flou.'] },
          { title: 'Paramètres de notification', paragraphs: ['Les notifications courriel sont présentement codées en dur : vérification de compte, réinitialisation de mot de passe, accusé de réception de dépôt, alertes de messagerie sécurisée et avis de triage de l’équipe ISET de l’AFAC. Le tableau des paramètres de notification demeure désactivé jusqu’au retour des modèles configurables.'] },
          { title: 'Chaînes françaises par défaut', paragraphs: ['Certains composants d’accueil contiennent un texte français par défaut qui perturbe la traduction pilotée par l’IA.'] },
          { title: 'Assistant IA', paragraphs: ['L’assistant IA n’est pas encore formé sur l’ensemble de la solution et peut sortir du sujet.'] }
        ]
      },
      comingNext: {
        heading: 'À venir bientôt',
        sections: [
          {
            title: "Widget d'évaluation et gestion des dossiers",
            paragraphs: [
              "Une refonte du widget d'évaluation est prévue afin d'aligner davantage la section Intervention sur les besoins d'EDSC pour consigner les bonnes données.",
              "Le module de gestion des dossiers en préparation renforcera cette évolution en permettant d'ajouter plusieurs interventions à un même dossier."
            ]
          },
          { title: 'Conservation et archivage', paragraphs: ['Introduire des politiques configurables de conservation, d’archivage et de disposition, avec entrepôt de données, tenue de registres automatisée et contrôles de gel légal.'] },
          { title: 'Tableau analytique', paragraphs: ['Offrir un tableau de bord analytique dédié avec graphiques, rapports et indicateurs.'] },
          { title: 'Gestion des publications', paragraphs: ['Ajouter des outils de publication renforcés pour mettre en scène et contrôler les changements des parcours d’accueil.'] },
          { title: 'Tutoriels', paragraphs: ['Publier des tutoriels guidés pour chaque fonction principale.'] },
          { title: 'Modèles de notification', paragraphs: ['Réactiver le tableau des paramètres de notification avec des modèles courriel éditables, des publics dynamiques et un historique d’audit.'] },
          { title: 'Flux renforcé', paragraphs: ['Renforcer les contrôles de statut pilotés par le flux pour remplacer les mises à jour manuelles actuelles.'] }
        ]
      }
    },
    resources: {
      title: 'Conçu pour une prestation collaborative',
      description: 'La console admin réutilise les mêmes primitives que le portail des candidates, assurant la parité entre les dépôts et leur traitement.',
      cards: [
        { title: 'Sensibilité à l’environnement', description: 'Basculer entre données bac à sable et production sans modification de code. L’état de session persiste pour les démonstrations.' },
        { title: 'Sécurité intégrée', description: 'L’authentification Cognito, le contrôle fin des rôles et la capture d’événements gardent les données auditables et protégées.' },
        { title: 'Plateforme extensible', description: 'Composer de nouveaux widgets, automatiser les notifications ou brancher des sources analytiques avec la bibliothèque Cloudscape existante.' }
      ]
    },
    footer: {
      heading: 'Besoin d’accès?',
      body: 'Communiquez avec l’équipe d’administration du programme de l’AFAC pour obtenir des accès ou du soutien d’intégration.',
      primary: 'Se connecter',
      secondary: 'Voir le portail des candidates'
    }
  }
};

const languageOptions = [
  { id: 'en', text: 'EN' },
  { id: 'fr', text: 'FR' }
];

const LandingPage = ({ currentLanguage = 'en', onLanguageChange }) => {
  const lang = currentLanguage === 'fr' ? 'fr' : 'en';
  const content = copy[lang];
  const handleLanguageToggle = targetLang => {
    if (targetLang !== lang && typeof onLanguageChange === 'function') {
      onLanguageChange(targetLang);
    }
  };

  const brandLogo = `${process.env.PUBLIC_URL || ''}/nwac-logo.png`;

  const openPublicPortal = () => {
    window.open(portalUrl, '_blank', 'noopener,noreferrer');
  };

  const scrollToSection = id => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navItems = content.navItems;

  const handleSignIn = () => {
    window.location.assign(buildLoginUrl());
  };

  return (
    <div className="awentech-landing">
      <header className="landing-header">
        <div className="landing-header__bar" style={{ display: 'flex', alignItems: 'center', gap: '2rem', padding: '0.75rem 2rem', boxShadow: '0 1px 0 rgba(255,255,255,0.05), 0 1px 4px rgba(0,0,0,0.25)' }}>
          <a href="#hero" onClick={e => { e.preventDefault(); scrollToSection('hero'); }} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <img src={brandLogo} alt={lang === 'fr' ? "Logo de l’Association des Femmes Autochtones du Canada" : "Native Women's Association of Canada logo"} style={{ height: 40, width: 'auto', marginRight: '0.75rem' }} />
            <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>{lang === 'fr' ? 'Tableau de bord NWAC' : 'NWAC Admin Dashboard'}</span>
          </a>
          <style>{`
            .landing-header__nav a { 
              color: #f1f5f9 !important; /* very light slate for contrast */
              transition: color .15s ease, text-shadow .15s ease; 
              font-weight: 500;
            }
            .landing-header__nav a:hover { 
              color: #ffffff !important; 
              text-shadow: 0 0 4px rgba(255,255,255,0.35);
            }
            .landing-header__nav a:focus { 
              color: #ffffff !important; 
              outline: 2px solid #38bdf8; 
              outline-offset: 2px; 
              border-radius: 4px;
            }
            .landing-header__divider { width:1px; align-self:stretch; background: rgba(255,255,255,0.28); margin: 0 .75rem; }
            @media (prefers-reduced-motion: reduce) { 
              .landing-header__nav a { transition: none; }
            }
           `}</style>
          <div style={{ flexGrow: 1 }} />
          <nav className="landing-header__nav" style={{ display: 'flex', gap: '1.25rem', fontSize: '.9rem' }}>
            {navItems.map(({ id, label }) => (
               <a
                 key={id}
                 href={`#${id}`}
                 style={{ textDecoration: 'none', padding: '0.25rem 0.5rem' }}
                 onClick={event => {
                   event.preventDefault();
                   scrollToSection(id);
                 }}
               >
                 {label}
               </a>
             ))}
           </nav>
          <div className="landing-header__divider" />
          <div className="landing-header__controls" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <SegmentedControl
              size="small"
              selectedId={lang}
              options={languageOptions}
              onChange={({ detail }) => handleLanguageToggle(detail.selectedId)}
              ariaLabel={content.header.languageLabel}
            />
            <Button variant="primary" onClick={handleSignIn}>
              {content.header.signIn}
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section
          id="hero"
          className="landing-hero"
          style={{ backgroundImage: `url(${heroBackground})` }}
        >
          <div className="landing-hero__overlay" />
          <div className="landing-hero__content">
            <p className="eyebrow">{content.hero.eyebrow}</p>
            <h1>{content.hero.title}</h1>
            <p className="lead">{content.hero.lead}</p>
            <div className="landing-hero__actions">
              <button type="button" className="primary" onClick={handleSignIn}>
                {content.hero.primaryCta}
              </button>
              <button type="button" className="secondary" onClick={openPublicPortal}>
                {content.hero.secondaryCta}
              </button>
            </div>
            <div className="landing-hero__meta">
              {content.hero.meta.map(item => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
        </section>

        <section id="release-notes" className="landing-implementations landing-section">
          <h2>{content.releaseNotes.sectionTitle}</h2>
          <p className="description">
            {content.releaseNotes.description}
          </p>
          <div className="landing-card-grid">
            <article className="landing-card">
              <h3 className="release-notes-heading">{content.releaseNotes.features.heading}</h3>
              <div className="release-notes-sections">
                {content.releaseNotes.features.sections.map(section => (
                  <section key={section.title}>
                    <h4>{section.title}</h4>
                    {section.paragraphs.map((text, idx) => {
                      const t = typeof text === 'string' ? text.trim() : '';
                      const isSubheading = typeof text === 'string' && t.endsWith(':') && !t.startsWith('-');
                      return (
                        <p key={idx}>{isSubheading ? <strong>{text}</strong> : text}</p>
                      );
                    })}
                  </section>
                ))}
              </div>
            </article>
            <article className="landing-card">
              <h3 className="release-notes-heading">{content.releaseNotes.knownBugs.heading}</h3>
              <div className="release-notes-sections">
                {content.releaseNotes.knownBugs.sections.map(section => (
                  <section key={section.title}>
                    <h4>{section.title}</h4>
                    {section.paragraphs.map((text, idx) => {
                      const t = typeof text === 'string' ? text.trim() : '';
                      const isSubheading = typeof text === 'string' && t.endsWith(':') && !t.startsWith('-');
                      return (
                        <p key={idx}>{isSubheading ? <strong>{text}</strong> : text}</p>
                      );
                    })}
                  </section>
                ))}
              </div>
            </article>
            <article className="landing-card">
              <h3 className="release-notes-heading">{content.releaseNotes.comingNext.heading}</h3>
              <div className="release-notes-sections">
                {content.releaseNotes.comingNext.sections.map(section => (
                  <section key={section.title}>
                    <h4>{section.title}</h4>
                    {section.paragraphs.map((text, idx) => {
                      const t = typeof text === 'string' ? text.trim() : '';
                      const isSubheading = typeof text === 'string' && t.endsWith(':') && !t.startsWith('-');
                      return (
                        <p key={idx}>{isSubheading ? <strong>{text}</strong> : text}</p>
                      );
                    })}
                  </section>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section id="resources" className="landing-section landing-section--alt">
          <div className="landing-section__inner">
            <h2>{content.resources.title}</h2>
            <p>
              {content.resources.description}
            </p>
            <div className="landing-resource-grid">
              {content.resources.cards.map(card => (
                <div key={card.title} className="landing-resource-card">
                  <h4>{card.title}</h4>
                  <p>{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="landing-footer">
        <div className="landing-footer__content">
          <div>
            <strong>{content.footer.heading}</strong>
            <p>{content.footer.body}</p>
          </div>
          <div className="landing-footer__actions">
            <button type="button" className="secondary" onClick={openPublicPortal}>
              {content.footer.secondary}
            </button>
            <button type="button" className="primary" onClick={handleSignIn}>
              {content.footer.primary}
            </button>
          </div>
        </div>
        <small>&copy; {new Date().getFullYear()} Awentech platform for NWAC. Cloudscape Design interface.</small>
      </footer>
    </div>
  );
};

export default LandingPage;
