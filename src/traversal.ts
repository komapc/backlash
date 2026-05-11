import { Graph } from './graph';
import { GraphNode } from './types';

export function findAllPaths(graph: Graph): GraphNode[][] {
  const paths: GraphNode[][] = [];

  function dfs(current: string, visited: Set<string>, path: GraphNode[]) {
    const node = graph.nodes.get(current)!;
    path.push(node);
    visited.add(current);

    const neighbors = graph.adjacency.get(current) ?? [];

    if (neighbors.length === 0 || neighbors.every(n => visited.has(n))) {
      // Dead end or all neighbors already visited — record path if length > 1
      if (path.length > 1) {
        paths.push([...path]);
      }
    } else {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, visited, path);
        }
      }
    }

    path.pop();
    visited.delete(current);
  }

  for (const name of graph.nodes.keys()) {
    dfs(name, new Set(), []);
  }

  return paths;
}
