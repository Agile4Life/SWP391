import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DocumentImageLightbox } from './DocumentImageLightbox';
import { setLanguage } from '../../shared/i18n/language';

let host: HTMLDivElement;
let root: Root;
const image = { url: 'data:image/png;base64,AA', title: 'Document', alt: 'Front document' };
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); setLanguage('vi'); vi.unstubAllGlobals();
});

it.each(['vi', 'en'] as const)('preserves the original-image link by default for other callers (%s)', async language => {
  setLanguage(language);
  await act(async () => root.render(<DocumentImageLightbox image={image} onClose={() => {}} />));
  const link = host.querySelector('a')!;
  expect(link.getAttribute('href')).toBe(image.url);
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.textContent).toBe(language === 'vi' ? 'Mở ảnh gốc' : 'Open original');
});

it.each(['vi', 'en'] as const)('only hides the original action when requested (%s)', async language => {
  setLanguage(language);
  await act(async () => root.render(<DocumentImageLightbox image={image} onClose={() => {}} showOriginalAction={false} />));
  expect(host.querySelector('a')).toBeNull();
  const zoom = host.querySelector<HTMLButtonElement>('.document-lightbox__actions button')!;
  expect(zoom.textContent).toBe(language === 'vi' ? 'Phóng to (200%)' : 'Zoom in (200%)');
  await act(async () => zoom.click());
  expect(host.querySelector('.is-zoomed')).not.toBeNull();
});
