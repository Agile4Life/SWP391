import { useSourceLanguage, sourceText } from '../../shared/i18n/sourceText';
import { LoadingImage } from '../../shared/ui/LoadingImage';
import { usePublicCatalog, localizeSeededCatalogText } from './publicCatalog';
import { CatalogSchedule, CatalogStatus } from './components/CatalogSections';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getCurrentUser, homePath } from '../../shared/api/client';
import { PublicLayout, RoundArrow } from './components/PublicLayout';
import { DISCIPLINES } from '../../shared/lib/disciplines';
import { SPORT_PAGES, SPORT_PAGE_LIST, sportIdFromPath, type SportPageId } from './sportPages';

/** Trang giới thiệu từng bộ môn phụ kèm chương trình tập và lịch lớp nhóm công khai. */
export function SportPage({ forcedSport }: { forcedSport?: SportPageId }) {
  useSourceLanguage();
  const { sportId } = useParams<{ sportId?: string }>();
  const { pathname } = useLocation();
  const key: SportPageId = forcedSport ?? sportIdFromPath(sportId ? `/sports/${sportId}` : pathname) ?? 'boxing';
  const sport = SPORT_PAGES[key];
  const { catalog, error, retry } = usePublicCatalog();
  const user = getCurrentUser();
  const joinPath = user ? (user.role === 'MEMBER' ? '/member/packages' : homePath(user.role)) : '/register';
  const sportName = DISCIPLINES.find((item) => item.id === sport.id)!.name;
  const classesPath = user
    ? (user.role === 'MEMBER' ? `/member/classes?tab=classes&discipline=${encodeURIComponent(sportName)}` : homePath(user.role))
    : '/login';

  return (
    <PublicLayout>
      <main id="public-main" className="fit-trainer-story-page fit-sport-page">
        <section className="fit-section fit-trainer-story-hero" aria-labelledby="sport-page-title">
          <div className="fit-trainer-story-topbar" data-reveal="soft">
            <Link to="/#multisport" className="fit-text-link fit-back-link">
              {sourceText({ vi: '← Quay lại Trang chủ', en: '← Back to Home' })}
            </Link>
            <div className="fit-trainer-switcher" role="navigation" aria-label={sourceText({ vi: 'Chọn bộ môn', en: 'Choose discipline' })}>
              {SPORT_PAGE_LIST.map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`fit-trainer-switch-pill ${sport.id === item.id ? 'is-active' : ''}`}
                  aria-current={sport.id === item.id ? 'page' : undefined}
                >
                  <span>{item.label}</span>
                  <small>{item.club}</small>
                </Link>
              ))}
            </div>
          </div>

          <div key={sport.id} className="fit-trainer-hero-grid fit-blur-morph">
            <div className="fit-trainer-portrait-card" data-reveal="image">
              <LoadingImage src={sport.image} alt={sport.title} />
            </div>

            <div className="fit-trainer-hero-copy" data-reveal="soft">
              <h1 id="sport-page-title">
                {sport.title}
                <span className="fit-title-dot">.</span>
                <small>{sport.subtitle}</small>
              </h1>

              <div className="fit-sport-page-programs">
                <span className="fit-kicker">{sourceText({ vi: 'CHƯƠNG TRÌNH TẬP LUYỆN', en: 'TRAINING PROGRAMS' })}</span>
                <div className="fit-sport-page-program-grid">
                  {sport.programs.map((prog) => (
                    <article key={prog.code} className="fit-sport-page-program-card">
                      <span className="fit-sport-pillar-code">{prog.code}</span>
                      <h2>{prog.title}</h2>
                      <span className="fit-sport-page-tag">{prog.tag}</span>
                    </article>
                  ))}
                </div>
              </div>

              <div className="fit-trainer-hero-actions">
                <Link to={classesPath} className="fit-pill">
                  {sourceText({ vi: 'Đăng ký lớp ', en: 'Join ' })}{localizeSeededCatalogText(sportName)}
                  <RoundArrow diagonal />
                </Link>
                <Link to={joinPath} className="fit-text-link">
                  {sourceText({ vi: 'Xem gói tập ', en: 'View memberships ' })}<RoundArrow diagonal />
                </Link>
              </div>
            </div>
          </div>

          <div className="fit-sport-schedule-wrap" data-reveal="soft">
            {catalog ? <CatalogSchedule catalog={catalog} sport={sport.id} joinPath={classesPath} /> : <CatalogStatus loading={!error} retry={retry} />}
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
