import { sourceText, useSourceLanguage, sourceFormat } from "../../../shared/i18n/sourceText";
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RoundArrow } from './PublicLayout';
import { MAIN_DISCIPLINE } from '../../../shared/lib/disciplines';
import { LoadingImage } from '../../../shared/ui/LoadingImage';
import './sport-stack.css';

// Chỉ giới thiệu Gym; giữ danh mục dùng chung của các role khác.
const content = {
  image: '/images/fitness/gym-floor.jpg',
  get summary() { return sourceText('Xây dựng sức mạnh và thể lực với các bài tập tạ.'); },
  programs: ['Kỹ thuật tập tạ', 'Sức mạnh toàn thân', 'Thể lực và sức bền'],
};
// The existing import remains stable; this section now uses a scrolling story rather than a deck.
export function SportStack({ ptPath, heading }: { ptPath: string; heading?: ReactNode }) {
  useSourceLanguage();
  const sports = [{ ...MAIN_DISCIPLINE, ...content }];
  const story = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = story.current!;
    const steps = [...section.querySelectorAll<HTMLElement>('.fit-sport-story-step')];
    const visuals = [...section.querySelectorAll<HTMLElement>('.fit-sport-story-visual')];
    const dots = [...section.querySelectorAll<HTMLElement>('.fit-sport-story-dots i')];
    const marker = section.querySelector<HTMLElement>('.fit-sport-story-rail i')!;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const header = section.closest('.fit-site')?.querySelector<HTMLElement>('.fit-header');
    let active = 0;
    let displayed = 0;
    let timer = 0;
    const show = (index: number) => {
      window.clearTimeout(timer);
      timer = 0;
      visuals.forEach((visual, i) => {
        visual.classList.toggle('is-active', i === index);
        visual.classList.remove('is-leaving');
      });
      displayed = index;
    };
    const select = (index: number) => {
      active = index;
      steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
      marker.style.top = `${sports.length > 1 ? index / (sports.length - 1) * 100 : 0}%`;
      if (preference.matches || index === displayed) {
        show(index);
        return;
      }
      // Match the reference's exit-before-enter transition; rapid scroll always selects the latest step.
      visuals[displayed].classList.add('is-leaving');
      if (!timer) timer = window.setTimeout(() => show(active), 500);
    };
    let observer: IntersectionObserver | null = null;
    const focus = (event: FocusEvent) => {
      const index = steps.findIndex(step => step.contains(event.target as Node));
      if (index >= 0) select(index);
    };
    const measure = () => {
      const top = header ? Math.ceil(header.getBoundingClientRect().height) + 12 : 90;
      section.style.setProperty('--sport-story-top', `${top}px`);
      observer?.disconnect();
      if (typeof IntersectionObserver !== 'undefined') {
        // Vertical percentage root margins resolve against width; use pixels for a true middle 10% band.
        const inset = Math.round(window.innerHeight * .45);
        observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) select(steps.indexOf(entry.target as HTMLElement));
          });
        }, { rootMargin: `-${inset}px 0px -${inset}px 0px`, threshold: 0 });
        steps.forEach(step => observer!.observe(step));
        section.classList.add('is-enhanced');
      }
    };
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (header) resize?.observe(header);
    const motion = () => show(active);
    section.addEventListener('focusin', focus);
    preference.addEventListener('change', motion);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      resize?.disconnect();
      section.removeEventListener('focusin', focus);
      preference.removeEventListener('change', motion);
      window.removeEventListener('resize', measure);
      section.classList.remove('is-enhanced');
    };
  }, [sports.length]);

  const illustration = (sport: typeof sports[number]) => <>
    <LoadingImage src={sport.image} alt={sourceFormat("Ảnh minh họa không gian {0}", sport.name.toLowerCase())} loading="lazy" decoding="async" />
    <figcaption>{sourceText("Ảnh minh họa · ")}{sourceText(sport.name)}</figcaption>
  </>;

  return <div className="fit-sport-story" ref={story} role="region" aria-label={sourceText({ vi: 'Khám phá Gym', en: 'Explore Gym' })}>
    {heading}
    <p className="fit-sport-story-hint">{sourceText({ vi: 'Khám phá không gian Gym ', en: 'Explore the Gym floor ' })}<span aria-hidden="true">↓</span></p>
    <div className="fit-sport-story-layout">
      <div className="fit-sport-story-steps">
        <div className="fit-sport-story-rail" aria-hidden="true"><i style={{ top: '0%' }} /></div>
        {sports.map((sport, index) => <article key={sport.id}
          className={`fit-sport-story-step${index === 0 ? ' is-active' : ''}`}
          data-sport={sport.id} aria-labelledby={`sport-story-${sport.id}`}>
          <span className="fit-sport-story-number" aria-hidden="true">0{index + 1}</span>
          <span className="fit-sport-story-tier">{sourceText('Bộ môn chính')}</span>
          <h3 id={`sport-story-${sport.id}`}>{sourceText(sport.name)}</h3>
          <p className="fit-sport-story-summary">{sport.summary}</p>
          <ul className="fit-sport-story-programs">{sport.programs.map(program => <li key={sourceText(program)}>{sourceText(program)}</li>)}</ul>
          <div className="fit-sport-story-footer">
            <Link className="fit-pill" to={ptPath}>{sourceText({ vi: 'Đặt lịch HLV 1:1', en: 'Book a 1:1 coach' })}<RoundArrow diagonal /></Link>
          </div>
          <figure className="fit-sport-story-inline" data-reveal="image">{illustration(sport)}</figure>
        </article>)}
      </div>
      <div className="fit-sport-story-sticky" aria-hidden="true">
        <div className="fit-sport-story-panel">
          {sports.map((sport, index) => <figure key={sport.id} data-sport={sport.id}
            className={`fit-sport-story-visual${index === 0 ? ' is-active' : ''}`}>
            {illustration(sport)}
          </figure>)}
          <div className="fit-sport-story-dots">{sports.map((sport, index) =>
            <i key={sport.id} className={index === 0 ? 'is-active' : ''} />)}</div>
        </div>
      </div>
    </div>
  </div>;
}
