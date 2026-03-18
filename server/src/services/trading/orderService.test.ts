import { shouldFillOrder } from './orderService.js';

describe('shouldFillOrder', () => {
  describe('LIMIT BUY — fill when market price drops to or below limit', () => {
    it('fills when market price is below the limit price', () => {
      expect(shouldFillOrder('LIMIT', 'BUY', 95, 100)).toBe(true);
    });

    it('fills when market price exactly equals the limit price', () => {
      expect(shouldFillOrder('LIMIT', 'BUY', 100, 100)).toBe(true);
    });

    it('does not fill when market price is above the limit price', () => {
      expect(shouldFillOrder('LIMIT', 'BUY', 105, 100)).toBe(false);
    });
  });

  describe('LIMIT SELL — fill when market price rises to or above limit', () => {
    it('fills when market price is above the limit price', () => {
      expect(shouldFillOrder('LIMIT', 'SELL', 105, 100)).toBe(true);
    });

    it('fills when market price exactly equals the limit price', () => {
      expect(shouldFillOrder('LIMIT', 'SELL', 100, 100)).toBe(true);
    });

    it('does not fill when market price is below the limit price', () => {
      expect(shouldFillOrder('LIMIT', 'SELL', 95, 100)).toBe(false);
    });
  });

  describe('STOP SELL (stop-loss) — fill when market price drops to or below stop', () => {
    it('fills when market price falls below the stop price', () => {
      expect(shouldFillOrder('STOP', 'SELL', 90, 100)).toBe(true);
    });

    it('fills when market price exactly equals the stop price', () => {
      expect(shouldFillOrder('STOP', 'SELL', 100, 100)).toBe(true);
    });

    it('does not fill when market price is above the stop price', () => {
      expect(shouldFillOrder('STOP', 'SELL', 110, 100)).toBe(false);
    });
  });

  describe('STOP BUY — fill when market price rises to or above stop', () => {
    it('fills when market price rises above the stop price', () => {
      expect(shouldFillOrder('STOP', 'BUY', 110, 100)).toBe(true);
    });

    it('fills when market price exactly equals the stop price', () => {
      expect(shouldFillOrder('STOP', 'BUY', 100, 100)).toBe(true);
    });

    it('does not fill when market price is below the stop price', () => {
      expect(shouldFillOrder('STOP', 'BUY', 90, 100)).toBe(false);
    });
  });
});
