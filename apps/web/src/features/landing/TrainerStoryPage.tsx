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
              ← Quay lại danh sách Huấn luyện viên
            </Link>
            <div className="fit-trainer-switcher" role="navigation" aria-label="Chọn câu chuyện huấn luyện viên">
              {trainerProfiles.map((item) => (
                <Link
                  key={item.slug}
                  to={`/trainers/${item.slug}`}
                  className={`fit-trainer-switch-pill ${item.slug === trainer.slug ? 'is-active' : ''}`}
                  aria-current={item.slug === trainer.slug ? 'page' : undefined}
                >
                  <span>{item.vietnameseName}</span>
                  <small>{item.name}</small>
                </Link>
              ))}
            </div>
          </div>

          <div key={trainer.slug} className="fit-trainer-hero-grid fit-blur-morph">
            <div className="fit-trainer-portrait-card" data-reveal="image">
              <img
                src={`/images/fitness/${trainer.image}`}
                alt={`${trainer.vietnameseName} — ${trainer.name}`}
              />
              <div className="fit-trainer-portrait-badge">
                <span className="fit-kicker">{trainer.specialty}</span>
                <strong>{trainer.vietnameseName}</strong>
                <span>{trainer.shortRole}</span>
              </div>
            </div>

            <div className="fit-trainer-hero-copy" data-reveal="soft">
              <span className="fit-kicker">CÂU CHUYỆN HUẤN LUYỆN VIÊN · {trainer.name.toUpperCase()}</span>
              <h1 id="trainer-story-title">
                {trainer.vietnameseName}
                <span className="fit-title-dot">.</span>
                <small>{trainer.shortRole}</small>
              </h1>
              <blockquote className="fit-trainer-quote">“{trainer.quote}”</blockquote>
              <p className="fit-trainer-summary">{trainer.introSummary}</p>

              <div className="fit-trainer-stats-row">
                <div className="fit-trainer-stat-box">
                  <strong>{trainer.experienceYears}+ năm</strong>
                  <span>Kinh nghiệm hướng dẫn</span>
                </div>
                <div className="fit-trainer-stat-box">
                  <strong>{trainer.studentsCount}+</strong>
                  <span>Hội viên đã đồng hành</span>
                </div>
                <div className="fit-trainer-stat-box">
                  <strong>{trainer.weeklySessions} buổi</strong>
                  <span>Lớp &amp; ca kèm mỗi tuần</span>
                </div>
              </div>

              <div className="fit-trainer-hero-actions">
                <Link to={joinPath} className="fit-pill">
                  Đăng ký tập cùng {trainer.vietnameseName}
                  <RoundArrow diagonal />
                </Link>
                <Link to="/#schedule" className="fit-text-link">
                  Xem lịch lớp chung <RoundArrow diagonal />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="fit-section fit-trainer-narrative" aria-labelledby="story-narrative-title">
          <div className="fit-trainer-narrative-grid">
            <article className="fit-trainer-story-article" data-reveal="lift">
              <span className="fit-kicker">HÀNH TRÌNH &amp; ĐỘNG LỰC</span>
              <h2 id="story-narrative-title">
                Vì sao {trainer.vietnameseName} chọn cách hướng dẫn gần gũi, dễ bắt đầu<span className="fit-title-dot">.</span>
              </h2>
              <div className="fit-trainer-paragraphs">
                {trainer.storyParagraphs.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
              <div className="fit-trainer-action-banner">
                <img src={trainer.actionImage} alt={`Không gian tập luyện cùng ${trainer.vietnameseName}`} loading="lazy" />
                <div>
                  <span className="fit-kicker">KHÔNG GIAN ĐỒNG HÀNH</span>
                  <strong>{trainer.meta}</strong>
                  <p>Mọi buổi tập đều có thể điều chỉnh linh hoạt theo thể lực thực tế của bạn trong ngày hôm đó.</p>
                </div>
              </div>
            </article>

            <aside className="fit-trainer-milestones" data-reveal="lift" aria-label="Cột mốc hành trình">
              <span className="fit-kicker">CỘT MỐC ĐÁNG NHỚ</span>
              <h3>Hành trình gắn bó cùng học viên</h3>
              <ol className="fit-milestone-list">
                {trainer.milestones.map((item) => (
                  <li key={item.title} className="fit-milestone-item">
                    <span className="fit-milestone-tag">{item.year}</span>
                    <h4>{item.title}</h4>
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ol>

              <div className="fit-trainer-specialty-box">
                <span className="fit-kicker">NHÓM MỤC TIÊU PHỤ TRÁCH</span>
                <ul>
                  {trainer.specialties.map((spec) => (
                    <li key={spec}>
                      <span aria-hidden="true">✓</span>
                      {spec}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>

        <section className="fit-section fit-trainer-routine" aria-labelledby="trainer-routine-title">
          <div className="fit-section-heading fit-centered" data-reveal="soft">
            <span className="fit-kicker">BUỔI TẬP ĐẦU TIÊN DIỄN RA NHƯ THẾ NÀO?</span>
            <h2 id="trainer-routine-title">
              3 Bước Làm Quen Nhẹ Nhàng Cùng {trainer.vietnameseName}
              <span className="fit-title-dot">.</span>
            </h2>
            <p>Không áp lực, không bài kiểm tra thể lực nặng nề — mọi thứ bắt đầu từ mức bạn cảm thấy thoải mái nhất.</p>
          </div>

          <div className="fit-trainer-steps-grid">
            {trainer.sessionSteps.map((item) => (
              <article key={item.step} className="fit-trainer-step-card" data-reveal="lift">
                <span className="fit-step-badge">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="fit-section fit-trainer-schedule-section" aria-labelledby="trainer-schedule-title">
          <div className="fit-trainer-schedule-card" data-reveal="lift">
            <div>
              <span className="fit-kicker">LỊCH ĐỨNG LỚP &amp; HƯỚNG DẪN TIÊU BIỂU</span>
              <h2 id="trainer-schedule-title">
                Khung Giờ Gặp {trainer.vietnameseName} Tại Câu Lạc Bộ<span className="fit-title-dot">.</span>
              </h2>
              <p>Bạn có thể tham gia các lớp nhóm cố định hoặc đăng ký lịch hẹn hướng dẫn riêng trong Portal hội viên.</p>
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
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
