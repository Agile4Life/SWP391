import { afterEach, describe, expect, it, vi } from 'vitest';
import { fitWithin, fileToUploadDataUrl, KEEP_AS_IS_BYTES, MAX_UPLOAD_SIDE } from './imageUpload';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  // P2-FE-24: Reject empty 0-byte files, zero-dimension decoded images, and empty "data:," data URLs
  it('rejects 0-byte files', async () => {
    const empty = new File([], 'empty.png', { type: 'image/png' });
    await expect(fileToUploadDataUrl(empty)).rejects.toThrow('Image file is empty');
  });

  it('rejects zero-dimension decoded images', async () => {
    const largeBytes = new Uint8Array(KEEP_AS_IS_BYTES + 16);
    const file = new File([largeBytes], 'corrupt.jpg', { type: 'image/jpeg' });
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 0, height: 0, close }));

    await expect(fileToUploadDataUrl(file)).rejects.toThrow('Invalid image dimensions');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid or empty canvas data URLs such as "data:,"', async () => {
    const largeBytes = new Uint8Array(KEEP_AS_IS_BYTES + 16);
    const file = new File([largeBytes], 'photo.jpg', { type: 'image/jpeg' });
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 800, height: 600, close }));
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }),
          toDataURL: () => 'data:,',
        } as unknown as HTMLCanvasElement;
      }
      return origCreate(tagName);
    });

    await expect(fileToUploadDataUrl(file)).rejects.toThrow('Invalid image data');
    expect(close).toHaveBeenCalledTimes(1);
  });
});
