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
      sectionTitle: 'Release Notes - v0.5.5 (18th March 2026)',
      description: 'Release 0.5.5 improves continuity between intake, assessment, and case management, with stronger intervention revision workflows and clearer participant-facing documents.',
      features: {
        heading: 'What’s New',
        sections: [
          {
            title: 'Funding forms now begin earlier in intake',
            paragraphs: [
              'The Client Acknowledgement of Funding Source is now collected during intake as part of the application process, rather than being requested later after approval.',
              'Other Funding Sources now include Student Loan / Canada aid, with a required student loan statement upload when that option is selected.',
              'This brings key funding evidence forward and reduces document follow-up later in the workflow.'
            ]
          },
          {
            title: 'Student loan coordination is more detailed',
            paragraphs: [
              'Student-loan documentation and lender-facing letters now support a more detailed breakdown of debt, improving coordination with loan providers and funders.',
              'PATH also captures loan-provider / servicer details more cleanly so account-specific information can flow through to the right documents and follow-up steps.',
              'This makes student-loan support easier to review, approve, and communicate accurately.'
            ]
          },
          {
            title: 'Action plans and ineligible reporting are clearer',
            paragraphs: [
              'The first Action Plan now uses a clearer, more appropriate name so the participant journey reads more naturally from the start of service delivery.',
              'When an application is deemed ineligible, PATH still creates the Action Plan and Career Assessment intervention needed for ESDC reporting, then closes them automatically with the appropriate reporting status.',
              'This keeps operational records clearer while preserving the reporting trail NWAC needs.'
            ]
          },
          {
            title: 'Approved interventions can now return to assessment',
            paragraphs: [
              'Case managers can now start Revise approved intervention from Case Workspace and move approved intervention work back into assessment-style review.',
              'The approved record stays in place until the revision is approved, while the new revision draft moves through the gated workflow again with supporting document and checklist controls.',
              'Where funding changes are approved, PATH can issue revised participant documents, including red-line funding agreements that show what changed.'
            ]
          },
          {
            title: 'Public portal language and presentation have been softened',
            paragraphs: [
              'Applicant-facing wording and presentation have been reviewed to feel warmer, clearer, and less transactional.',
              'The portal now presents participant documents more formally, including a more visible My documents experience once documents are available.',
              'This helps participants understand what is needed from them without the portal feeling abrupt or overly administrative.'
            ]
          },
        ]
      },
      knownBugs: {
        heading: 'Known Bugs',
        sections: [
          {
            title: 'No major release blockers logged',
            paragraphs: [
              'No major release-blocking issues are currently logged for v0.5.5.',
              'If staff identify workflow, document, or reporting issues during day-to-day use, they should continue to log them with the NWAC PATH support team for review.'
            ]
          }
        ]
      },
      comingNext: {
        heading: 'Coming Soon',
        sections: [
          {
            title: 'NWAC HQ reporting dashboard',
            paragraphs: [
              'A reporting dashboard for NWAC HQ administrators is planned next, based on the existing spreadsheet reporting model.',
              'The intent is an analytics-style dashboard with slice-and-dice filtering, homepage call-outs, and a standard set of operational reports available directly inside PATH.'
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
      sectionTitle: 'Notes de version - v0.5.5 (18 mars 2026)',
      description: 'La version 0.5.5 améliore la continuité entre l’accueil, l’évaluation et la gestion des dossiers, avec un meilleur traitement des révisions d’intervention et des documents plus clairs pour les participantes.',
      features: {
        heading: 'Quoi de neuf',
        sections: [
          {
            title: 'Les formulaires de financement commencent maintenant dès l’accueil',
            paragraphs: [
              'L’Accusé de financement est maintenant recueilli dès le processus d’accueil, au lieu d’être demandé plus tard après l’approbation.',
              'Les autres sources de financement incluent maintenant Prêt étudiant / aide canadienne, avec téléversement obligatoire du relevé de prêt lorsque cette option est sélectionnée.',
              'Les pièces justificatives de financement sont ainsi recueillies plus tôt et nécessitent moins de suivi par la suite.'
            ]
          },
          {
            title: 'La coordination des prêts étudiants est plus détaillée',
            paragraphs: [
              'La documentation liée aux prêts étudiants et les lettres destinées aux prêteurs prennent maintenant en charge une ventilation plus détaillée de la dette.',
              'PATH saisit aussi plus clairement les renseignements sur le prêteur ou le service de prêt afin que ces détails soient repris correctement dans les documents et suivis.',
              'Cela facilite l’examen, l’approbation et la communication des soutiens liés aux prêts étudiants.'
            ]
          },
          {
            title: 'Les plans d’action et le suivi des inéligibilités sont plus clairs',
            paragraphs: [
              'Le premier plan d’action porte maintenant un nom plus clair et plus approprié pour mieux refléter le début du parcours de la participante.',
              'Lorsqu’une demande est jugée inadmissible, PATH crée quand même le plan d’action et l’intervention d’évaluation de carrière requis pour les rapports ESDC, puis les ferme automatiquement avec le bon statut de rapport.',
              'Les dossiers demeurent ainsi cohérents sur le plan opérationnel tout en répondant aux besoins de reddition de comptes de l’AFAC.'
            ]
          },
          {
            title: 'Les interventions approuvées peuvent maintenant retourner en évaluation',
            paragraphs: [
              'Les gestionnaires de cas peuvent maintenant utiliser Réviser l’intervention approuvée dans l’espace de travail du dossier afin de renvoyer une intervention approuvée dans un flux de réévaluation.',
              'Le dossier approuvé demeure en place jusqu’à l’approbation de la révision, pendant que le brouillon révisé repasse par les étapes contrôlées et les vérifications documentaires.',
              'Lorsque des changements de financement sont approuvés, PATH peut aussi produire des documents révisés pour la participante, y compris des ententes de financement en mode révision annotée.'
            ]
          },
          {
            title: 'Le langage et la présentation du portail public ont été adoucis',
            paragraphs: [
              'Le texte et la présentation destinés aux participantes ont été revus pour être plus chaleureux, plus clairs et moins transactionnels.',
              'Le portail présente maintenant les documents de façon plus formelle, notamment avec une expérience Mes documents plus visible lorsque des documents sont disponibles.',
              'Les participantes comprennent ainsi plus facilement ce qui est attendu d’elles, sans que le portail paraisse brusque ou trop administratif.'
            ]
          }
        ]
      },
      knownBugs: {
        heading: 'Bugs connus',
        sections: [
          {
            title: 'Aucun bloqueur majeur consigné',
            paragraphs: [
              'Aucun problème bloquant majeur n’est actuellement consigné pour la version 0.5.5.',
              'Si le personnel constate des problèmes de flux de travail, de documents ou de rapports, ils doivent continuer de les signaler à l’équipe de soutien PATH de l’AFAC.'
            ]
          }
        ]
      },
      comingNext: {
        heading: 'À venir bientôt',
        sections: [
          {
            title: 'Tableau de bord de rapports pour le siège social de l’AFAC',
            paragraphs: [
              'La prochaine amélioration majeure prévue est un tableau de bord de rapports pour les administratrices du siège social de l’AFAC, basé sur le modèle actuel de rapport par feuille de calcul.',
              'L’objectif est d’offrir un tableau de bord analytique avec filtres dynamiques, indicateurs visibles sur la page d’accueil et un ensemble de rapports opérationnels standards accessibles directement dans PATH.'
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
