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
    { id: 'release-notes', label: 'Release Notes' },
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
                View the applicants' portal
              </button>
            </div>
            <div className="landing-hero__meta">
              <span>Secure access with Cognito IAM</span>
              <span>WCAG AA compliant applicant journeys</span>
              <span>Integrated reporting &amp; notifications</span>
            </div>
          </div>
        </section>

        <section id="release-notes" className="landing-implementations landing-section">
          <h2>Release Notes - Patch v0.1.0</h2>
          <p className="description">
            The latest patch updates keep administrators informed about what changed, what issues remain, and what is coming next.
          </p>
          <div className="landing-card-grid">
            <article className="landing-card">
              <h3 className="release-notes-heading">Features</h3>
              <div className="release-notes-sections">
                <section>
                  <h4>Case Management</h4>
                  <p>Intake submissions flow in from the public portal with notifications targeted to the responsible role.</p>
                  <p>Program Administrators and Regional Coordinators assign applications through routing controls aligned to their teams.</p>
                  <p>The dashboard holds the overview, application record, assessment form, secure messaging, supporting documents, event log, and status controls.</p>
                  <p>Overdue checks raise alerts whenever an application stalls at any stage.</p>
                </section>
                <section>
                  <h4>Intake Workflow Studio</h4>
                  <p>Editors assemble intake steps from reusable components.</p>
                  <p>Validation rules and controls enforce required data before submission.</p>
                  <p>AI assists with step wording, edits, and bilingual translation between French and English.</p>
                  <p>Conditional fields, summary pages, and rules-based file uploads adapt the form to applicant responses.</p>
                  <p>The workflow editor supports linear, conditional, and branching paths with testing, preview, and publication tools.</p>
                </section>
                <section>
                  <h4>Secure Messaging</h4>
                  <p>Secure messaging links applicants and the ISET team within each case.</p>
                  <p>Every application keeps a dedicated inbox so the full thread stays together.</p>
                  <p>Uploaded attachments store against the applicant record and remain available to staff.</p>
                </section>
                <section>
                  <h4>Configuration</h4>
                  <p>Configure AI defaults, parameters, and fallback providers for guidance tools.</p>
                  <p>Manage MFA mode, session timeouts, SSO providers, and federation sync.</p>
                  <p>Set SLA targets across lifecycle stages and maintain notification templates for reminders, channels, acknowledgements, and language fallbacks.</p>
                  <p>Adjust allowed origins, demo toolbar visibility, appearance preferences, and monitor required secrets.</p>
                </section>
                <section>
                  <h4>Security</h4>
                  <p>AWS Cognito sign-on with access control matrix enforcement covers role-based authorization.</p>
                  <p>Session auditing and event logging record system access.</p>
                  <p>Databases, document stores, and configuration secrets stay encrypted with KMS-managed keys.</p>
                  <p>CORS allowlists, TLS enforcement, and certificate management harden the perimeter.</p>
                </section>
              </div>
            </article>
            <article className="landing-card">
              <h3 className="release-notes-heading">Known Bugs</h3>
              <div className="release-notes-sections">
                <section>
                  <h4>Workflow Studio</h4>
                  <p>The "flowchart" views do not pan or zoom consistently, making drag interactions unreliable.</p>
                </section>
                <section>
                  <h4>Intake Step Editor</h4>
                  <p>Dragging components within the workspace causes flicker and the insertion point is unclear.</p>
                </section>
                <section>
                  <h4>Notification Settings</h4>
                  <p>Email notifications are currently fixed to account verification, password reset, submission confirmation, and secure message events; the configurable dashboard is inactive.</p>
                </section>
                <section>
                  <h4>Default French Strings</h4>
                  <p>Certain intake components ship with default French text that interferes with AI-driven translation.</p>
                </section>
                <section>
                  <h4>AI Support</h4>
                  <p>The support assistant is not yet fully trained on the solution and can drift off topic.</p>
                </section>
              </div>
            </article>
            <article className="landing-card">
              <h3 className="release-notes-heading">Coming next patch</h3>
              <div className="release-notes-sections">
                <section>
                  <h4>Records Retention and Archiving</h4>
                  <p>Introduce configurable retention, archiving, and disposition policies, backed by warehouse storage, automated record-keeping, and legal hold controls.</p>
                </section>
                <section>
                  <h4>Analytics Dashboard</h4>
                  <p>Deliver a dedicated analytics view with charts, reports, and metrics.</p>
                </section>
                <section>
                  <h4>Release Management</h4>
                  <p>Add enhanced release tooling to stage and control changes to intake workflows.</p>
                </section>
                <section>
                  <h4>Tutorials</h4>
                  <p>Publish guided walkthroughs for each primary function.</p>
                </section>
                <section>
                  <h4>Enhanced Workflow</h4>
                  <p>Strengthen workflow-driven status controls to replace the current manual status updates.</p>
                </section>
              </div>
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
