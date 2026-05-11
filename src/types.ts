export interface Vulnerability {
  file: string;
  severity: string;
  message: string;
  metadata?: Record<string, string>;
}

export interface GraphNode {
  name: string;
  kind: string;
  language?: string;
  path?: string;
  publicExposed?: boolean;
  vulnerabilities?: Vulnerability[];
  metadata?: Record<string, unknown>;
}

export interface RawEdge {
  from: string;
  to: string | string[];
}

export interface RawGraph {
  nodes: GraphNode[];
  edges: RawEdge[];
}

export interface SubGraph {
  nodes: GraphNode[];
  edges: Array<{ from: string; to: string }>;
}

export type PathFilter = (path: GraphNode[]) => boolean;
