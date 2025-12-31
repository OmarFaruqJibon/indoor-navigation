export interface Node {
  qr_id: string;
  node_id: string;
  floor: number;
  x: number;
  y: number;
  type: string;
  label: string;
}

export interface Edge {
  from: string;
  to: string;
  distance: number;
  accessible: boolean;
}

export interface PathResult {
  path: string[];
  distance: number;
}

export class Graph {
  private nodes: Map<string, Node>;
  private adjacencyList: Map<string, Map<string, number>>;

  constructor(nodes: Node[], edges: Edge[], accessibleOnly: boolean = false) {
    this.nodes = new Map();
    this.adjacencyList = new Map();

    // Add nodes
    nodes.forEach((node) => {
      this.nodes.set(node.node_id, node);
      this.adjacencyList.set(node.node_id, new Map());
    });

    // Add edges
    edges.forEach((edge) => {
      if (!accessibleOnly || edge.accessible) {
        this.addEdge(edge.from, edge.to, edge.distance);
        // For undirected graph, add reverse edge
        this.addEdge(edge.to, edge.from, edge.distance);
      }
    });
  }

  private addEdge(from: string, to: string, distance: number): void {
    if (this.adjacencyList.has(from)) {
      this.adjacencyList.get(from)!.set(to, distance);
    }
  }

  public getShortestPath(start: string, end: string): PathResult | null {
    if (!this.nodes.has(start) || !this.nodes.has(end)) {
      return null;
    }

    const distances: Map<string, number> = new Map();
    const previous: Map<string, string | null> = new Map();
    const visited: Set<string> = new Set();
    const priorityQueue: [string, number][] = [];

    // Initialize distances
    this.nodes.forEach((_, nodeId) => {
      distances.set(nodeId, Infinity);
      previous.set(nodeId, null);
    });
    distances.set(start, 0);
    priorityQueue.push([start, 0]);

    while (priorityQueue.length > 0) {
      // Sort priority queue (min-heap simulation)
      priorityQueue.sort((a, b) => a[1] - b[1]);
      const [currentNode, currentDistance] = priorityQueue.shift()!;

      if (visited.has(currentNode)) continue;
      visited.add(currentNode);

      if (currentNode === end) break;

      const neighbors = this.adjacencyList.get(currentNode);
      if (!neighbors) continue;

      for (const [neighbor, weight] of neighbors.entries()) {
        if (visited.has(neighbor)) continue;

        const newDistance = currentDistance + weight;
        const currentNeighborDistance = distances.get(neighbor) || Infinity;

        if (newDistance < currentNeighborDistance) {
          distances.set(neighbor, newDistance);
          previous.set(neighbor, currentNode);
          priorityQueue.push([neighbor, newDistance]);
        }
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let currentNode: string | null = end;

    while (currentNode !== null) {
      path.unshift(currentNode);
      currentNode = previous.get(currentNode) || null;
    }

    // Check if path exists
    if (path.length === 1 && path[0] !== start) {
      return null;
    }

    const totalDistance = distances.get(end) || Infinity;

    return {
      path,
      distance: totalDistance,
    };
  }

  public getAllNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  public getNode(nodeId: string): Node | undefined {
    return this.nodes.get(nodeId);
  }

  public getNodesByType(type: string): Node[] {
    return this.getAllNodes().filter((node) => node.type === type);
  }
}
