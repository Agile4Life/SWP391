import { expect, it } from 'vitest';
import { historyMatches, sortHistory } from './historySearch';
it('searches all fetched rows by accent-insensitive member name, code and supported transaction id', () => {
  expect(historyMatches('nguyen', ['Nguyễn Văn An', 'MB-1', 123])).toBe(true);
  expect(historyMatches('MB-1', ['Nguyễn Văn An', 'MB-1', 123])).toBe(true);
  expect(historyMatches('123', ['Nguyễn Văn An', 'MB-1', 123])).toBe(true);
  expect(historyMatches('missing', ['Nguyễn Văn An'])).toBe(false);
});
it('sorts both directions without mutating source records', () => {
  const rows = [{ at: '2026-11-01', id: 1 }, { at: '2026-11-25', id: 2 }];
  expect(sortHistory(rows, x => x.at, 'newest')[0].id).toBe(2);
  expect(sortHistory(rows, x => x.at, 'oldest')[0].id).toBe(1);
  expect(rows[0].id).toBe(1);
});
