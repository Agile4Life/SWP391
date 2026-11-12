import { describe, expect, it } from 'vitest';
import { fitWithin, fileToUploadDataUrl, KEEP_AS_IS_BYTES, MAX_UPLOAD_SIDE } from './imageUpload';

describe('fitWithin', () => {
  it('scales the longer side down to the limit and keeps the aspect ratio', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });
  it('never enlarges a small picture', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(MAX_UPLOAD_SIDE, 100)).toEqual({ width: MAX_UPLOAD_SIDE, height: 100 });
  });
  it('always keeps at least one pixel on the short side', () => {
    expect(fitWithin(20000, 3).height).toBeGreaterThanOrEqual(1);
  });
});

describe('fileToUploadDataUrl', () => {
  it('sends a small picture untouched in its original encoding', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const file = new File([bytes], 'cccd.png', { type: 'image/png' });
    expect(file.size).toBeLessThanOrEqual(KEEP_AS_IS_BYTES);
    const url = await fileToUploadDataUrl(file);
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });
});
