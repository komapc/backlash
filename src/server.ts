import express from 'express';
import { loadGraph } from './graph';
import { createRouter } from './router';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

const graph = loadGraph();
app.use('/api', createRouter(graph));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app };
