import { loadGraph } from '../src/graph';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const TMP = join(__dirname, 'tmp-graph.json');

afterEach(() => {
  try { unlinkSync(TMP); } catch { /* already gone */ }
});

describe('loadGraph — fault tolerance', () => {
  it('throws a clear error when the file does not exist', () => {
    expect(() => loadGraph('/no/such/file.json')).toThrow('Graph file not found');
  });

  it('throws a clear error when the file contains invalid JSON', () => {
    writeFileSync(TMP, '{ not valid json }');
    expect(() => loadGraph(TMP)).toThrow('Failed to parse graph file');
  });

  it('loads successfully when given valid JSON', () => {
    writeFileSync(TMP, JSON.stringify({ nodes: [{ name: 'a', kind: 'service' }], edges: [] }));
    const graph = loadGraph(TMP);
    expect(graph.nodes.has('a')).toBe(true);
  });
});
