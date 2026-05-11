import { Router, Request, Response } from 'express';
import { Graph } from './graph';
import { findAllPaths } from './traversal';
import { applyFilters, validateFilters, FILTERS } from './filters';
import { GraphNode, SubGraph } from './types';

export function createRouter(graph: Graph): Router {
  const router = Router();

  // Pre-compute all paths once
  const allPaths = findAllPaths(graph);

  router.get('/routes', (req: Request, res: Response) => {
    const { filterNames, error } = parseFilters(req);
    if (error) { res.status(400).json(error); return; }
    const matchedPaths = applyFilters(allPaths, filterNames);
    res.json(buildSubgraph(matchedPaths, graph));
  });

  router.get('/paths', (req: Request, res: Response) => {
    const { filterNames, error } = parseFilters(req);
    if (error) { res.status(400).json(error); return; }

    const matchedPaths = applyFilters(allPaths, filterNames);

    // Per-filter breakdown: how many paths each filter alone would return
    const breakdown: Record<string, number> = {};
    for (const name of Object.keys(FILTERS)) {
      breakdown[name] = applyFilters(allPaths, [name]).length;
    }

    res.json({
      count: matchedPaths.length,
      totalUnfiltered: allPaths.length,
      appliedFilters: filterNames,
      breakdown,
      paths: matchedPaths.map(p => p.map(n => n.name)),
    });
  });

  return router;
}

function parseFilters(req: Request): { filterNames: string[]; error?: object } {
  const raw = (req.query.filters as string | undefined) ?? '';
  const filterNames = raw
    ? [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))]
    : [];
  const invalid = validateFilters(filterNames);
  if (invalid.length > 0) {
    return { filterNames: [], error: { error: `Unknown filter(s): ${invalid.join(', ')}`, validFilters: Object.keys(FILTERS) } };
  }
  return { filterNames };
}

function buildSubgraph(paths: GraphNode[][], graph: Graph): SubGraph {
  const nodeSet = new Set<string>();
  const edgeSet = new Set<string>();

  for (const path of paths) {
    for (let i = 0; i < path.length; i++) {
      nodeSet.add(path[i].name);
      if (i < path.length - 1) {
        edgeSet.add(`${path[i].name}__${path[i + 1].name}`);
      }
    }
  }

  const nodes = Array.from(nodeSet).map(name => graph.nodes.get(name)!);
  const edges = Array.from(edgeSet).map(key => {
    const [from, to] = key.split('__');
    return { from, to };
  });

  return { nodes, edges };
}
