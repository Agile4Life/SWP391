import '../landing/landing.css';
import { Link } from 'react-router-dom';
import { LuxuryLoginForm } from './LuxuryLoginForm';
import { LANDING_IMAGES } from '../landing/assets/images';
import { SiteFooter } from '../landing/components/SiteFooter';
import { CustomCursor } from '../landing/components/CustomCursor';

export function LoginPage() {
  return (
    <div className="sol-page-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <CustomCursor />
      {/* Top Header Matching Main Website Navbar */}
      <header
        className="sol-fixed-navbar scrolled"
        style={{
          position: 'sticky',
          top: 0,
          background: 'rgba(250, 248, 245, 0.96)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--color-border-subtle)',
          padding: '0 56px',
        }}
      >
        <Link to="/" className="aura-brand-mark" viewTransition>
          SÖL WELLNESS SANCTUARY
        </Link>

        <nav className="aura-nav-links" aria-label="Portal Header Navigation">
          <Link to="/#about" className="aura-nav-link">
            PHILOSOPHY
          </Link>
          <Link to="/#disciplines" className="aura-nav-link">
            DISCIPLINES
          </Link>
          <Link to="/#packages" className="aura-nav-link">
            MEMBERSHIP
          </Link>
          <Link to="/#contact" className="aura-nav-link">
            CONTACT
          </Link>
        </nav>

        <Link
          to="/"
          viewTransition
          className="aura-portal-btn"
        >
          ← VỀ TRANG CHỦ
        </Link>
      </header>

      {/* Main Login Stage Matching Editorial Split Layout */}
      <main className="auth-stage">
        <div className="auth-split-grid">
          {/* Left Column: Atmospheric Architectural Imagery & Philosophy */}
          <div>
            <h1
              className="editorial-headline"
              style={{
                fontSize: 'clamp(2.6rem, 4.4vw, 4rem)',
                lineHeight: 1.05,
                marginBottom: '32px',
              }}
            >
              ENTER THE{' '}
              <span className="editorial-flourish" style={{ fontStyle: 'italic', fontWeight: 300 }}>
                Sanctuary
              </span>
            </h1>

            {/* Architectural Visual Plinth */}
            <div
              className="image-card-wrapper"
              style={{
                height: '320px',
                borderRadius: '4px',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.08)',
                marginBottom: '28px',
              }}
            >
              <img
                src={LANDING_IMAGES.aboutPrimary}
                alt="Sanctuary Movement Architecture"
                loading="lazy"
              />
            </div>
          </div>

          {/* Right Column: Quiet Luxury Login Form */}
          <div>
            <LuxuryLoginForm />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}