import React from 'react';
import { buildLoginUrl } from '../auth/cognito';
import '../css/awentech-landing.css';
import heroBackground from '../assets/images/awentech/hero-background.png';

const LandingPage = () => {
  const handleSignIn = () => {
    window.location.assign(buildLoginUrl());
  };

  const brandLogo = `${process.env.PUBLIC_URL || ''}/nwac-logo.png`;

  const openPublicPortal = () => {
    window.open('http://localhost:3000/', '_blank', 'noopener,noreferrer');
  };

  const scrollToSection = (id) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navItems = [
    { id: 'hero', label: 'Overview' },
    { id: 'capabilities', label: 'Capabilities' },
    { id: 'resources', label: 'Resources' },
    { id: 'contact', label: 'Support' },
  ];

  return (
    <div className="awentech-landing">
      <header className="landing-header">
        <div className="landing-header__brand">
          <img src={brandLogo} alt="Native Women's Association of Canada logo" />
          <span>NWAC Admin Dashboard</span>
        </div>
        <nav className="landing-header__nav">
          {navItems.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(event) => {
                event.preventDefault();
                scrollToSection(id);
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <button type="button" className="landing-header__signin" onClick={handleSignIn}>
          Sign in
        </button>
      </header>

      <main>
        <section
          id="hero"
          className="landing-hero"
          style={{ backgroundImage: `url(${heroBackground})` }}
        >
          <div className="landing-hero__overlay" />
          <div className="landing-hero__content">
            <p className="eyebrow">Native Women's Association of Canada (NWAC)</p>
            <h1>NWAC ISET Program intake &amp; assessment portal</h1>
            <p className="lead">
              This is the welcome page of the NWAC ISET Program digital intake and application assessment portal.
              The NWAC Admin Dashboard brings ISET intake, case management, and compliance tracking into a single Cloudscape experience.
              Built on Awentech's secure forms platform, administrators can orchestrate workflow design, coordinate assessment reviews,
              and collaborate with regional delivery teams from one place.
            </p>
            <div className="landing-hero__actions">
              <button type="button" className="primary" onClick={handleSignIn}>
                Sign in to manage NWAC programs
              </button>
              <button type="button" className="secondary" onClick={openPublicPortal}>
                Open the public portal
              </button>
            </div>
            <div className="landing-hero__meta">
              <span>Secure access with Cognito IAM</span>
              <span>WCAG AA compliant applicant journeys</span>
              <span>Integrated reporting &amp; notifications</span>
            </div>
          </div>
        </section>

        <section id="capabilities" className="landing-implementations landing-section">
          <h2>Capabilities tailored for NWAC operations</h2>
          <p className="description">
            Every module in the dashboard maps to a live operational requirement - from intake configuration and case assignment to security governance and regional reporting.
          </p>
          <div className="landing-card-grid">
            <article className="landing-card">
              <h3>Intake Workflow Studio</h3>
              <p>
                Design, test, and publish intake steps with reusable components. Apply governance with Role Matrix controls and preview the applicant experience before rollout.
              </p>
            </article>
            <article className="landing-card">
              <h3>Assessment &amp; Case Coordination</h3>
              <p>
                Track appeals through Assessment Review, Case Assignment, and Application dashboards. Surface decision history, manage supporting materials, and route tasks to the right NWAC reviewers.
              </p>
            </article>
            <article className="landing-card">
              <h3>Secure Messaging &amp; Document Exchange</h3>
              <p>
                Coordinate with applicants and regional delivery teams through Secure Client Messaging, request uploads, and maintain an audit trail for every file and conversation.
              </p>
            </article>
          </div>
        </section>

        <section id="resources" className="landing-section landing-section--alt">
          <div className="landing-section__inner">
            <h2>Built for collaborative delivery</h2>
            <p>
              The admin console reuses the same primitives that power the public applicant portal, ensuring parity between what applicants submit and how administrators action requests.
            </p>
            <div className="landing-resource-grid">
              <div className="landing-resource-card">
                <h4>Environment aware</h4>
                <p>
                  Toggle between sandbox and production data sources without code changes. Session state persists across deployments for smooth demonstrations.
                </p>
              </div>
              <div className="landing-resource-card">
                <h4>Secure by design</h4>
                <p>
                  AWS Cognito backed authentication, fine-grained role enforcement, and event capture hooks keep program data auditable and access-controlled.
                </p>
              </div>
              <div className="landing-resource-card">
                <h4>Extensible platform</h4>
                <p>
                  Compose new widgets, automate notifications, or plug in analytics sources using the existing Cloudscape component library and API clients.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer id="contact" className="landing-footer">
        <div className="landing-footer__content">
          <div>
            <strong>Need access?</strong>
            <p>Contact the NWAC program administration team to request credentials or onboarding support.</p>
          </div>
          <div className="landing-footer__actions">
            <button type="button" className="secondary" onClick={openPublicPortal}>
              View applicant experience
            </button>
            <button type="button" className="primary" onClick={handleSignIn}>
              Sign in
            </button>
          </div>
        </div>
        <small>&copy; {new Date().getFullYear()} Awentech platform for NWAC. Cloudscape Design interface.</small>
      </footer>
    </div>
  );
};

export default LandingPage;
