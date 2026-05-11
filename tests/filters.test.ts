import { FILTERS, applyFilters, validateFilters } from '../src/filters';
import { GraphNode } from '../src/types';

function node(name: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return { name, kind: 'service', ...overrides };
}

const publicNode = node('pub', { publicExposed: true });
const privateNode = node('priv', { publicExposed: false });
const sinkRds = node('db', { kind: 'rds' });
const sinkSqs = node('queue', { kind: 'sqs' });
const vulnNode = node('vuln', { vulnerabilities: [{ file: 'f', severity: 'high', message: 'm' }] });

describe('startsPublic', () => {
  it('passes when first node is publicExposed', () => {
    expect(FILTERS.startsPublic([publicNode, privateNode])).toBe(true);
  });
  it('fails when first node is not publicExposed', () => {
    expect(FILTERS.startsPublic([privateNode, publicNode])).toBe(false);
  });
});

describe('endsAtSink', () => {
  it('passes when last node is rds', () => {
    expect(FILTERS.endsAtSink([privateNode, sinkRds])).toBe(true);
  });
  it('passes when last node is sqs', () => {
    expect(FILTERS.endsAtSink([privateNode, sinkSqs])).toBe(true);
  });
  it('fails when last node is a service', () => {
    expect(FILTERS.endsAtSink([publicNode, privateNode])).toBe(false);
  });
});

describe('hasVulnerability', () => {
  it('passes when any node has vulnerabilities', () => {
    expect(FILTERS.hasVulnerability([publicNode, vulnNode, sinkRds])).toBe(true);
  });
  it('fails when no node has vulnerabilities', () => {
    expect(FILTERS.hasVulnerability([publicNode, privateNode])).toBe(false);
  });
});

describe('applyFilters', () => {
  const paths = [
    [publicNode, vulnNode, sinkRds],
    [publicNode, privateNode],
    [privateNode, sinkRds],
  ];

  it('returns all paths when no filters given', () => {
    expect(applyFilters(paths, [])).toHaveLength(3);
  });

  it('AND-combines multiple filters', () => {
    const result = applyFilters(paths, ['startsPublic', 'endsAtSink']);
    expect(result).toHaveLength(1);
    expect(result[0][0].name).toBe('pub');
    expect(result[0].at(-1)?.name).toBe('db');
  });
});

describe('validateFilters', () => {
  it('returns empty array for valid filter names', () => {
    expect(validateFilters(['startsPublic', 'endsAtSink'])).toEqual([]);
  });
  it('returns invalid names', () => {
    expect(validateFilters(['startsPublic', 'notAFilter'])).toEqual(['notAFilter']);
  });
});
