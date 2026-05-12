import { Graph } from './graph';
import { GraphNode } from './types';

// Verify no cycles exist. Uses DFS with three-color marking:
// white = unvisited, gray = currently on the call stack, black = fully explored.
// A gray neighbor means we've found a back-edge → cycle.
function assertDAG(graph: Graph): void {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>([...graph.nodes.keys()].map(k => [k, WHITE]));

  function visit(node: string): void {
    color.set(node, GRAY);
    for (const neighbor of graph.adjacency.get(node) ?? []) {
      if (color.get(neighbor) === GRAY) {
        throw new Error(`Graph contains a cycle at ${node} → ${neighbor}`);
      }
      if (color.get(neighbor) === WHITE) visit(neighbor);
    }
    color.set(node, BLACK);
  }

  for (const node of graph.nodes.keys()) {
    if (color.get(node) === WHITE) visit(node);
  }
}

// Kahn's algorithm: BFS-based topological sort.
// Returns nodes in topological order — sources first, sinks last.
function topologicalSort(graph: Graph): string[] {
  const inDegree = new Map<string, number>([...graph.nodes.keys()].map(k => [k, 0]));

  for (const neighbors of graph.adjacency.values()) {
    for (const nb of neighbors) {
      inDegree.set(nb, (inDegree.get(nb) ?? 0) + 1);
    }
  }

  // Start with all nodes that have no incoming edges (sources)
  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([n]) => n);
  const order: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const nb of graph.adjacency.get(node) ?? []) {
      const deg = inDegree.get(nb)! - 1;
      inDegree.set(nb, deg);
      if (deg === 0) queue.push(nb);
    }
  }

  return order;
}

// Find all maximal simple paths in the graph using topological DP.
//
// Key idea: process nodes in reverse topological order (sinks first).
// Each node's paths = itself prepended to each path of each neighbor.
// Because neighbors are always processed before the current node,
// each subproblem is computed exactly once — no redundant re-traversal.
//
// Requires a DAG — throws if a cycle is detected.
export function findAllPaths(graph: Graph): GraphNode[][] {
  assertDAG(graph);
  const order = topologicalSort(graph);

  // suffixes[node] = all maximal path suffixes starting at node.
  // A sink node contributes [[sink]] — the path ends there.
  // A non-sink node prepends itself to every suffix of every neighbor.
  const suffixes = new Map<string, GraphNode[][]>();

  for (const name of [...order].reverse()) {
    const node = graph.nodes.get(name)!;
    const neighbors = graph.adjacency.get(name) ?? [];

    if (neighbors.length === 0) {
      // Sink: no outgoing edges, path terminates here
      suffixes.set(name, [[node]]);
    } else {
      const paths: GraphNode[][] = [];
      for (const nb of neighbors) {
        for (const suffix of suffixes.get(nb) ?? []) {
          paths.push([node, ...suffix]);
        }
      }
      suffixes.set(name, paths);
    }
  }

  // Collect all paths of length > 1 across all nodes (single-node "paths" are not routes)
  const result: GraphNode[][] = [];
  for (const paths of suffixes.values()) {
    for (const path of paths) {
      if (path.length > 1) result.push(path);
    }
  }

  return result;
}
