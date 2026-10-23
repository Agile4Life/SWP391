import { useEffect, useRef, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { RoundArrow } from './PublicLayout';
import './sport-stack.css';

const sports = [
  {
    id: 'swimming', name: 'Bơi lội', english: 'SWIMMING', image: '/images/fitness/aquatics-pool.jpg',
    summary: 'Tìm nhịp thở, làm chủ chuyển động và rèn sức bền trong làn nước.',
    audience: 'Từ người mới làm quen với nước đến người muốn cải thiện kỹ thuật và sức bền.',
    programs: [
      ['Làm quen với nước', 'Tập thở, nổi và phối hợp tay chân theo từng bước.'],
      ['Hoàn thiện kỹ thuật', 'Điều chỉnh tư thế, nhịp thở và chuyển động khi bơi.'],
      ['Sức bền & thả lỏng', 'Duy trì nhịp bơi phù hợp và thư giãn sau buổi tập.'],
    ],
    focus: ['Nhịp thở', 'Phối hợp', 'Sức bền'],
  },
  {
    id: 'tennis', name: 'Tennis', english: 'TENNIS', image: '/images/fitness/tennis-court.jpg',
    summary: 'Bắt nhịp đường bóng, di chuyển chủ động và tự tin trong từng pha đánh.',
    audience: 'Người mới cầm vợt, người chơi phong trào và người muốn luyện kỹ thuật đánh đơn, đánh đôi.',
    programs: [
      ['Nền tảng cầm vợt', 'Làm quen cảm giác bóng, tư thế chuẩn bị và điểm tiếp xúc.'],
      ['Kỹ thuật đường bóng', 'Luyện thuận tay, trái tay, giao bóng và xử lý trên lưới.'],
      ['Di chuyển & phối hợp', 'Luyện bộ chân, chọn vị trí và phối hợp khi đánh đôi.'],
    ],
    focus: ['Kỹ thuật', 'Bộ chân', 'Chiến thuật'],
  },
  {
    id: 'badminton', name: 'Cầu lông', english: 'BADMINTON', image: '/images/fitness/badminton-court.webp',
    summary: 'Di chuyển linh hoạt, phản xạ nhanh và kiểm soát từng đường cầu.',
    audience: 'Người bắt đầu chơi cầu lông và người chơi phong trào muốn củng cố kỹ thuật, phối hợp đánh đôi.',
    programs: [
      ['Cầm vợt & phát cầu', 'Làm quen cách cầm vợt, tư thế chuẩn bị và phát cầu đúng kỹ thuật.'],
      ['Kiểm soát đường cầu', 'Luyện phông cầu, bỏ nhỏ và đập cầu theo tình huống.'],
      ['Bộ chân & đánh đôi', 'Di chuyển về vị trí trung tâm và phối hợp luân chuyển trên sân.'],
    ],
    focus: ['Phản xạ', 'Linh hoạt', 'Phối hợp'],
  },
  {
    id: 'basketball', name: 'Bóng rổ', english: 'BASKETBALL', image: '/images/fitness/basketball-court.webp',
    summary: 'Làm chủ trái bóng, kết nối đồng đội và tạo nhịp chơi của riêng bạn.',
    audience: 'Người mới tập bóng rổ và người chơi muốn rèn kỹ năng cá nhân cùng khả năng phối hợp đội nhóm.',
    programs: [
      ['Dẫn bóng & chuyền bóng', 'Luyện kiểm soát bóng, đổi hướng và chuyền bóng chính xác.'],
      ['Ném rổ & lên rổ', 'Tập tư thế ném, nhịp chân và hoàn thiện động tác lên rổ.'],
      ['Phòng thủ & phối hợp', 'Luyện di chuyển phòng thủ, chọn vị trí và phối hợp đồng đội.'],
    ],
    focus: ['Kiểm soát bóng', 'Sức bật', 'Đồng đội'],
  },
];

export function SportStack({ classPath }: { classPath: string }) {
  const deck = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = deck.current!;
    const runway = track.current!;
    const cards = [...stage.querySelectorAll<HTMLElement>('.fit-sport-stack-card')];
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let step = 1;
    let stickyTop = 108;
    let frame = 0;
    let origin = 0;
    let mobile = false;
    let previousProgress = -1;
    let previousActive = -1;
    let previousAccessible = -1;
    const transforms: string[] = [];
    const update = () => {
      const progress = preference.matches ? 0 : Math.max(0, Math.min(sports.length - 1, (window.scrollY - origin) / step));
      if (progress === previousProgress) return;
      previousProgress = progress;
      const active = Math.floor(progress);
      // Respond immediately in both scroll directions, including at each card boundary.
      const fraction = progress - active;
      const accessible = fraction >= .55 ? active + 1 : active;
      cards.forEach((card, index) => {
        const depth = (index - active + sports.length) % sports.length;
        const leaving = !preference.matches && depth === 0 && fraction > 0;
        if (active !== previousActive) card.dataset.depth = String(depth);
        // Only transform changes within a phase: no inherited custom properties or animation seeking.
        const points = mobile
          ? [[0, 0, 0, 1], [5, -35, 3, 1], [5, -32, 3, .97], [0, 39, 0, .925]]
          : [[0, 0, 0, 1], [18, -60, 7, 1.02], [20, -54, 7, .97], [0, 39, 0, .925]];
        let transform: string;
        if (leaving) {
          const segment = fraction < .45 ? 0 : fraction < .55 ? 1 : 2;
          const starts = [0, .45, .55];
          const ends = [.45, .55, 1];
          const t = (fraction - starts[segment]) / (ends[segment] - starts[segment]);
          const [x, y, angle, scale] = points[segment].map((value, i) => value + (points[segment + 1][i] - value) * t);
          transform = `translate3d(${x.toFixed(3)}%, ${y.toFixed(3)}px, 0) rotate(${angle.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
        } else {
          const visualDepth = depth === 0 ? 0 : depth - fraction;
          transform = `translate3d(0, ${(visualDepth * 13).toFixed(3)}px, 0) scale(${(1 - visualDepth * .025).toFixed(4)})`;
        }
        if (transforms[index] !== transform) {
          card.style.transform = transform;
          transforms[index] = transform;
        }
        const zIndex = String(leaving ? fraction < .55 ? 5 : 0 : 4 - depth);
        if (card.style.zIndex !== zIndex) card.style.zIndex = zIndex;
        card.classList.toggle('is-leaving', leaving);
        card.classList.toggle('is-incoming', !preference.matches && depth === 1 && fraction > 0);
        if (accessible !== previousAccessible) {
          card.toggleAttribute('inert', !preference.matches && index !== accessible);
          card.setAttribute('aria-hidden', String(!preference.matches && index !== accessible));
        }
      });
      previousActive = active;
      previousAccessible = accessible;
    };
    const measure = () => {
      // Keep the whole deck below the header; long copy scrolls inside its card.
      stickyTop = 108;
      mobile = window.innerWidth <= 760;
      runway.style.setProperty('--stack-card-height', `${Math.max(200, window.innerHeight - stickyTop - 24 - 42)}px`);
      step = Math.max(280, Math.min(480, window.innerHeight * .45));
      stage.style.setProperty('--stack-top', `${stickyTop}px`);
      runway.style.setProperty('--stack-height', `${stage.offsetHeight}px`);
      runway.style.setProperty('--stack-step', String(step));
      runway.style.setProperty('--stack-travel', `${step * (sports.length - 1) + 48}px`);
      origin = runway.getBoundingClientRect().top + window.scrollY - stickyTop;
      previousProgress = previousActive = previousAccessible = -1;
      update();
    };
    const scroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; update(); });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(stage);
    const canvas = runway.closest('.fit-canvas');
    if (canvas) observer?.observe(canvas);
    const visibility = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      const nearby = entries.some(entry => entry.isIntersecting);
      runway.classList.toggle('is-nearby', nearby);
      if (nearby) stage.querySelectorAll('img').forEach(image => {
        image.loading = 'eager';
        void image.decode().catch(() => { /* Keep the normal image fallback on load failure. */ });
      });
    }, { rootMargin: '800px 0px' });
    visibility?.observe(runway);
    runway.classList.add('is-enhanced');
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', scroll, { passive: true });
    preference.addEventListener('change', measure);
    return () => {
      observer?.disconnect();
      visibility?.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', scroll);
      preference.removeEventListener('change', measure);
    };
  }, []);

  return <div className="fit-sport-stack" role="region" aria-label="Khám phá bốn bộ môn" aria-roledescription="chồng thẻ bộ môn">
    <p className="fit-sport-stack-hint" data-reveal="soft">Cuộn để khám phá bốn bộ môn <span aria-hidden="true">↓</span></p>
    <div className="fit-sport-stack-track" ref={track}>
    <div className="fit-sport-stack-deck" ref={deck}>
      {sports.map((sport, index) => {
        return <article key={sport.id} className="fit-sport-stack-card"
          data-sport={sport.id}
          aria-labelledby={`sport-stack-${sport.id}`} style={{ '--stack-index': index } as CSSProperties}>
          <div className="fit-sport-stack-photo">
            <img src={sport.image} alt={`Ảnh minh họa không gian ${sport.name.toLowerCase()}`} loading="lazy" />
            <span className="fit-sport-stack-caption">Ảnh minh họa</span>
            <span className="fit-sport-stack-photo-index" aria-hidden="true">0{index + 1}</span>
          </div>
          <div className="fit-sport-stack-content">
            <span className="fit-sport-stack-kicker">SÖL SPORTS CLUB · {sport.english}</span>
            <h3 id={`sport-stack-${sport.id}`}>{sport.name}</h3>
            <p className="fit-sport-stack-summary">{sport.summary}</p>
            <div className="fit-sport-stack-focus">{sport.focus.map(item => <span key={item}>{item}</span>)}</div>
            <h4>Nội dung luyện tập</h4>
            <ol className="fit-sport-stack-programs">{sport.programs.map(([title, description], i) => <li key={title}>
              <span aria-hidden="true">0{i + 1}</span><div><h5>{title}</h5><p>{description}</p></div>
            </li>)}</ol>
            <p className="fit-sport-stack-audience"><strong>Dành cho</strong>{sport.audience}</p>
            <div className="fit-sport-stack-footer"><Link className="fit-pill" to={classPath}>Xem lịch học<RoundArrow diagonal /></Link><span>Lịch lớp và quyền lợi theo gói được cập nhật trong portal.</span></div>
          </div>
        </article>;
      })}
    </div>
    </div>
  </div>;
}
