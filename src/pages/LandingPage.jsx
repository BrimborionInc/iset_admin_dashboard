import React from 'react';
import { buildLoginUrl } from '../auth/cognito';
import '../css/awentech-landing.css';
import Alert from '@cloudscape-design/components/alert';
import Button from '@cloudscape-design/components/button';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import heroBackground from '../assets/images/awentech/nwac-hero.png';
import buildInfo from '../generated/buildInfo';
import publicReleaseNotes from '../generated/publicReleaseNotes';

const portalUrl = process.env.REACT_APP_PORTAL_URL || 'http://localhost:3000/';

const copy = {
  en: {
    navItems: [
      { id: 'hero', label: 'Overview' },
      { id: 'support', label: 'Access & Support' },
    ],
    header: {
      brandTitle: 'NWAC PATH',
      signIn: 'Staff sign in',
      languageLabel: 'Switch language'
    },
    hero: {
      eyebrow: "Native Women’s Association of Canada (NWAC)",
      title: 'PATH',
      lead: 'PATH is the NWAC staff system for reviewing ISET applications, managing participant cases, recording services, and completing program reporting.',
      support: 'Sign in with your NWAC staff credentials to continue. If you need access or support, contact the NWAC ISET program admin team.',
      primaryCta: 'Staff sign in',
      secondaryCta: 'Applicant portal',
      meta: [
        'Review applications',
        'Manage participant cases',
        'Record supports and services',
        'Complete NWAC reporting'
      ]
    },
    support: {
      title: 'Access and support',
      description: 'Use the links below to sign in, open the applicant portal, or find the right PATH support path.',
      cards: [
        {
          title: 'Staff sign-in',
          description: 'Sign in with your NWAC staff credentials to continue PATH case-management, reporting, and day-to-day administration work.',
          actionLabel: 'Staff sign in',
          actionType: 'signin'
        },
        {
          title: 'Applicant portal',
          description: 'Open the participant-facing portal when you need the applicant entry point or want to direct applicants to the correct URL.',
          actionLabel: 'Open applicant portal',
          actionType: 'portal'
        },
        {
          title: 'Need help?',
          description: 'For onboarding, access changes, or PATH support, contact the NWAC ISET program admin team.'
        }
      ],
      updatesPrompt: 'Looking for recent changes?',
      updatesAction: 'View release notes'
    },
    footer: {
      heading: 'Need access or support?',
      body: 'Contact the NWAC ISET program admin team for sign-in help, onboarding support, or access changes.',
      primary: 'Staff sign in',
      secondary: 'Applicant portal',
      releaseNotes: 'Release notes'
    }
  },
  fr: {
    navItems: [
      { id: 'hero', label: 'Aperçu' },
      { id: 'support', label: 'Accès et soutien' },
    ],
    header: {
      brandTitle: 'PATH AFAC',
      signIn: 'Connexion du personnel',
      languageLabel: 'Changer de langue'
    },
    hero: {
      eyebrow: 'Association des Femmes Autochtones du Canada (AFAC)',
      title: 'PATH',
      lead: 'PATH est le système du personnel de l’AFAC pour examiner les demandes ISET, gérer les dossiers des participantes, consigner les services et préparer les rapports du programme.',
      support: 'Connectez-vous avec vos identifiants du personnel de l’AFAC pour continuer. Pour l’accès ou le soutien, communiquez avec l’équipe d’administration du programme ISET de l’AFAC.',
      primaryCta: 'Connexion du personnel',
      secondaryCta: 'Portail des candidates',
      meta: [
        'Examiner les demandes',
        'Gérer les dossiers des participantes',
        'Consigner les services et soutiens',
        'Préparer les rapports de l’AFAC'
      ]
    },
    support: {
      title: 'Accès et soutien',
      description: 'Utilisez les liens ci-dessous pour vous connecter, ouvrir le portail des candidates ou trouver le bon point de soutien PATH.',
      cards: [
        {
          title: 'Connexion du personnel',
          description: 'Connectez-vous avec vos identifiants du personnel de l’AFAC pour poursuivre le travail quotidien dans PATH, y compris la gestion des dossiers et les rapports.',
          actionLabel: 'Connexion du personnel',
          actionType: 'signin'
        },
        {
          title: 'Portail des candidates',
          description: 'Ouvrez le portail destiné aux participantes lorsque vous avez besoin du point d’entrée des candidates ou pour les diriger vers la bonne URL.',
          actionLabel: 'Ouvrir le portail des candidates',
          actionType: 'portal'
        },
        {
          title: 'Besoin d’aide?',
          description: 'Pour l’accueil, les changements d’accès ou le soutien PATH, communiquez avec l’équipe d’administration du programme ISET de l’AFAC.'
        }
      ],
      updatesPrompt: 'Vous cherchez les changements récents?',
      updatesAction: 'Voir les notes de version'
    },
    footer: {
      heading: 'Besoin d’accès ou de soutien?',
      body: 'Communiquez avec l’équipe d’administration du programme ISET de l’AFAC pour obtenir de l’aide à la connexion, au démarrage ou aux changements d’accès.',
      primary: 'Connexion du personnel',
      secondary: 'Portail des candidates',
      releaseNotes: 'Notes de version'
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
  const releaseNotes = publicReleaseNotes?.[lang] || publicReleaseNotes?.en || null;
  const [releaseNotesExpanded, setReleaseNotesExpanded] = React.useState(false);
  const pathLogo = `${process.env.PUBLIC_URL || ''}/PATH-Logo.png`;
  const buildStampLabel = React.useMemo(() => {
    const gitLabel = buildInfo?.gitShort
      ? (buildInfo.gitDirty ? `${buildInfo.gitShort}-dirty` : buildInfo.gitShort)
      : '';
    if (buildInfo?.releaseId) {
      return gitLabel ? `Release ${buildInfo.releaseId} | ${gitLabel}` : `Release ${buildInfo.releaseId}`;
    }
    if (buildInfo?.buildTarget) {
      return gitLabel ? `Build ${buildInfo.buildTarget} | ${gitLabel}` : `Build ${buildInfo.buildTarget}`;
    }
    if (gitLabel) {
      return `Build ${gitLabel}`;
    }
    return 'Build information unavailable';
  }, []);
  const releaseNotesTitle = React.useMemo(() => {
    if (!publicReleaseNotes) return '';
    if (lang === 'fr') {
      return `Notes de version - ${publicReleaseNotes.releaseId || 'version courante'} (${publicReleaseNotes.releaseDateFr || ''})`;
    }
    return `Release Notes - ${publicReleaseNotes.releaseId || 'Current build'} (${publicReleaseNotes.releaseDateEn || ''})`;
  }, [lang]);
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

  const handleSupportAction = actionType => {
    if (actionType === 'signin') {
      handleSignIn();
      return;
    }

    if (actionType === 'portal') {
      openPublicPortal();
    }
  };

  const openReleaseNotes = () => {
    setReleaseNotesExpanded(true);
    window.requestAnimationFrame(() => {
      scrollToSection('release-notes');
    });
  };

  return (
    <div className="awentech-landing">
      <header className="landing-header">
        <div className="landing-header__bar" style={{ display: 'flex', alignItems: 'center', gap: '2rem', padding: '0.75rem 2rem', boxShadow: '0 1px 0 rgba(255,255,255,0.05), 0 1px 4px rgba(0,0,0,0.25)' }}>
          <a href="#hero" onClick={e => { e.preventDefault(); scrollToSection('hero'); }} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <img src={brandLogo} alt={lang === 'fr' ? "Logo de l’Association des Femmes Autochtones du Canada" : "Native Women's Association of Canada logo"} style={{ height: 40, width: 'auto', marginRight: '0.75rem' }} />
            <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>{content.header.brandTitle}</span>
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
          {content.alert ? (
            <div className="landing-hero__banner">
              <Alert
                type="warning"
                header={content.alert.header}
                statusIconAriaLabel="Warning"
              >
                {content.alert.body}
              </Alert>
            </div>
          ) : null}
          <div className="landing-hero__content">
            <p className="eyebrow">{content.hero.eyebrow}</p>
            <h1>
              <img className="landing-hero__logo" src={pathLogo} alt={content.hero.title} />
            </h1>
            <p className="lead">{content.hero.lead}</p>
            <p className="support-note">{content.hero.support}</p>
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

        <section id="support" className="landing-section">
          <div className="landing-section__inner landing-section__inner--wide">
            <h2>{content.support.title}</h2>
            <p>
              {content.support.description}
            </p>
            <div className="landing-card-grid">
              {content.support.cards.map(card => (
                <article key={card.title} className="landing-card">
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  {card.actionType ? (
                    <div className="landing-card__actions">
                      <Button variant={card.actionType === 'signin' ? 'primary' : 'normal'} onClick={() => handleSupportAction(card.actionType)}>
                        {card.actionLabel}
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="landing-inline-actions">
              <span>{content.support.updatesPrompt}</span>
              <Button variant="link" onClick={openReleaseNotes}>
                {content.support.updatesAction}
              </Button>
            </div>
          </div>
        </section>

        <section id="release-notes" className="landing-section landing-section--subtle">
          <div className="landing-section__inner landing-section__inner--wide">
            <p className="landing-section__eyebrow">{releaseNotes?.sectionEyebrow || content.support.updatesAction}</p>
            <ExpandableSection
              headerText={releaseNotesTitle}
              expanded={releaseNotesExpanded}
              onChange={({ detail }) => setReleaseNotesExpanded(detail.expanded)}
              variant="container"
            >
              <p className="landing-release-notes__description">
                {releaseNotes?.description || ''}
              </p>
              <div className="landing-card-grid">
                <article className="landing-card">
                  <h3 className="release-notes-heading">{releaseNotes?.featuresHeading || ''}</h3>
                  <ul className="landing-release-notes__list">
                    {(releaseNotes?.features || []).map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="landing-card">
                  <h3 className="release-notes-heading">{releaseNotes?.knownIssuesHeading || ''}</h3>
                  <ul className="landing-release-notes__list">
                    {(releaseNotes?.knownIssues || []).map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="landing-card">
                  <h3 className="release-notes-heading">{releaseNotes?.comingNextHeading || ''}</h3>
                  <ul className="landing-release-notes__list">
                    {(releaseNotes?.comingNext || []).map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </div>
            </ExpandableSection>
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
          &copy; {new Date().getFullYear()} NWAC PATH.
          {' '}
          <button type="button" className="landing-footer__link" onClick={openReleaseNotes}>
            {content.footer.releaseNotes}
          </button>
        </small>
        <small className="landing-footer__version">{buildStampLabel}</small>
      </footer>
    </div>
  );
};

export default LandingPage;
