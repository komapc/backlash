# Backslash Home Exercise — Graph Query API

A RESTful API that loads a microservice dependency graph from a JSON file and provides a filterable query engine over it.

## Solution Overview

The problem is a graph traversal problem. The JSON file describes a directed graph of microservices (nodes) and their call relationships (edges). The API exposes endpoints to query **routes** through that graph — where a route is any simple path (no repeated nodes) between two services — filtered by node properties.

### Architecture

```
JSON file
  └─ loadGraph()        normalize edges, build adjacency map, insert ghost nodes
       └─ findAllPaths()    DFS from every node → collect all simple maximal paths
            └─ applyFilters()   keep paths matching all requested filters (AND logic)
                 └─ buildSubgraph()  deduplicate nodes + edges → return renderable graph
```

No database. No persistence. The graph is loaded once at startup and kept in memory.

### Key Design Decisions

**Route = maximal simple path.** A path is recorded only when it can no longer be extended (dead end or all neighbors already on the current path). This avoids redundant sub-paths and keeps the traversal output clean.

**Filters are AND-combined.** A path must satisfy *all* requested filters. This matches the security-analysis use case: "find me routes that start public AND reach a database AND pass through a vulnerable service."

**Filter registry pattern.** Each filter is a single `(path: GraphNode[]) => boolean` function stored in a plain `Record`. Adding a new filter requires only one line — no routing changes, no new classes, no configuration.

**Response = merged subgraph.** All nodes and edges that appear in any matching path are deduplicated and returned as `{ nodes, edges }`. This is the shape most graph rendering libraries (e.g. Cytoscape, React Flow) expect directly.

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
    {
      "name": "auth-service",
      "kind": "service",
      "language": "java",
      "path": "train-ticket/ts-auth-service",
      "publicExposed": false,
      "vulnerabilities": [...]
    }
  ],
  "edges": [
    { "from": "user-service", "to": "auth-service" }
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
  traversal.ts   — DFS path finder
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
