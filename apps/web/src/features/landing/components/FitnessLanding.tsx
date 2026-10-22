import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentUser, homePath } from '../../../shared/api/client';
import { RoundArrow } from './PublicLayout';

const services = [
  { title: 'WeightLifting', description: 'Xây nền thể lực, cải thiện sức bền. Tiến bộ từ những chuyển động cơ bản, vững vàng trong từng buổi tập.', icon: 'weights' },
  { title: 'Private Training', description: 'Một mục tiêu riêng. Một lộ trình riêng. Tập đúng kỹ thuật cùng người hướng dẫn, bền bỉ theo nhịp độ của bạn.', icon: 'training' },
  { title: 'Build Muscle', description: 'Tập đúng kỹ thuật, bền bỉ từng ngày. Phát triển cơ bắp và xây dựng phiên bản mạnh mẽ hơn.', icon: 'muscle' },
];
const serviceShapes = [
  'M37 30L259 0Q290-2 295 32L319 231Q323 280 279 280H72Q33 280 27 241L1 80Q-5 40 37 30Z',
  'M42 0H278Q322 0 316 44L294 242Q290 280 251 280H69Q30 280 26 242L4 44Q-2 0 42 0Z',
  'M61 0L283 30Q325 40 319 80L293 241Q287 280 248 280H41Q-3 280 1 231L25 32Q30-2 61 0Z',
];
const stories = [
  { name: 'Derek', image: 'coach-strength.png', quote: 'Kỷ luật bắt đầu từ việc có mặt. Mỗi ngày, thêm một chút tiến bộ.', focus: 'STRENGTH' },
  { name: 'Anthony', image: 'trainer-strength.jpg', quote: 'Tôi tìm được nhịp tập phù hợp và học cách kiên trì với chính mình.', focus: 'CONSISTENCY' },
  { name: 'Jhon', image: 'strength-session.jpg', quote: 'Không chỉ là thay đổi vóc dáng. Tôi thấy khỏe và tự tin hơn.', focus: 'BALANCE' },
  { name: 'Ezekiel', image: 'hero-athlete.png', quote: 'Có người đồng hành giúp tôi đi đúng hướng trong từng buổi tập.', focus: 'PROGRESS' },
];
const trainers = [
  { name: 'Strength coach', specialty: 'SỨC MẠNH & THỂ LỰC', image: 'coach-strength.png' },
  { name: 'Movement coach', specialty: 'CHUYỂN ĐỘNG & CÂN BẰNG', image: 'coach-movement.png' },
  { name: 'Personal coach', specialty: 'HUẤN LUYỆN CÁ NHÂN', image: 'strength-session.jpg' },
];
const spaces = [
  { title: 'Không gian cho những mục tiêu lớn.', image: '/images/fitness/gym-floor.jpg', label: 'Strength floor' },
  { title: 'Tập trung vào từng chuyển động.', image: '/images/fitness/strength-session.jpg', label: 'Free weights' },
  { title: 'Tìm lại nhịp điệu của chính mình.', image: '/images/pilates-reformer-studio.jpg', label: 'Movement studio' },
];
const plans = [
  { period: 'Tháng', name: 'The Essential', price: '2.800.000', duration: '30 ngày', description: 'Bắt đầu thói quen tập luyện với một lựa chọn linh hoạt.', perks: ['Không gian tập Gym & Cardio', 'Các lớp học nhóm cơ bản', 'Thẻ hội viên QR điện tử'] },
  { period: 'Quý', name: 'The Sanctuary', price: '7.500.000', duration: '90 ngày', description: 'Dành thời gian cho mục tiêu và xây dựng nền tảng bền vững.', perks: ['Đa dạng bộ môn tập luyện', 'Lớp học nhóm và studio', 'Theo dõi lịch tập tại portal'] },
  { period: 'Năm', name: 'The Sovereign', price: '26.000.000', duration: '365 ngày', description: 'Đồng hành dài lâu cùng hành trình nâng cao thể chất.', perks: ['Trải nghiệm các khu tập luyện', 'Lên kế hoạch tập luyện dài hạn', 'Quản lý hội viên tại portal'] },
];

