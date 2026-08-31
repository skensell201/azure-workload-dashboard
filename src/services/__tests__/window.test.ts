import { defaultWindow } from '../window';

describe('defaultWindow', () => {
  it('starts on Monday of the current week and spans 14 days', () => {
    // 2026-09-03 is a Thursday.
    expect(defaultWindow(new Date('2026-09-03T12:00:00Z'))).toEqual({ start: '2026-08-31', end: '2026-09-13' });
  });

  it('starts on the same day when today is Monday', () => {
    expect(defaultWindow(new Date('2026-08-31T00:00:00Z'))).toEqual({ start: '2026-08-31', end: '2026-09-13' });
  });

  it('treats Sunday as the last day of the week', () => {
    expect(defaultWindow(new Date('2026-09-06T00:00:00Z'))).toEqual({ start: '2026-08-31', end: '2026-09-13' });
  });
});
