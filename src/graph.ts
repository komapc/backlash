import { readFileSync } from 'fs';
import { join } from 'path';
import { GraphNode, RawGraph, RawEdge } from './types';

export interface Graph {
  nodes: Map<string, GraphNode>;     // keyed by name — assumed unique (see README)
  adjacency: Map<string, string[]>;  // name → list of neighbor names, used by DFS
  edges: Array<{ from: string; to: string }>; // flat list kept for subgraph building
}

// The JSON is inconsistent: most edges have `to: string[]`, but consign-service has `to: string`.
// Always return an array so the rest of the code never has to branch.
function normalizeEdge(raw: RawEdge): string[] {
  return Array.isArray(raw.to) ? raw.to : [raw.to];
}

export function loadGraph(filePath?: string): Graph {
  const path = filePath ?? join(__dirname, '..', 'data', 'graph.json');
  let raw: RawGraph;
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Graph file not found: ${path}`);
    }
    throw new Error(`Failed to parse graph file: ${(err as Error).message}`);
  }

  // Index all declared nodes by name for O(1) lookup
  const nodes = new Map<string, GraphNode>();
  for (const node of raw.nodes) {
    nodes.set(node.name, node);
  }

  const adjacency = new Map<string, string[]>();
  const edges: Array<{ from: string; to: string }> = [];

  for (const rawEdge of raw.edges) {
    const targets = normalizeEdge(rawEdge);

    for (const target of targets) {
      // Ghost node: assurance-service is referenced in edges but missing from the nodes list.
      // Insert a placeholder rather than skipping the edge, so no connectivity is silently lost.
      if (!nodes.has(target)) {
        nodes.set(target, { name: target, kind: 'unknown' });
      }

      edges.push({ from: rawEdge.from, to: target });

      const existing = adjacency.get(rawEdge.from) ?? [];
      existing.push(target);
      adjacency.set(rawEdge.from, existing);
    }

    // Source node may have no outgoing edges yet — ensure it has an entry so DFS can start from it
    if (!adjacency.has(rawEdge.from)) {
      adjacency.set(rawEdge.from, []);
    }
  }

  // Nodes defined in the JSON but not appearing in any edge also need an adjacency entry
  for (const name of nodes.keys()) {
    if (!adjacency.has(name)) {
      adjacency.set(name, []);
    }
  }

  return { nodes, adjacency, edges };
}
