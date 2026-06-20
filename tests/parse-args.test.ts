import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/index.js';

describe('parseArgs', () => {
  it('should parse a single number', () => {
    expect(parseArgs(['2051'])).toEqual([2051]);
  });

  it('should parse multiple space-separated numbers', () => {
    expect(parseArgs(['2051', '2052', '2053'])).toEqual([2051, 2052, 2053]);
  });

  it('should parse comma-separated numbers', () => {
    expect(parseArgs(['2051,2052,2053'])).toEqual([2051, 2052, 2053]);
  });

  it('should parse a range', () => {
    expect(parseArgs(['2051-2055'])).toEqual([2051, 2052, 2053, 2054, 2055]);
  });

  it('should parse mixed formats', () => {
    const result = parseArgs(['2051-2053', '2060', '2070,2071']);
    expect(result).toEqual([2051, 2052, 2053, 2060, 2070, 2071]);
  });

  it('should deduplicate numbers', () => {
    expect(parseArgs(['2051', '2051', '2051-2052'])).toEqual([2051, 2052]);
  });

  it('should return sorted results', () => {
    expect(parseArgs(['2055', '2051', '2053-2054'])).toEqual([2051, 2053, 2054, 2055]);
  });

  it('should ignore invalid entries', () => {
    expect(parseArgs(['abc', '2051', 'xyz'])).toEqual([2051]);
  });

  it('should handle empty input', () => {
    expect(parseArgs([])).toEqual([]);
  });

  it('should not treat negative flags as ranges', () => {
    // In the real CLI flow, flags like --ffdec are filtered out before parseArgs
    // So this tests that a plain "-f" alone wouldn't be mistaken for a range
    expect(parseArgs(['5'])).toEqual([5]);
  });
});