function ServiceIcon({ type }: { type: string }) {
  return <svg className="fit-service-icon" viewBox="0 0 64 64" fill="none" stroke="#805e50" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'weights' ? <>
      <path d="M6 17h52" /><rect x="3" y="10" width="5" height="15" rx="1" fill="#ada59a" /><rect x="10" y="7" width="5" height="21" rx="1" fill="#c8bfb3" /><rect x="49" y="7" width="5" height="21" rx="1" fill="#c8bfb3" /><rect x="56" y="10" width="5" height="15" rx="1" fill="#ada59a" />
      <path d="m26 28-6-5V13h5v7l5 4h4l5-4v-7h5v10l-6 5 1 13H25Z" fill="#ebc18c" /><circle cx="32" cy="18" r="6" fill="#ebc18c" /><path d="M27 14c0-5 10-5 10 0" fill="#705648" /><path d="m25 40-2 10 5 1 4-8 4 8 5-1-2-10Z" fill="#e69e87" /><path d="m23 50-1 10h6l1-9m6 0 1 9h6l-1-10" fill="#ebc18c" /><path d="M21 60h8m6 0h8M29 32h6" />
    </> : type === 'training' ? <>
      <g transform="rotate(-37 34 23)"><path d="M15 22h36v5H15Z" fill="#e6a08a" /><rect x="10" y="15" width="7" height="19" rx="2" fill="#e6907e" /><rect x="4" y="18" width="6" height="13" rx="1" fill="#e6907e" /><rect x="49" y="15" width="7" height="19" rx="2" fill="#e6907e" /><rect x="56" y="18" width="5" height="13" rx="1" fill="#e6907e" /></g>
      <path d="M14 44h34v5H14Z" fill="#e8d6b9" /><rect x="9" y="35" width="7" height="23" rx="2" fill="#ded2c1" /><rect x="3" y="39" width="6" height="15" rx="1" fill="#ded2c1" /><rect x="47" y="35" width="7" height="23" rx="2" fill="#ded2c1" /><rect x="54" y="39" width="6" height="15" rx="1" fill="#ded2c1" />
    </> : <>
      <path d="M12 44c-1-10 2-21 7-29l10 4-5 13c8-8 17-6 21-1l7 8 2 10c-12 8-29 7-42-5Z" fill="#e9c59b" /><path d="m19 15 2-9 9 1 4 8-5 4m-8-4 4-4 4 3M32 34c0 6 4 10 9 10m-22 0c3 3 8 4 12 3M47 44l8-3" />
      <circle cx="48" cy="13" r="10" fill="#edc7a5" /><path d="M48 18s-7-4-5-8c1-2 4-2 5 0 2-2 5-2 6 0 2 4-6 8-6 8Z" fill="#df9785" />
    </>}
  </svg>;
}

