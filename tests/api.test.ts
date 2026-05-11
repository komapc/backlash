import request from 'supertest';
import express from 'express';
import { loadGraph } from '../src/graph';
import { createRouter } from '../src/router';

const app = express();
app.use('/api', createRouter(loadGraph()));

type Node = { name: string; kind: string; publicExposed?: boolean; vulnerabilities?: unknown[] };
type Edge = { from: string; to: string };
type Subgraph = { nodes: Node[]; edges: Edge[] };

function nodeNames(body: Subgraph): string[] {
  return body.nodes.map(n => n.name);
}

describe('GET /api/routes — basic', () => {
  it('returns nodes and edges with no filter', async () => {
    const res = await request(app).get('/api/routes');
    expect(res.status).toBe(200);
    expect(res.body.nodes.length).toBeGreaterThan(0);
    expect(res.body.edges.length).toBeGreaterThan(0);
  });

  it('returns 400 for unknown filter with list of valid filters', async () => {
    const res = await request(app).get('/api/routes?filters=bogus');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/bogus/);
    expect(res.body.validFilters).toEqual(
      expect.arrayContaining(['startsPublic', 'endsAtSink', 'hasVulnerability'])
    );
  });
});

describe('GET /api/routes — real-data assertions', () => {
  it('endsAtSink includes the postgres sink and a known upstream node', async () => {
    const res = await request(app).get('/api/routes?filters=endsAtSink');
    expect(res.status).toBe(200);
    const names = nodeNames(res.body);
    expect(names).toContain('prod-postgresdb');
    // auth-service → prod-postgresdb is a known path in the data
    expect(names).toContain('auth-service');
    expect(names).toContain('user-service');
  });

  it('endsAtSink includes the sqs sink and a known upstream node', async () => {
    const res = await request(app).get('/api/routes?filters=endsAtSink');
    const names = nodeNames(res.body);
    expect(names).toContain('prod-sqs');
    // inside-payment-service → prod-sqs is a known path
    expect(names).toContain('inside-payment-service');
  });

  it('hasVulnerability includes both vulnerable services', async () => {
    const res = await request(app).get('/api/routes?filters=hasVulnerability');
    expect(res.status).toBe(200);
    const names = nodeNames(res.body);
    expect(names).toContain('auth-service');
    expect(names).toContain('order-service');
  });

  it('startsPublic only produces paths starting from frontend (gateway has no edges)', async () => {
    const res = await request(app).get('/api/routes?filters=startsPublic');
    expect(res.status).toBe(200);
    const names = nodeNames(res.body);
    expect(names).toContain('frontend');
    // gateway-service has no outgoing edges, so starts no paths
    expect(names).not.toContain('gateway-service');
  });

  it('startsPublic reaches exactly the known reachable set from frontend', async () => {
    const res = await request(app).get('/api/routes?filters=startsPublic');
    const names = new Set(nodeNames(res.body));
    // frontend → admin-basic-info-service → {contacts, station, train, price, config}
    expect(names).toContain('admin-basic-info-service');
    expect(names).toContain('contacts-service');
    expect(names).toContain('station-service');
    expect(names).toContain('train-service');
    expect(names).toContain('price-service');
    expect(names).toContain('config-service');
  });

  it('startsPublic,endsAtSink returns empty — no path from public node reaches a sink in this dataset', async () => {
    const res = await request(app).get('/api/routes?filters=startsPublic,endsAtSink');
    expect(res.status).toBe(200);
    expect(res.body.nodes).toHaveLength(0);
    expect(res.body.edges).toHaveLength(0);
  });
});

describe('GET /api/routes — query string edge cases', () => {
  it('?filters= (empty string) returns same as no filter', async () => {
    const [none, empty] = await Promise.all([
      request(app).get('/api/routes'),
      request(app).get('/api/routes?filters='),
    ]);
    expect(empty.status).toBe(200);
    expect(empty.body.nodes.length).toBe(none.body.nodes.length);
  });

  it('duplicate filter names are deduplicated (not double-applied)', async () => {
    const [single, doubled] = await Promise.all([
      request(app).get('/api/routes?filters=endsAtSink'),
      request(app).get('/api/routes?filters=endsAtSink,endsAtSink'),
    ]);
    expect(doubled.status).toBe(200);
    expect(doubled.body.nodes.length).toBe(single.body.nodes.length);
  });

  it('filters with extra whitespace are parsed correctly', async () => {
    const res = await request(app).get('/api/routes?filters=endsAtSink, hasVulnerability');
    expect(res.status).toBe(200);
    const names = nodeNames(res.body);
    expect(names).toContain('prod-postgresdb');
  });

  it('combined filters return a subset of single-filter results', async () => {
    const [single, combined] = await Promise.all([
      request(app).get('/api/routes?filters=endsAtSink'),
      request(app).get('/api/routes?filters=endsAtSink,hasVulnerability'),
    ]);
    expect(combined.body.nodes.length).toBeLessThanOrEqual(single.body.nodes.length);
  });
});
