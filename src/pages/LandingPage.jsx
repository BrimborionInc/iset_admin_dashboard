import React from 'react';
import { buildLoginUrl } from '../auth/cognito';
import '../css/awentech-landing.css';
import Button from '@cloudscape-design/components/button';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import heroBackground from '../assets/images/awentech/hero-background.png';

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
      sectionTitle: 'Release Notes - Patch v0.1.0',
      description: 'The latest patch updates keep administrators informed about what changed, what issues remain, and what is coming next.',
      features: {
        heading: 'Features',
        sections: [
          {
            title: 'Case Management',
            paragraphs: [
              'Intake submissions flow in from the public portal with notifications targeted to the responsible role.',
              'Program Administrators and Regional Coordinators assign applications through routing controls aligned to their teams.',
              'The dashboard holds the overview, application record, assessment form, secure messaging, supporting documents, event log, and status controls.',
              'Overdue checks raise alerts whenever an application stalls at any stage.'
            ]
          },
          {
            title: 'Intake Workflow Studio',
            paragraphs: [
              'Editors assemble intake steps from reusable components.',
              'Validation rules and controls enforce required data before submission.',
              'AI assists with step wording, edits, and bilingual translation between French and English.',
              'Conditional fields, summary pages, and rules-based file uploads adapt the form to applicant responses.',
              'The workflow editor supports linear, conditional, and branching paths with testing, preview, and publication tools.'
            ]
          },
          {
            title: 'Secure Messaging',
            paragraphs: [
              'Secure messaging links applicants and the ISET team within each case.',
              'Every application keeps a dedicated inbox so the full thread stays together.',
              'Uploaded attachments store against the applicant record and remain available to staff.'
            ]
          },
          {
            title: 'Configuration',
            paragraphs: [
              'Configure AI defaults, parameters, and fallback providers for guidance tools.',
              'Manage MFA mode, session timeouts, SSO providers, and federation sync.',
              'Set SLA targets across lifecycle stages and maintain notification templates for reminders, channels, acknowledgements, and language fallbacks.',
              'Adjust allowed origins, demo toolbar visibility, appearance preferences, and monitor required secrets.'
            ]
          },
          {
            title: 'Security',
            paragraphs: [
              'AWS Cognito sign-on with access control matrix enforcement covers role-based authorization.',
              'Session auditing and event logging record system access.',
              'Databases, document stores, and configuration secrets stay encrypted with KMS-managed keys.',
              'CORS allowlists, TLS enforcement, and certificate management harden the perimeter.'
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
          { title: 'Default French Strings', paragraphs: ['Certain intake components ship with default French text that interferes with AI-driven translation.'] },
          { title: 'AI Support', paragraphs: ['The support assistant is not yet fully trained on the solution and can drift off topic.'] }
        ]
      },
      comingNext: {
        heading: 'Coming next patch',
        sections: [
          { title: 'Records Retention and Archiving', paragraphs: ['Introduce configurable retention, archiving, and disposition policies, backed by warehouse storage, automated record-keeping, and legal hold controls.'] },
          { title: 'Analytics Dashboard', paragraphs: ['Deliver a dedicated analytics view with charts, reports, and metrics.'] },
          { title: 'Release Management', paragraphs: ['Add enhanced release tooling to stage and control changes to intake workflows.'] },
          { title: 'Tutorials', paragraphs: ['Publish guided walkthroughs for each primary function.'] },
          { title: 'Notification Templates', paragraphs: ['Re-enable the Notification Settings dashboard with editable email templates, dynamic audiences, and audit history.'] },
          { title: 'Enhanced Workflow', paragraphs: ['Strengthen workflow-driven status controls to replace the current manual status updates.'] }
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
      sectionTitle: 'Notes de version - correctif v0.1.0',
      description: 'Les dernières mises à jour informent l’équipe de ce qui a changé, des incidents connus et des prochaines étapes.',
      features: {
        heading: 'Fonctionnalités',
        sections: [
          {
            title: 'Gestion des dossiers',
            paragraphs: [
              'Les demandes transmises par le portail public arrivent directement dans le tableau de bord avec des notifications adressées au rôle responsable.',
              'Les administrateurs de programme et les coordonnateurs régionaux assignent les demandes grâce à des contrôles d’acheminement adaptés à leurs équipes.',
              'Le tableau de bord rassemble l’aperçu, le dossier de demande, le formulaire d’évaluation électronique, la messagerie sécurisée, les documents justificatifs, le journal d’événements et les commandes de statut.',
              'Des contrôles d’échéance déclenchent des alertes dès qu’un dossier demeure bloqué à une étape.'
            ]
          },
          {
            title: 'Studio des parcours d’accueil',
            paragraphs: [
              'Les conceptrices et concepteurs assemblent les étapes d’accueil à partir de composants réutilisables.',
              'Les règles et contrôles de validation imposent les données requises avant l’envoi.',
              'L’IA assiste la rédaction des étapes, les révisions et la traduction bilingue FR/EN.',
              'Les champs conditionnels, pages de résumé et dépôts de fichiers guidés par des règles adaptent le formulaire aux réponses.',
              'L’éditeur de flux supporte les parcours linéaires, conditionnels ou ramifiés avec des outils de test, d’aperçu et de publication.'
            ]
          },
          {
            title: 'Messagerie sécurisée',
            paragraphs: [
              'La messagerie sécurisée relie les candidates et l’équipe ISET pour chaque dossier.',
              'Chaque demande dispose d’une boîte dédiée pour conserver l’historique complet.',
              'Les pièces jointes téléchargées sont conservées dans le dossier de la personne et restent accessibles au personnel.'
            ]
          },
          {
            title: 'Configuration',
            paragraphs: [
              'Configurer les paramètres par défaut de l’IA, les seuils et les fournisseurs de repli pour les outils d’aide.',
              'Gérer le MFA, les délais d’expiration de session, les fournisseurs SSO et la synchronisation de fédération.',
              'Définir les cibles SLA pour chaque étape du cycle et maintenir les modèles de notification (rappels, canaux, accusés, langues de repli).',
              'Ajuster les origines autorisées, la visibilité de la barre de démonstration, les préférences d’apparence et surveiller les secrets requis.'
            ]
          },
          {
            title: 'Sécurité',
            paragraphs: [
              'L’authentification AWS Cognito applique l’autorisation basée sur les rôles via la matrice de contrôle d’accès.',
              'L’audit des sessions et la journalisation des événements consignent les accès.',
              'Les bases de données, dépôts de documents et secrets de configuration restent chiffrés avec des clés gérées par KMS.',
              'Les listes d’autorisation CORS, l’application du TLS et la gestion des certificats renforcent le périmètre.'
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
        heading: 'À venir au prochain correctif',
        sections: [
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
    window.open('http://localhost:3000/', '_blank', 'noopener,noreferrer');
  };

  const scrollToSection = id => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navItems = content.navItems;

  const topNavI18nStrings = lang === 'fr'
    ? {
        searchIconAriaLabel: 'Rechercher',
        searchDismissIconAriaLabel: 'Fermer la recherche',
        overflowMenuTriggerText: 'Plus',
        overflowMenuTitleText: 'Toutes les sections',
        overflowMenuBackButtonText: 'Retour',
        overflowMenuDismissButtonText: 'Fermer le menu'
      }
    : {
        searchIconAriaLabel: 'Search',
        searchDismissIconAriaLabel: 'Close search',
        overflowMenuTriggerText: 'All',
        overflowMenuTitleText: 'All sections',
        overflowMenuBackButtonText: 'Back',
        overflowMenuDismissButtonText: 'Close menu'
      };

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
                    {section.paragraphs.map((text, idx) => (
                      <p key={idx}>{text}</p>
                    ))}
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
                    {section.paragraphs.map((text, idx) => (
                      <p key={idx}>{text}</p>
                    ))}
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
                    {section.paragraphs.map((text, idx) => (
                      <p key={idx}>{text}</p>
                    ))}
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
