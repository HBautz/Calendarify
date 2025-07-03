import { generateSlots } from '../src/event-types/slot.utils';

describe('generateSlots', () => {
  it('returns deduped slots', () => {
    const slots = generateSlots({
      from: new Date('2023-01-01T00:00:00Z'),
      to: new Date('2023-01-01T23:59:59Z'),
      duration: 60,
      timezone: 'UTC',
      rules: [{ dayOfWeek: 0, startMinute: 60, endMinute: 180 }],
      overrides: [],
      busy: [],
    });
    expect(slots.length).toBe(2);
  });
});