export function FitnessLanding() {
  const user = getCurrentUser();
  const joinPath = user ? user.role === 'MEMBER' ? '/member/packages' : homePath(user.role) : '/register';
  const [trainerPage, setTrainerPage] = useState(0);
  const [space, setSpace] = useState(0);
  const [planMode, setPlanMode] = useState<'all' | 'long'>('all');
  return <main id="public-main">
    <section className="fit-hero" id="hero" aria-labelledby="hero-title">
      <div className="fit-hero-lines" aria-hidden="true" />
      <h1 id="hero-title" className="fit-hero-title"><span>BUILD YOUR</span><span>BODY SHAPES<span className="fit-title-dot">.</span></span></h1>
      <div className="fit-hero-copy"><p>Mạnh mẽ từ thể chất.<br />Tự tin từ bên trong.</p><p>Mỗi người một điểm bắt đầu. Tìm cách tập luyện của bạn, cùng SÖL xây dựng một cơ thể khỏe và một tinh thần cân bằng.</p>
        <a href="#stories" className="fit-reviews"><span>Cùng nhau tiến bộ</span><span className="fit-avatar-row">{stories.slice(0, 3).map((story) => <img key={story.name} src={`/images/fitness/${story.image}`} alt="" />)}<span className="fit-review-arrow">↗</span></span><span className="fit-review-label"><span aria-hidden="true">★★★★★</span> Mỗi hành trình đều đáng giá</span></a>
      </div>
      <img className="fit-hero-athlete" src="/images/fitness/hero-athlete.png" alt="Vận động viên ngồi tập tạ đơn, hướng ánh nhìn xuống, trên nền tối" fetchPriority="high" />
      <div className="fit-hero-action"><Link to={joinPath} className="fit-pill">Bắt đầu ngay<RoundArrow /></Link><span>YOUR BODY. YOUR JOURNEY.</span></div>
      <span className="fit-hero-index" aria-hidden="true">01 / THE BEGINNING</span>
    </section>
    <section className="fit-services" id="disciplines" aria-label="Các hình thức tập luyện">
      <div className="fit-services-glow" aria-hidden="true" />
      {services.map((service, index) => <a key={service.title} className={`fit-service fit-service-${index}`} data-reveal="lift" href="#packages"><svg className="fit-service-surface" viewBox="0 0 320 280" preserveAspectRatio="none" aria-hidden="true"><path d={serviceShapes[index]} /></svg><ServiceIcon type={service.icon} /><h2>{service.title}</h2><span className="fit-service-rule" /><p>{service.description}</p></a>)}
    </section>
    <section className="fit-section fit-stories" id="stories" aria-labelledby="stories-title">
      <div className="fit-section-heading fit-centered" data-reveal="soft"><span className="fit-kicker">REAL EFFORT. REAL CHANGE.</span><h2 id="stories-title">Member’s Success<br />Story<span className="fit-title-dot">.</span></h2><p>Những mục tiêu khác nhau. Chung một tinh thần bền bỉ.<br />Tìm động lực cho hành trình của riêng bạn.</p></div>
      <div className="fit-story-grid">{stories.map((story) => <article className="fit-story" data-reveal="lift" key={story.name}><div className="fit-story-photo"><img src={`/images/fitness/${story.image}`} alt={`Ảnh minh họa hành trình ${story.focus.toLowerCase()}`} loading="lazy" /><div><span className="fit-story-focus">{story.focus}</span><h3>{story.name}</h3><span className="fit-stars" aria-label="Minh họa đánh giá 5 sao">★★★★★</span></div></div><p>“{story.quote}”</p></article>)}</div>
      <p className="fit-disclosure">Câu chuyện và hình ảnh minh họa cho bản thiết kế.</p>
    </section>
    <section className="fit-section fit-trainers" id="trainers" aria-labelledby="trainers-title">
      <div className="fit-section-heading" data-reveal="soft"><span className="fit-kicker">BETTER WITH A COACH</span><h2 id="trainers-title">Our Trainers<span className="fit-title-dot">.</span></h2><p>Đúng kỹ thuật. Đúng nhịp độ. Đúng với bạn. Khám phá những cách tập luyện cùng người hướng dẫn, từ nền tảng đến mục tiêu tiếp theo.</p><a href="#contact" className="fit-text-link">Trao đổi về mục tiêu của bạn <RoundArrow diagonal /></a><div className="fit-slider-controls" aria-label="Chọn nhóm huấn luyện">{[0, 1].map((index) => <button key={index} type="button" className={trainerPage === index ? 'is-active' : ''} onClick={() => setTrainerPage(index)} aria-label={`Nhóm huấn luyện ${index + 1}`} aria-pressed={trainerPage === index} />)}</div></div>
      <div className="fit-trainer-grid" key={trainerPage}>{trainers.slice(trainerPage, trainerPage + 2).map((trainer) => <article className="fit-trainer-card" data-reveal="lift" key={trainer.name}><img src={`/images/fitness/${trainer.image}`} alt={`Ảnh minh họa ${trainer.name}`} loading="lazy" /><div><h3>{trainer.name}</h3><p>{trainer.specialty}</p><span>Ảnh minh họa</span></div><RoundArrow diagonal /></article>)}</div>
    </section>
    <section className="fit-section fit-space" id="about" aria-labelledby="space-title"><span id="intelligence" />
      <div className="fit-space-image" data-reveal="image"><img key={spaces[space].image} src={spaces[space].image} alt={spaces[space].title} loading="lazy" /><div className="fit-space-shade" /><div className="fit-space-content"><span className="fit-kicker">A PLACE TO SHOW UP</span><h2 id="space-title">{spaces[space].title}</h2><p>Không gian tập luyện, nguồn năng lượng mới và thời gian dành riêng cho bạn.</p><a className="fit-pill" href="#contact">Ghé thăm SÖL<RoundArrow diagonal /></a></div><div className="fit-space-tabs" aria-label="Khám phá không gian">{spaces.map((item, index) => <button type="button" key={item.label} onClick={() => setSpace(index)} className={space === index ? 'is-active' : ''} aria-pressed={space === index}><img src={item.image} alt="" loading="lazy" /><span>{item.label}</span><span aria-hidden="true">↗</span></button>)}</div><span className="fit-space-number">0{space + 1} / 03</span></div>
    </section>
    <section className="fit-section fit-pricing" id="packages" aria-labelledby="pricing-title"><div className="fit-section-heading fit-centered" data-reveal="soft"><span className="fit-kicker">MAKE TIME FOR YOURSELF</span><h2 id="pricing-title">Membership Pricing<span className="fit-title-dot">.</span></h2><p>Chọn khoảng thời gian phù hợp.<br />Bắt đầu một cam kết với chính mình.</p></div><div className="fit-pricing-switch" data-reveal="soft" aria-label="Lọc thời hạn gói tập"><button type="button" onClick={() => setPlanMode('all')} aria-pressed={planMode === 'all'}>Tất cả gói tập</button><button type="button" onClick={() => setPlanMode('long')} aria-pressed={planMode === 'long'}>Đồng hành dài hạn</button></div>
      <div key={planMode} className={`fit-pricing-grid ${planMode === 'long' ? 'fit-pricing-grid-two' : ''}`}>{plans.filter((_, index) => planMode === 'all' || index > 0).map((plan) => <article key={plan.name} data-reveal="lift" className={`fit-plan ${plan.period === 'Quý' ? 'fit-plan-featured' : ''}`}><span className="fit-plan-period">{plan.period}</span><h3>{plan.name}</h3><p>{plan.description}</p><div className="fit-plan-price">{plan.price}<span>VNĐ / {plan.duration}</span></div><ul>{plan.perks.map((perk) => <li key={perk}><span aria-hidden="true">✓</span>{perk}</li>)}</ul><Link className="fit-pill" to={joinPath}>Tham gia ngay<RoundArrow diagonal /></Link></article>)}</div><p className="fit-disclosure">Giá và quyền lợi tham khảo từ nội dung giới thiệu hiện có. Xem gói đang mở bán trong portal hoặc liên hệ lễ tân để xác nhận.</p>
    </section>
    <section className="fit-final-cta" data-reveal="soft"><span className="fit-kicker">ONE SMALL STEP. A STRONGER YOU.</span><h2>READY WHEN<br /><em>YOU ARE.</em></h2><Link to={joinPath} className="fit-pill">Bắt đầu hành trình<RoundArrow diagonal /></Link><span className="fit-cta-star" aria-hidden="true">✳</span></section>
  </main>;
}
