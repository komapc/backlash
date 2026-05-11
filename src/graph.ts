import { readFileSync } from 'fs';
import { join } from 'path';
import { GraphNode, RawGraph, RawEdge } from './types';

export interface Graph {
  nodes: Map<string, GraphNode>;
  adjacency: Map<string, string[]>;
  edges: Array<{ from: string; to: string }>;
}

function normalizeEdge(raw: RawEdge): string[] {
  return Array.isArray(raw.to) ? raw.to : [raw.to];
}

export function loadGraph(filePath?: string): Graph {
  const path = filePath ?? join(__dirname, '..', 'data', 'graph.json');
  const raw: RawGraph = JSON.parse(readFileSync(path, 'utf-8'));

  const nodes = new Map<string, GraphNode>();
  for (const node of raw.nodes) {
    nodes.set(node.name, node);
  }

  const adjacency = new Map<string, string[]>();
  const edges: Array<{ from: string; to: string }> = [];

  for (const rawEdge of raw.edges) {
    const targets = normalizeEdge(rawEdge);

    for (const target of targets) {
      // Insert ghost node for any target not defined in nodes
      if (!nodes.has(target)) {
        nodes.set(target, { name: target, kind: 'unknown' });
      }

      edges.push({ from: rawEdge.from, to: target });

      const existing = adjacency.get(rawEdge.from) ?? [];
      existing.push(target);
      adjacency.set(rawEdge.from, existing);
    }

    // Ensure source node also exists in adjacency map (even if no outgoing edges added yet)
    if (!adjacency.has(rawEdge.from)) {
      adjacency.set(rawEdge.from, []);
    }
  }

  // Ensure every node has an entry in the adjacency map
  for (const name of nodes.keys()) {
    if (!adjacency.has(name)) {
      adjacency.set(name, []);
    }
  }

  return { nodes, adjacency, edges };
}
