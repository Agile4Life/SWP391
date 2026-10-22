import { Link, useParams } from 'react-router-dom';
import { getCurrentUser, homePath } from '../../shared/api/client';
import { PublicLayout, RoundArrow } from './components/PublicLayout';
import { getTrainerBySlug, trainerProfiles } from './data/trainersData';

export function TrainerStoryPage() {
  const { trainerId } = useParams<{ trainerId?: string }>();
  const trainer = getTrainerBySlug(trainerId);
  const user = getCurrentUser();
  const joinPath = user ? (user.role === 'MEMBER' ? '/member/packages' : homePath(user.role)) : '/register';

  return (
    <PublicLayout>
      <main id="public-main" className="fit-trainer-story-page">
        <section className="fit-section fit-trainer-story-hero" aria-labelledby="trainer-story-title">
          <div className="fit-trainer-story-topbar" data-reveal="soft">
            <Link to="/#trainers" className="fit-text-link fit-back-link">
              ← Quay lại Huấn luyện viên
            </Link>
            <div className="fit-trainer-switcher" role="navigation" aria-label="Chọn huấn luyện viên">
              {trainerProfiles.map((item) => (
                <Link
                  key={item.slug}
                  to={`/trainers/${item.slug}`}
                  className={`fit-trainer-switch-pill ${item.slug === trainer.slug ? 'is-active' : ''}`}
                  aria-current={item.slug === trainer.slug ? 'page' : undefined}
                >
                  <span>{item.personName}</span>
                  <small>{item.name}</small>
                </Link>
              ))}
            </div>
          </div>

          <div key={trainer.slug} className="fit-trainer-hero-grid fit-blur-morph">
            <div className="fit-trainer-portrait-card" data-reveal="image">
              <img
                src={`/images/fitness/${trainer.image}`}
                alt={`${trainer.personName} — ${trainer.name}`}
              />
              <div className="fit-trainer-portrait-badge">
                <span className="fit-kicker">{trainer.specialty}</span>
                <strong>{trainer.personName}</strong>
                <span>{trainer.shortRole}</span>
              </div>
            </div>

            <div className="fit-trainer-hero-copy" data-reveal="soft">
              <span className="fit-kicker">{trainer.specialty}</span>
              <h1 id="trainer-story-title">
                {trainer.personName}
                <span className="fit-title-dot">.</span>
                <small>{trainer.name} · {trainer.shortRole}</small>
              </h1>
              <blockquote className="fit-trainer-quote">“{trainer.quote}”</blockquote>

              <div className="fit-trainer-stats-row">
                <div className="fit-trainer-stat-box">
                  <strong>{trainer.experienceYears}+ năm</strong>
                  <span>Kinh nghiệm</span>
                </div>
                <div className="fit-trainer-stat-box">
                  <strong>{trainer.studentsCount}+</strong>
                  <span>Học viên</span>
                </div>
                <div className="fit-trainer-stat-box">
                  <strong>{trainer.weeklySessions} buổi</strong>
                  <span>Mỗi tuần</span>
                </div>
              </div>

              <div className="fit-trainer-specialty-box">
                <span className="fit-kicker">CHUYÊN MÔN PHỤ TRÁCH</span>
                <ul>
                  {trainer.specialties.map((spec) => (
                    <li key={spec}>
                      <span aria-hidden="true">✓</span>
                      {spec}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="fit-trainer-schedule-list">
                {trainer.schedulePreview.map((slot) => (
                  <div key={`${slot.day}-${slot.time}`} className="fit-trainer-slot-item">
                    <div>
                      <span className="fit-schedule-time">{slot.day} · {slot.time}</span>
                      <h3>{slot.className}</h3>
                    </div>
                    <span className="fit-schedule-spots">{slot.zone}</span>
                  </div>
                ))}
              </div>

              <div className="fit-trainer-hero-actions">
                <Link to={joinPath} className="fit-pill">
                  Đăng ký tập cùng {trainer.personName}
                  <RoundArrow diagonal />
                </Link>
                <Link to="/#schedule" className="fit-text-link">
                  Xem lịch lớp <RoundArrow diagonal />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
