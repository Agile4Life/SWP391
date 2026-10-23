import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
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
  const [active, setActive] = useState(0);
  const [cycling, setCycling] = useState(false);
  const busy = useRef(false);
  const finishCycle = useCallback(() => {
    if (!busy.current) return;
    busy.current = false;
    setActive(current => (current + 1) % sports.length);
    setCycling(false);
  }, []);

  useEffect(() => {
    if (!cycling) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onPreferenceChange = () => { if (preference.matches) finishCycle(); };
    preference.addEventListener('change', onPreferenceChange);
    // Also complete if an animation is interrupted or its end event is lost.
    const timer = window.setTimeout(finishCycle, 900);
    return () => { window.clearTimeout(timer); preference.removeEventListener('change', onPreferenceChange); };
  }, [cycling, finishCycle]);

  const next = () => {
    if (busy.current) return;
    busy.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finishCycle();
    else setCycling(true);
  };

  return <div className="fit-sport-stack" data-reveal="soft" role="region" aria-label="Khám phá bốn bộ môn" aria-roledescription="chồng thẻ bộ môn">
    <div className="fit-sport-stack-deck">
      {sports.map((sport, index) => {
        const depth = (index - active + sports.length) % sports.length;
        return <article key={sport.id} className={`fit-sport-stack-card ${cycling && depth === 0 ? 'is-leaving' : ''}`}
          data-sport={sport.id} data-depth={depth} aria-hidden={depth !== 0} inert={depth !== 0}
          aria-labelledby={`sport-stack-${sport.id}`} style={{ '--stack-depth': depth } as CSSProperties}
          onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === 'fit-sport-send-back') finishCycle(); }}>
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
    <div className="fit-sport-stack-controls">
      <p role="status" aria-live="polite" aria-atomic="true"><span>0{active + 1} / 0{sports.length}</span>{sports[active].name}</p>
      <button type="button" className="fit-sport-stack-next" aria-label="Bộ môn tiếp theo" aria-disabled={cycling} onClick={next}>
        <span>Tiếp theo: {sports[(active + 1) % sports.length].name}</span><RoundArrow />
      </button>
    </div>
  </div>;
}
