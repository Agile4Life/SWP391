import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePortalMotion } from './usePortalMotion';

type Entry = Pick<IntersectionObserverEntry, 'target' | 'isIntersecting' | 'boundingClientRect'>;

let host: HTMLDivElement;
let root: Root;
let reducedMotion: boolean;
let preferenceListeners: Array<() => void>;
let observers: FakeObserver[];

class FakeObserver {
  observed = new Set<Element>();
  constructor(private readonly callback: (entries: Entry[]) => void) { observers.push(this); }
  observe(element: Element) { this.observed.add(element); }
  unobserve(element: Element) { this.observed.delete(element); }
  disconnect() { this.observed.clear(); }
  emit(entries: Array<{ target: Element; isIntersecting: boolean; top?: number }>) {
    this.callback(entries.map(({ target, isIntersecting, top = 0 }) => ({
      target, isIntersecting, boundingClientRect: { top, left: 0 } as DOMRectReadOnly,
    })));
  }
}

beforeEach(() => {
  reducedMotion = false;
  preferenceListeners = [];
  observers = [];
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reducedMotion; },
    addEventListener: (_: string, listener: () => void) => { preferenceListeners.push(listener); },
    removeEventListener() {},
  }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function Screen() {
  const ref = useRef<HTMLElement>(null);
  const [extra, setExtra] = useState(false);
  usePortalMotion(ref);
  return <main ref={ref}>
    <div className="portal-header" id="header" />
    <div className="portal-card" id="card"><div className="row-card" id="nested"><button id="inside">x</button></div></div>
    <div className="row-card" id="row"><strong id="row-title" /><div className="stack"><span id="meta-1" /><span id="meta-2" /></div><table id="row-table" />{extra && <em id="late-part" />}</div>
    <dialog><div className="portal-card" id="in-dialog" /></dialog>
    <div data-motion="off"><div className="portal-card" id="opted-out" /></div>
    {extra && <div className="portal-card" id="late" />}
    <button id="add" onClick={() => setExtra(true)}>add</button>
  </main>;
}
const el = (id: string) => host.querySelector<HTMLElement>(`#${id}`)!;
const current = () => observers[observers.length - 1];

it('registers only top-level components outside dialogs and opted-out regions', async () => {
  await act(async () => root.render(<Screen />));
  expect(['header', 'card', 'row'].every(id => el(id).classList.contains('portal-reveal-ready'))).toBe(true);
  expect(['nested', 'in-dialog', 'opted-out'].some(id => el(id).classList.contains('portal-reveal-ready'))).toBe(false);
});

it('staggers components entering together and replays after they fully leave the viewport', async () => {
  await act(async () => root.render(<Screen />));
  act(() => current().emit([
    { target: el('row'), isIntersecting: true, top: 300 },
    { target: el('header'), isIntersecting: true, top: 0 },
  ]));
  expect(el('header').style.getPropertyValue('--portal-reveal-delay')).toBe('0ms');
  expect(el('row').style.getPropertyValue('--portal-reveal-delay')).toBe('55ms');
  expect(el('row').classList.contains('is-visible')).toBe(true);

  act(() => current().emit([{ target: el('row'), isIntersecting: false, top: -200 }]));
  expect(el('row').classList.contains('is-visible')).toBe(false);
  expect(el('row').dataset.revealDirection).toBe('up');

  act(() => current().emit([{ target: el('row'), isIntersecting: true, top: 10 }]));
  expect(el('row').classList.contains('is-visible')).toBe(true);
});

it('registers components added later and shows a hidden component as soon as it receives focus', async () => {
  await act(async () => root.render(<Screen />));
  await act(async () => el('add').click());
  expect(el('late').classList.contains('portal-reveal-ready')).toBe(true);

  act(() => { el('inside').dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
  expect(el('card').classList.contains('is-visible')).toBe(true);
});

it('leaves content untouched under reduced motion, including when the setting changes while open', async () => {
  await act(async () => root.render(<Screen />));
  reducedMotion = true;
  act(() => preferenceListeners.forEach(listener => listener()));
  expect(host.querySelector('.portal-reveal-ready')).toBeNull();
  reducedMotion = false;
  act(() => preferenceListeners.forEach(listener => listener()));
  expect(el('card').classList.contains('portal-reveal-ready')).toBe(true);
});

it('numbers the small parts inside a component, through layout groups, and picks up parts added later', async () => {
  await act(async () => root.render(<Screen />));
  const order = (id: string) => el(id).style.getPropertyValue('--portal-part');
  expect([order('row-title'), order('meta-1'), order('meta-2')]).toEqual(['0', '1', '2']);
  expect(el('row-table').dataset.revealPart).toBeUndefined();
  expect(el('nested').dataset.revealPart).toBe('');

  await act(async () => el('add').click());
  expect(el('late-part').dataset.revealPart).toBe('');
  expect(order('late-part')).toBe('0');
  expect(order('row-title')).toBe('0');
});
