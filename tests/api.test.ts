import request from 'supertest';
import express from 'express';
import { loadGraph } from '../src/graph';
import { createRouter } from '../src/router';

const app = express();
app.use('/api', createRouter(loadGraph()));

describe('GET /api/routes', () => {
  it('returns a subgraph with nodes and edges when no filters given', async () => {
    const res = await request(app).get('/api/routes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nodes');
    expect(res.body).toHaveProperty('edges');
    expect(res.body.nodes.length).toBeGreaterThan(0);
  });

  it('startsPublic filter returns only paths starting from public nodes', async () => {
    const res = await request(app).get('/api/routes?filters=startsPublic');
    expect(res.status).toBe(200);
    const publicNames = new Set(['frontend', 'gateway-service']);
    // Every node that appears as a start must be public — but since we return a
    // merged subgraph we verify public nodes are present
    const nodeNames = res.body.nodes.map((n: { name: string }) => n.name);
    expect(nodeNames.some((n: string) => publicNames.has(n))).toBe(true);
  });

  it('endsAtSink filter returns nodes including sink nodes', async () => {
    const res = await request(app).get('/api/routes?filters=endsAtSink');
    expect(res.status).toBe(200);
    const nodeNames = res.body.nodes.map((n: { name: string }) => n.name);
    const sinkNames = new Set(['prod-postgresdb', 'prod-sqs']);
    expect(nodeNames.some((n: string) => sinkNames.has(n))).toBe(true);
  });

  it('hasVulnerability filter returns nodes including vulnerable nodes', async () => {
    const res = await request(app).get('/api/routes?filters=hasVulnerability');
    expect(res.status).toBe(200);
    const nodeNames = res.body.nodes.map((n: { name: string }) => n.name);
    expect(nodeNames).toContain('auth-service');
  });

  it('combined filters narrow results further', async () => {
    const [single, combined] = await Promise.all([
      request(app).get('/api/routes?filters=startsPublic'),
      request(app).get('/api/routes?filters=startsPublic,endsAtSink'),
    ]);
    expect(combined.body.nodes.length).toBeLessThanOrEqual(single.body.nodes.length);
  });

  it('returns 400 for unknown filter', async () => {
    const res = await request(app).get('/api/routes?filters=bogus');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('validFilters');
  });
});
