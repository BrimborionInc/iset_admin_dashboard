import React from 'react';
import { buildLoginUrl } from '../auth/cognito';
import '../css/awentech-landing.css';
import Alert from '@cloudscape-design/components/alert';
import Button from '@cloudscape-design/components/button';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import heroBackground from '../assets/images/awentech/nwac-hero.png';

const portalUrl = process.env.REACT_APP_PORTAL_URL || 'http://localhost:3000/';

const copy = {
  en: {
    navItems: [
      { id: 'hero', label: 'Overview' },
      { id: 'release-notes', label: 'Release Notes' },
      { id: 'resources', label: 'Resources' },
      { id: 'contact', label: 'Support' },
    ],
    alert: {
      header: 'Scheduled maintenance',
      body: 'The ISET case management system will be unavailable today from 7:00–8:00 p.m. ET for maintenance. Service will resume once the window is complete.'
    },
    header: {
      signIn: 'Sign in',
      languageLabel: 'Switch language'
    },
    hero: {
      eyebrow: "Native Women’s Association of Canada (NWAC)",
      title: 'ISET Program Case Management System',
      lead: "Sign in with your NWAC credentials to work on applications and cases. Need help? Contact the NWAC ISET program admin team. Installed modules are listed below.",
      primaryCta: 'Sign in to ISET',
      secondaryCta: "View the applicants' portal",
      meta: [
        'Digital Intake',
        'Workflow Studio',
        'Application Assessment',
        'Secure Messaging',
        'Case Management',
        'Budget Management',
        'Reporting',
        'ILMP Reporting'
      ]
    },
    releaseNotes: {
      sectionTitle: 'Release Notes - v0.3.1 (12 Dec 2025)',
      description: 'Release 0.3.1 introduces the ILMP Exports dashboard to prepare, validate, and download multi-client ILMP XML batches.',
      features: {
        heading: 'Updates',
        sections: [
          {
            title: 'Release v0.3.1 — ILMP Exports Dashboard',
            paragraphs: [
              'New “ILMP Exports” dashboard: queue of participants needing submission, bulk validation, batch XML generation, and recent export history.',
              'Validation tightened to align with ILMP 1.4 rules (e.g., education level at plan start, intervention date/length rules, NOC version/length, SIN and address checks).',
              'Batch generation produces a single compliant XML with multiple clients; download flow marks included submissions as submitted and logs batch metadata.',
              'Export history now shows batch details, participants, XML preview with copy, and a “Mark pending” action to re-queue a batch for regeneration.'
            ]
          },
        ]
      },
      knownBugs: {
        heading: 'Known Bugs',
        sections: [
          {
            title: 'Public Portal Login and Registrations',
            paragraphs: [
              'Email addresses are case sensitive. Entering your email with a different case than you registered will reject your login.'
            ]
          },
          {
            title: 'Public Portal Runtime Error',
            paragraphs: [
              'Inactivity sometimes causes the public portal to throw a runtime error. This may be related to in-progress development changes, but the cause is still unknown.'
            ]
          },
          { title: 'Workflow Studio', paragraphs: ['The "flowchart" views do not pan or zoom consistently, making drag interactions unreliable.'] },
          { title: 'AI Support', paragraphs: ['The support assistant is not yet fully trained on the solution and can drift off topic.'] }
        ]
      },
      comingNext: {
        heading: 'Coming Soon',
        sections: [
          {
            title: 'Up Next',
            paragraphs: [
              'Expanding the digital forms library beyond the initial three examples.',
              'Case Manager prefill for forms (e.g., EI Funding Agreement) so some fields arrive pre-populated before applicant signature.'
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
    alert: {
      header: 'Maintenance planifiée',
      body: 'Le système ISET sera indisponible aujourd’hui de 19 h à 20 h (HE) pour entretien. Le service reprendra après la fenêtre de maintenance.'
    },
    header: {
      signIn: 'Se connecter',
      languageLabel: 'Changer de langue'
    },
    hero: {
      eyebrow: 'Association des Femmes Autochtones du Canada (AFAC)',
      title: 'Système de gestion des dossiers du programme ISET de l’AFAC',
      lead: "Bienvenue dans le système de gestion des dossiers du programme ISET de l’AFAC. Connectez-vous avec vos identifiants AFAC pour travailler en toute sécurité sur les demandes et dossiers. Besoin d’aide? Communiquez avec l’équipe d’administration du programme ISET de l’AFAC.",
      primaryCta: 'Se connecter pour gérer les programmes de l’AFAC',
      secondaryCta: 'Voir le portail des candidates',
      meta: [
        'Accueil numérique',
        'Studio des flux de travail',
        'Évaluation des demandes',
        'Messagerie sécurisée',
        'Gestion des dossiers',
        'Gestion budgétaire',
        'Rapports',
        'Saisie ARMS'
      ]
    },
    releaseNotes: {
      sectionTitle: 'Notes de version - v0.2.3 (4 décembre 2025)',
      description: 'La version 0.2.3 répond aux premiers commentaires de l’AFAC lors de la première revue de démonstration.',
      features: {
        heading: 'Mises à jour',
        sections: [
          {
            title: 'Correctif v0.2.3 — Alignement du parcours et corrections',
            paragraphs: [
              'Le numéro d’inscription est désormais obligatoire pour les Premières Nations inscrites (10 chiffres). Les personnes sans statut, inuites et métisses ont leur propre champ libre avec consignes adaptées.',
              'La communauté d’origine reprend par défaut l’affiliation fournie dans la déclaration autochtone, tout en restant modifiable.',
              'Nouvelle étape d’admission demandant de détailler les prêts ou bourses d’études reçus.',
              'Statut d’emploi : ajout de « Employé en congé approuvé » et affichage dans les revenus du ménage du widget du formulaire.',
              'Correctif : cliquer sur Retour sur une étape avec erreur de validation efface désormais l’erreur.'
            ]
          },
          {
            title: 'Correctif v0.2.2 — Liste de contrôle des documents',
            paragraphs: [
              'La liste de contrôle des documents est disponible dans l’espace de travail Évaluation des demandes; les évaluatrices peuvent marquer les éléments comme requis, reçus ou dispensés directement dans le dossier.',
              'Les statuts des éléments restent en place lorsque vous changez d’onglet pour éviter de perdre le travail en cours.',
              'Des notes en ligne expliquent pourquoi un document est dispensé ou indiquent les suivis nécessaires avant une décision.',
              'Les totaux requis vs complétés montrent rapidement ce qui bloque encore l’approbation.'
            ]
          },
          {
            title: 'Version 0.2.0 — Gestion des dossiers',
            paragraphs: [
              'Ajout du module de gestion des dossiers avec espace de travail et panneaux (messagerie sécurisée, documents, notes/tâches, calendrier, plans d’action, interventions, finance, conformité, aperçu d’export).',
              'Mise en page réinitialisable et aide rapide dans chaque panneau.'
            ]
          },
          {
            title: 'Correctif v0.1.5 — Échafaudage du portefeuille de dossiers',
            paragraphs: [
              'Préparation des tableaux de bord « Portefeuille de dossiers » et « Espace de travail du dossier » avec panneaux configurables et contrôles d’accès mis à jour.'
            ]
          },
          {
            title: 'Correctif v0.1.4 — Corrections de bogues',
            paragraphs: [
              'Réactivation du lien « Mot de passe oublié » et capture fiable des événements « case_watch_removed » dans le portail public.',
              'Corrections pour l’affichage des accents dans la messagerie publique et pour les actions d’approbation/rejet des coordonnatrices et évaluatrices.',
              'Message NAS ajusté et extension du fichier XML EDSC pour inclure l’intervention.'
            ]
          },
          {
            title: 'Correctif v0.1.3 — Préparation EDSC',
            paragraphs: [
              'Prépare le module de soumission vers EDSC avec quatre tableaux de bord (Aperçu, Participantes, Espace de soumission, Rapports).',
              'Validation EDSC 1.4 par participante, y compris la vérification du NAS et la génération d’instantanés XML ILMP.'
            ]
          },
          {
            title: 'Correctif v0.1.2 — Portail public',
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
          {
            title: 'Erreur d’exécution du portail public',
            paragraphs: [
              'Une période d’inactivité peut parfois provoquer une erreur d’exécution sur le portail public. Cela pourrait être lié à des changements en cours de développement, la cause reste inconnue.'
            ]
          },
          { title: 'Verrouillage des dossiers', paragraphs: ['Le verrouillage des enregistrements empêche encore parfois la progression.'] },
          { title: 'Studio des parcours', paragraphs: ['Les vues « organigramme » ne gèrent pas correctement le déplacement ou le zoom, ce qui rend le glisser-déposer instable.'] },
          { title: 'Éditeur d’étapes', paragraphs: ['Le déplacement des composants dans l’aire de travail provoque un scintillement et le point d’insertion demeure flou.'] },
          { title: 'Chaînes françaises par défaut', paragraphs: ['Certains composants d’accueil contiennent un texte français par défaut qui perturbe la traduction pilotée par l’IA.'] },
          { title: 'Assistant IA', paragraphs: ['L’assistant IA n’est pas encore formé sur l’ensemble de la solution et peut sortir du sujet.'] }
        ]
      },
      comingNext: {
        heading: 'À venir bientôt',
        sections: [
          {
            title: 'Prochaines étapes',
            paragraphs: [
              'Intégration de la recherche de communauté d’origine dans le portail public.',
              'Capacité d’accorder à des utilisateurs spécifiques des droits d’approbation (ex. approuver leurs propres interventions).',
              'Module Finances (données factices pour le moment).'
            ]
          }
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
          <div className="landing-hero__banner">
            <Alert
              type="warning"
              header={content.alert.header}
              statusIconAriaLabel="Warning"
            >
              {content.alert.body}
            </Alert>
          </div>
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
                {content.releaseNotes.features.sections.map((section, idx) => (
                  <ExpandableSection
                    key={section.title}
                    headerText={section.title}
                    defaultExpanded={idx === 0}
                    variant="container"
                  >
                    {section.paragraphs.map((text, index) => {
                      const t = typeof text === 'string' ? text.trim() : '';
                      const isSubheading = typeof text === 'string' && t.endsWith(':') && !t.startsWith('-');
                      return (
                        <p key={index}>{isSubheading ? <strong>{text}</strong> : text}</p>
                      );
                    })}
                  </ExpandableSection>
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
        <small>
          &copy; {new Date().getFullYear()} Powered by the{' '}
          <a href="https://www.awentech.ca" target="_blank" rel="noopener noreferrer">Awentech</a> nForm Engine for NWAC. Cloudscape Design interface.
        </small>
      </footer>
    </div>
  );
};

export default LandingPage;
