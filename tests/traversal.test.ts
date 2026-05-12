import { loadGraph, Graph } from '../src/graph';
import { findAllPaths } from '../src/traversal';

function makeGraph(nodes: string[], edges: [string, string][]): Graph {
  const nodeMap = new Map(nodes.map(n => [n, { name: n, kind: 'service' }]));
  const adjacency = new Map(nodes.map(n => [n, [] as string[]]));
  const edgeList: { from: string; to: string }[] = [];

  for (const [from, to] of edges) {
    adjacency.get(from)!.push(to);
    edgeList.push({ from, to });
  }

  return { nodes: nodeMap, adjacency, edges: edgeList };
}

describe('findAllPaths', () => {
  it('finds paths in a simple linear graph', () => {
    const graph = makeGraph(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]);
    const paths = findAllPaths(graph);
    const pathNames = paths.map(p => p.map(n => n.name).join('->'));
    // Only maximal paths are recorded: traversal continues as long as unvisited neighbors exist
    expect(pathNames).toContain('A->B->C');
    expect(pathNames).toContain('B->C');
    expect(pathNames).not.toContain('A->B'); // not maximal — B still has neighbor C
  });

  it('finds paths in a branching graph', () => {
    const graph = makeGraph(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']]);
    const paths = findAllPaths(graph);
    const pathNames = paths.map(p => p.map(n => n.name).join('->'));
    expect(pathNames).toContain('A->B');
    expect(pathNames).toContain('A->C');
  });

  it('throws when the graph contains a cycle', () => {
    const graph = makeGraph(['A', 'B'], [['A', 'B'], ['B', 'A']]);
    expect(() => findAllPaths(graph)).toThrow('cycle');
  });

  it('only returns paths of length > 1', () => {
    const graph = makeGraph(['A', 'B'], [['A', 'B']]);
    const paths = findAllPaths(graph);
    for (const path of paths) {
      expect(path.length).toBeGreaterThan(1);
    }
  });
});

describe('loadGraph', () => {
  it('loads the real graph without throwing', () => {
    const graph = loadGraph();
    expect(graph.nodes.size).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('normalizes string "to" edge to array', () => {
    // consign-service has "to" as string in source JSON
    const graph = loadGraph();
    const consignEdges = graph.edges.filter(e => e.from === 'consign-service');
    expect(consignEdges.length).toBeGreaterThan(0);
  });

  it('creates ghost node for assurance-service', () => {
    const graph = loadGraph();
    const node = graph.nodes.get('assurance-service');
    expect(node).toBeDefined();
    expect(node?.kind).toBe('unknown');
  });
});
