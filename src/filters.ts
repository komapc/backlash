import { GraphNode, PathFilter } from './types';

const SINK_KINDS = new Set(['rds', 'sqs']);

export const FILTERS: Record<string, PathFilter> = {
  startsPublic: (path: GraphNode[]) =>
    path[0]?.publicExposed === true,

  endsAtSink: (path: GraphNode[]) =>
    SINK_KINDS.has(path.at(-1)?.kind ?? ''),

  hasVulnerability: (path: GraphNode[]) =>
    path.some(n => (n.vulnerabilities?.length ?? 0) > 0),
};

export function applyFilters(paths: GraphNode[][], filterNames: string[]): GraphNode[][] {
  if (filterNames.length === 0) return paths;
  const fns = filterNames.map(name => FILTERS[name]);
  return paths.filter(path => fns.every(fn => fn(path)));
}

export function validateFilters(names: string[]): string[] {
  return names.filter(n => !(n in FILTERS));
}
