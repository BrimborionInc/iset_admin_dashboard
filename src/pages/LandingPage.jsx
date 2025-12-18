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
      sectionTitle: 'Release Notes - v0.4.0 (18 Dec 2025)',
      description: 'Release 0.4.1 covers a range of changes including staff-to-staff secure messaging. See the updates.',
      features: {
        heading: 'What’s New',
        sections: [
          {
            title: 'Secure internal messaging',
            paragraphs: [
              'A new secure messaging feature is now available.',
              'Selecting Messages from the side navigation opens an email-style dashboard where you can view, send, and receive messages.',
              'Opening a message displays it in a small, pinned window in the bottom-right corner of the screen.',
              'The message stays open while you move around the system, so you can continue reading or responding while working elsewhere.',
              'Messages can be sent to multiple staff members.'
            ]
          },
          {
            title: 'Improved handling of repeat applications',
            paragraphs: [
              'The system now better supports clients who apply more than once.',
              'When a client submits a subsequent application (for example, a second year of funding), it is treated as a new application.',
              'Once approved, the Case Management view will show multiple cases under the same client profile.',
              'This makes it easy to see a client’s full application and funding history in one place.'
            ]
          },
          {
            title: 'Document checklist now reflects how applications actually work',
            paragraphs: [
              'The document checklist has been redesigned to distinguish between different kinds of documents.',
              'Client-level documents are only checked once and follow the client.',
              'Application-level documents are required for each new application.',
              'For example, EI verification and consent forms are now correctly tied to the application, not reused from earlier submissions.',
              'When a new application is started, the checklist resets appropriately for that application.'
            ]
          },
          {
            title: 'Mandatory document completion before assessment submission',
            paragraphs: [
              'The document checklist now actively enforces completeness.',
              'Assessors cannot submit an assessment to managers or program administrators unless all required documents are present.',
              'This ensures applications are complete before they move forward in the workflow.'
            ]
          },
          {
            title: 'EI verification now requires supporting documents',
            paragraphs: [
              'When performing an EI verification check:',
              'Managers and administrators must now upload the supporting EI status document at the same time as setting eligibility.',
              'This ensures the decision is always backed by documentation.'
            ]
          },
          {
            title: 'Updates to accepted document types',
            paragraphs: [
              'Several improvements have been made to document recognition:',
              'Status Card has been reintroduced as a document type.',
              'Letters of Reference have been added as an alternative.',
              'If a Status Card is not provided, the checklist will now require two Letters of Reference instead.',
              'This supports participants who do not have a Status Card but can confirm Indigenous status through references.'
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
      sectionTitle: 'Notes de version - v0.4.0 (18 décembre 2025)',
      description: 'La version 0.4.1 présente la messagerie sécurisée entre membres du personnel et d’autres améliorations. Consultez les mises à jour.',
      features: {
        heading: 'Quoi de neuf',
        sections: [
          {
            title: 'Messagerie interne sécurisée',
            paragraphs: [
              'Une nouvelle messagerie sécurisée entre membres du personnel est disponible.',
              'Choisir Messages dans la navigation latérale ouvre un tableau de bord type courriel pour voir, envoyer et recevoir des messages.',
              'L’ouverture d’un message l’affiche dans une petite fenêtre épinglée en bas à droite de l’écran.',
              'Le message reste ouvert pendant que vous vous déplacez dans le système, ce qui permet de lire ou de répondre en travaillant ailleurs.',
              'Les messages peuvent être envoyés à plusieurs membres du personnel.'
            ]
          },
          {
            title: 'Meilleure gestion des demandes répétées',
            paragraphs: [
              'Le système gère mieux les clients qui déposent plus d’une demande.',
              'Lorsqu’un client soumet une demande subséquente (p. ex. une deuxième année de financement), elle est traitée comme une nouvelle demande.',
              'Une fois approuvées, la vue Gestion des dossiers affiche plusieurs dossiers sous le même profil client.',
              'Cela permet de voir l’historique complet des demandes et du financement d’un client au même endroit.'
            ]
          },
          {
            title: 'La liste de contrôle reflète la réalité des demandes',
            paragraphs: [
              'La liste de contrôle des documents distingue désormais clairement les types de documents.',
              'Les documents au niveau du client sont vérifiés une seule fois et suivent le client.',
              'Les documents au niveau de la demande sont requis pour chaque nouvelle demande.',
              'Par exemple, la vérification AE et les formulaires de consentement sont correctement liés à la demande, et non réutilisés de soumissions antérieures.',
              'Lorsqu’une nouvelle demande est amorcée, la liste de contrôle se réinitialise pour cette demande.'
            ]
          },
          {
            title: 'Documents obligatoires avant la soumission de l’évaluation',
            paragraphs: [
              'La liste de contrôle des documents applique maintenant la complétude.',
              'Les évaluateurs ne peuvent pas soumettre une évaluation aux gestionnaires ou aux administrateurs de programme tant que tous les documents requis ne sont pas présents.',
              'Cela garantit que les demandes sont complètes avant d’avancer dans le flux de travail.'
            ]
          },
          {
            title: 'La vérification AE exige une pièce justificative',
            paragraphs: [
              'Lors d’une vérification d’assurance-emploi :',
              'Les gestionnaires et administrateurs doivent téléverser le document attestant le statut AE en même temps que la décision d’admissibilité.',
              'Cela garantit que chaque décision est appuyée par une preuve.'
            ]
          },
          {
            title: 'Mise à jour des types de documents acceptés',
            paragraphs: [
              'Plusieurs améliorations ont été apportées à la reconnaissance des documents :',
              'La carte de statut est réintroduite comme type de document.',
              'Les lettres de référence sont ajoutées comme alternative.',
              'Si aucune carte de statut n’est fournie, la liste de contrôle exigera désormais deux lettres de référence.',
              'Cela soutient les participants qui n’ont pas de carte de statut mais peuvent confirmer leur statut autochtone au moyen de références.'
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
