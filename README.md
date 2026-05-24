# Backslash Home Exercise — Graph Query API

A RESTful API that loads a microservice dependency graph from a JSON file and provides a filterable query engine over it.

## Solution Overview

The JSON file describes a directed graph of microservices (nodes) and their call relationships (edges). The API exposes endpoints to query **routes** through that graph — where a route is any maximal simple path from a source service to a sink — optionally filtered by node properties.

No database. No persistence. The graph is loaded once at startup, all paths are pre-computed, and every request is a plain array scan over that pre-computed list.

### How it works

#### Phase 1 — Load (once at startup)

Parse the JSON into two in-memory structures:

- `Map<name, GraphNode>` — O(1) node lookup by name
- `Map<name, string[]>` — adjacency list of outgoing neighbors per node

#### Phase 2 — Pre-compute all paths (once at startup)

**Step 1: Assert DAG.**  
DFS with three-color marking (white / gray / black) confirms no cycles exist. A gray neighbor during DFS means a back-edge — the traversal throws immediately. This guarantee is required for the next step.

**Step 2: Topological sort (Kahn's algorithm).**  
BFS over node in-degrees produces an ordering where every node appears before all its downstream neighbors:

```
frontend → gateway → auth-service → ... → postgresdb
```

**Step 3: DP path collection.**  
Iterate the topological order **in reverse** — sinks first, sources last. At each node:

- **Sink** (no outgoing edges): `suffixes[node] = [[node]]` — one path, just itself.
- **Non-sink**: `suffixes[node] = [node] prepended to every path in suffixes[neighbor]`, for each neighbor.

Because we go sinks-first, every neighbor's paths are already computed when we need them. No recursion, no re-traversal — each shared suffix is computed exactly once and reused by all upstream nodes.

The result is `allPaths: GraphNode[][]` — every maximal path in the graph, stored flat in memory.

#### Phase 3 — Per request

1. Parse and validate filter names from the query string.
2. `allPaths.filter(path => every requested filter passes)` — plain array scan, O(P) where P = number of paths.
3. Deduplicate all nodes and edges that appear in matching paths into `{ nodes[], edges[] }`.
4. Return JSON — the shape is directly renderable by graph libraries (Cytoscape, React Flow, etc.).

### Key Design Decisions

**Filters are AND-combined.** A path must satisfy *all* requested filters. This matches the security-analysis use case: "find me routes that start public AND reach a database AND pass through a vulnerable service."

**Filter registry pattern.** Each filter is a single `(path: GraphNode[]) => boolean` function stored in a plain `Record`. Adding a new filter requires one line — no routing changes, no new classes, no configuration.

**Response = merged subgraph.** All nodes and edges that appear in any matching path are deduplicated and returned as `{ nodes, edges }`. This is the shape most graph rendering libraries expect directly.

### Assumptions

**Node names are unique.** Each node is identified solely by its `name` field. The graph is stored as a `Map<string, GraphNode>` keyed by name — a duplicate name would silently overwrite the earlier entry. The input data upholds this (microservice names are unique within a deployment), but the API does not validate it explicitly.

### Data Quirks Handled

- `consign-service` has `"to"` as a string instead of an array — normalized on load.
- `assurance-service` is referenced in edges but has no node definition — inserted as a ghost node with `kind: "unknown"`.
- `gateway-service` is defined but has no outgoing edges — treated as a valid leaf; it appears in the graph but starts no paths.

### Observation

In the provided JSON, no path exists from a public node (`frontend` or `gateway-service`) all the way to a sink (`prod-postgresdb` or `prod-sqs`). `frontend` reaches only five leaf services via `admin-basic-info-service`, and `gateway-service` has no outgoing edges. The `startsPublic,endsAtSink` combined filter therefore returns an empty subgraph — this is correct behavior given the data, not a bug.

---

## API

### `GET /api/routes`

Returns a subgraph of nodes and edges matching all requested filters.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `filters` | `string` | Comma-separated list of filter names. Optional — omit to return the full graph. |

**Available filters:**

| Name | Keeps paths where… |
|------|-------------------|
| `startsPublic` | First node has `publicExposed: true` |
| `endsAtSink` | Last node has `kind: "rds"` or `"sqs"` |
| `hasVulnerability` | At least one node has a non-empty `vulnerabilities` array |

**Response:**
```json
{
  "nodes": [
    { "name": "auth-service", "hasVulnerability": true },
    { "name": "prod-postgresdb", "hasVulnerability": false }
  ],
  "edges": [
    { "from": "auth-service", "to": "prod-postgresdb" }
  ]
}
```

**Error (unknown filter):**
```json
{
  "error": "Unknown filter(s): foo",
  "validFilters": ["startsPublic", "endsAtSink", "hasVulnerability"]
}
```

---

## Running

```bash
npm install
npm run dev        # development server on :3000
npm run build      # compile TypeScript
npm start          # run compiled output
npm test           # run all tests
```

### Example requests

```bash
# Full graph
curl http://localhost:3000/api/routes

# Paths starting from a public service
curl "http://localhost:3000/api/routes?filters=startsPublic"

# Paths ending at a database/queue sink
curl "http://localhost:3000/api/routes?filters=endsAtSink"

# Paths containing a vulnerable node
curl "http://localhost:3000/api/routes?filters=hasVulnerability"

# All three combined
curl "http://localhost:3000/api/routes?filters=startsPublic,endsAtSink,hasVulnerability"

# Invalid filter → 400
curl "http://localhost:3000/api/routes?filters=unknown"
```

---

## Adding a New Filter

Add a single entry to the `FILTERS` object in `src/filters.ts`:

```typescript
export const FILTERS: Record<string, PathFilter> = {
  startsPublic:      (path) => path[0]?.publicExposed === true,
  endsAtSink:        (path) => SINK_KINDS.has(path.at(-1)?.kind ?? ''),
  hasVulnerability:  (path) => path.some(n => (n.vulnerabilities?.length ?? 0) > 0),

  // New filter — paths that only use Java services:
  javaOnly:          (path) => path.every(n => !n.language || n.language === 'java'),
};
```

No other changes needed.

---

## Project Structure

```
src/
  types.ts       — TypeScript interfaces
  graph.ts       — JSON loader, edge normalizer, adjacency map builder
  traversal.ts   — DAG cycle check, topological sort, DP path finder
  filters.ts     — filter registry and built-in filters
  router.ts      — Express route and subgraph builder
  server.ts      — entry point
data/
  graph.json     — microservice graph (Train Ticket system)
tests/
  traversal.test.ts
  filters.test.ts
  api.test.ts
```
