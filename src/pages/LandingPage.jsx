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
      body: 'The PATH case management system will be unavailable today from 7:00–8:00 p.m. ET for maintenance. Service will resume once the window is complete.'
    },
    header: {
      signIn: 'Sign in',
      languageLabel: 'Switch language'
    },
    hero: {
      eyebrow: "Native Women’s Association of Canada (NWAC)",
      title: 'PATH',
      lead: "Sign in with your NWAC credentials to work in the ISET case management system. Need help? Contact the NWAC ISET program admin team. Installed modules are listed below.",
      primaryCta: 'Sign in to PATH',
      secondaryCta: "View the applicants' portal",
      meta: [
        'Digital Intake',
        'Application Assessment',
        'Case Management',
        'Secure Messaging',
        'ILMP Reporting',
        'Payments Processing',
        'Budget Management',
        'Financial Reporting',
        'Workflow Studio'
      ]
    },
    releaseNotes: {
      sectionTitle: 'Release Notes - v0.5.2 (13th Feb 2026)',
      description: 'Release 0.5.2 highlights major admin-console enhancements delivered since 12 Jan 2026.',
      features: {
        heading: 'What’s New',
        sections: [
          {
            title: 'Tutorial platform and guided onboarding',
            paragraphs: [
              'Added a centralized tutorials platform with role-aware tours for homepage, application workspace, and case workspace.',
              'Introduced the Tutorials dashboard under Support so staff can run tours and manage progress directly.',
              'Tutorial completion and dismissal now persist per staff member in MySQL and can be reset from the UI.'
            ]
          },
          {
            title: 'Payments and finance workflow upgrades',
            paragraphs: [
              'Case workspace approvals now auto-create draft payment packets from proposed intervention cost lines.',
              'Packet validation and queue/detail views now reflect Sage Intacct submission outcomes and resubmission handling.',
              'Finance settings now include Sage Intacct integration controls and improved XML draft preview behavior.'
            ]
          },
          {
            title: 'Assessment and intervention management improvements',
            paragraphs: [
              'Proposed Interventions and coordinator assessment workflows now support robust multi-intervention costing with line-item persistence.',
              'Decision, validation, and save behavior were hardened to reduce dead ends and improve reliability in assessment progression.',
              'Approved interventions now enforce budget-pot linkage so downstream finance transactions are generated consistently.'
            ]
          },
          {
            title: 'Configuration and admin tooling',
            paragraphs: [
              'Added a Query Editor dashboard for System Administrators with SQL execution controls and multi-view results.',
              'Added a Document Checklists configuration widget to manage required documents by status gate for applications and interventions.',
              'Regional Manager scope now supports multi-region behavior in development workflows.'
            ]
          },
          {
            title: 'Workspace and role-based UX updates',
            paragraphs: [
              'Homepage and workspace guidance, labels, and help content were aligned with current queue-based operations.',
              'Case and application workspace layouts now reset appropriately for tutorial and hotspot-dependent flows.',
              'Role handling and prompt logic were updated so onboarding behaviors remain consistent across role aliases.'
            ]
          },
        ]
      },
      knownBugs: {
        heading: 'Known Bugs',
        sections: []
      },
      comingNext: {
        heading: 'Coming Soon',
        sections: []
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
      body: 'Le système PATH sera indisponible aujourd’hui de 19 h à 20 h (HE) pour entretien. Le service reprendra après la fenêtre de maintenance.'
    },
    header: {
      signIn: 'Se connecter',
      languageLabel: 'Changer de langue'
    },
    hero: {
      eyebrow: 'Association des Femmes Autochtones du Canada (AFAC)',
      title: 'PATH',
      lead: "Bienvenue dans le système de gestion des dossiers ISET de l’AFAC. Connectez-vous avec vos identifiants AFAC pour travailler en toute sécurité sur les demandes et dossiers. Besoin d’aide? Communiquez avec l’équipe d’administration du programme ISET de l’AFAC.",
      primaryCta: 'Se connecter pour gérer les programmes de l’AFAC',
      secondaryCta: 'Voir le portail des candidates',
      meta: [
        'Accueil numérique',
        'Évaluation des demandes',
        'Gestion des dossiers',
        'Messagerie sécurisée',
        'Rapports ILMP',
        'Traitement des paiements',
        'Gestion budgétaire',
        'Rapports financiers',
        'Studio des flux de travail'
      ]
    },
    releaseNotes: {
      sectionTitle: 'Notes de version - v0.5.2 (13 février 2026)',
      description: 'La version 0.5.2 met en évidence les principales améliorations de la console admin livrées depuis le 12 janvier 2026.',
      features: {
        heading: 'Quoi de neuf',
        sections: [
          {
            title: 'Plateforme de tutoriels et intégration guidée',
            paragraphs: [
              'Ajout d’une plateforme de tutoriels centralisée avec des parcours par rôle pour l’accueil, l’espace demande et l’espace dossier.',
              'Ajout du tableau de bord des tutoriels dans Soutien pour lancer les parcours et gérer l’état de progression.',
              'La complétion et la mise en sourdine des tutoriels sont maintenant enregistrées par membre du personnel dans MySQL avec réinitialisation en libre-service.'
            ]
          },
          {
            title: 'Améliorations des flux paiements et finances',
            paragraphs: [
              'Les approbations dans l’espace dossier créent maintenant automatiquement des paquets de paiement brouillon à partir des lignes de coûts proposées.',
              'La validation des paquets et les vues file/détail reflètent maintenant les résultats de soumission Sage Intacct et la reprise des soumissions.',
              'Les paramètres Finance incluent désormais la configuration d’intégration Sage Intacct et un aperçu XML brouillon amélioré.'
            ]
          },
          {
            title: 'Améliorations évaluation et interventions',
            paragraphs: [
              'Les flux Interventions proposées et évaluation coordonnateur prennent mieux en charge le multi-intervention avec persistance détaillée des coûts.',
              'Les comportements de décision, validation et sauvegarde ont été renforcés pour réduire les blocages dans la progression.',
              'Les interventions approuvées imposent maintenant la liaison au budget d’un plan d’action pour assurer une génération cohérente des transactions financières.'
            ]
          },
          {
            title: 'Configuration et outils administratifs',
            paragraphs: [
              'Ajout d’un tableau de bord Éditeur de requêtes pour les administrateurs système avec exécution SQL contrôlée et plusieurs vues de résultats.',
              'Ajout d’un widget de configuration des listes de contrôle de documents par porte de statut pour les demandes et interventions.',
              'La portée des gestionnaires régionaux prend maintenant en charge le multi-région dans les flux de développement.'
            ]
          },
          {
            title: 'Mises à jour UX des espaces de travail et rôles',
            paragraphs: [
              'Le contenu d’aide, les libellés et les indications d’accueil/espaces de travail ont été alignés avec les opérations actuelles basées sur les files.',
              'Les dispositions d’écran des espaces demande et dossier se réinitialisent correctement pour les parcours tutoriels et points d’ancrage.',
              'La gestion des rôles et des invites a été renforcée pour garder des comportements d’intégration cohérents malgré les alias de rôles.'
            ]
          }
        ]
      },
      knownBugs: {
        heading: 'Bugs connus',
        sections: []
      },
      comingNext: {
        heading: 'À venir bientôt',
        sections: []
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
  const pathLogo = `${process.env.PUBLIC_URL || ''}/PATH-Logo.png`;
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
            <h1>
              <img className="landing-hero__logo" src={pathLogo} alt={content.hero.title} />
            </h1>
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
