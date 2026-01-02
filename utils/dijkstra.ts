// utils/dijkstra.ts
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
}

export interface PathResult {
  path: string[];
  distance: number;
  floorChange: boolean;
  targetFloor?: number;
  message?: string;
}

export class Graph {
  private nodes: Map<string, Node>;
  private adjacencyList: Map<string, Map<string, number>>;

  constructor(nodes: Node[], edges: Edge[]) {
    this.nodes = new Map();
    this.adjacencyList = new Map();

    // Add nodes
    nodes.forEach(node => {
      this.nodes.set(node.node_id, node);
      this.adjacencyList.set(node.node_id, new Map());
    });

    // Add edges
    edges.forEach(edge => {
        this.addEdge(edge.from, edge.to, edge.distance);
        this.addEdge(edge.to, edge.from, edge.distance);

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

    const startNode = this.nodes.get(start)!;
    const endNode = this.nodes.get(end)!;
    
    if (startNode.floor !== endNode.floor) {
      console.log(`Starting cross-floor navigation from floor ${startNode.floor} to ${endNode.floor}`);
      return this.getCrossFloorPath(startNode, endNode);
    }

    // Same floor path calculation
    console.log(`Same floor navigation on floor ${startNode.floor}`);
    return this.getSameFloorPath(start, end);
  }

  private getCrossFloorPath(startNode: Node, endNode: Node): PathResult {
    console.log(`Looking for cross-floor path from floor ${startNode.floor} to ${endNode.floor}`);
    
    const stairsOnCurrentFloor = this.getStairsOnFloor(startNode.floor);
    console.log(`Found ${stairsOnCurrentFloor.length} stairs on floor ${startNode.floor}:`, 
      stairsOnCurrentFloor.map(s => s.node_id));
        
    if (stairsOnCurrentFloor.length === 0) {
      return {
        path: [],
        distance: 0,
        floorChange: true,
        targetFloor: endNode.floor,
        message: `No stairs found on floor ${startNode.floor}. Please use elevator or find alternative route.`
      };
    }

    let nearestStair: Node | null = null;
    let minDistance = Infinity;
    let pathToStair: string[] = [];
    let stairDistance = 0;

    for (const stair of stairsOnCurrentFloor) {
      console.log(`Checking stair ${stair.node_id} on floor ${stair.floor}`);
      const canReachTargetFloor = this.canStairReachFloor(stair.node_id, endNode.floor);
      console.log(`Stair ${stair.node_id} can reach floor ${endNode.floor}: ${canReachTargetFloor}`);
      
      if (canReachTargetFloor) {
        const pathToStairResult = this.getSameFloorPath(startNode.node_id, stair.node_id);
        console.log(`Path to stair ${stair.node_id}:`, pathToStairResult ? `Found (distance: ${pathToStairResult.distance})` : 'Not found');
        
        if (pathToStairResult && pathToStairResult.distance < minDistance) {
          minDistance = pathToStairResult.distance;
          nearestStair = stair;
          pathToStair = pathToStairResult.path;
          stairDistance = pathToStairResult.distance;
        }
      }
    }

    if (!nearestStair) {
      console.log("No stair found that can reach target floor, looking for any stair...");
      for (const stair of stairsOnCurrentFloor) {
        const pathToStairResult = this.getSameFloorPath(startNode.node_id, stair.node_id);
        if (pathToStairResult && pathToStairResult.distance < minDistance) {
          minDistance = pathToStairResult.distance;
          nearestStair = stair;
          pathToStair = pathToStairResult.path;
          stairDistance = pathToStairResult.distance;
        }
      }

      if (!nearestStair) {
        return {
          path: [],
          distance: 0,
          floorChange: true,
          targetFloor: endNode.floor,
          message: `Cannot find accessible path to stairs on floor ${startNode.floor}.`
        };
      }

      console.log(`Found nearest stair: ${nearestStair.node_id} (distance: ${stairDistance})`);
      return {
        path: pathToStair,
        distance: stairDistance,
        floorChange: true,
        targetFloor: endNode.floor,
        message: `Please use ${nearestStair.label} to access other floors, then scan a QR code to continue navigation.`
      };
    }

    console.log(`Found accessible stair to target floor: ${nearestStair.node_id} (distance: ${stairDistance})`);
    return {
      path: pathToStair,
      distance: stairDistance,
      floorChange: true,
      targetFloor: endNode.floor,
      message: `Please use ${nearestStair.label} to go to floor ${endNode.floor}, then scan a QR code to continue navigation.`
    };
  }

  private canStairReachFloor(stairId: string, targetFloor: number): boolean {
    const visited = new Set<string>();
    const queue: string[] = [stairId];
    
    while (queue.length > 0) {
      const currentStairId = queue.shift()!;
      
      if (visited.has(currentStairId)) continue;
      visited.add(currentStairId);
      
      const currentStair = this.nodes.get(currentStairId);
      if (!currentStair) continue;
      
      if (currentStair.floor === targetFloor) {
        console.log(`✅ Found stair on target floor ${targetFloor}: ${currentStairId}`);
        return true;
      }
      
      const neighbors = this.adjacencyList.get(currentStairId);
      if (!neighbors) continue;
      
      for (const [neighborId] of neighbors.entries()) {
        const neighbor = this.nodes.get(neighborId);

        if (neighbor && neighbor.type === 'stair') {
          console.log(`Following stair connection: ${currentStairId} (floor ${currentStair.floor}) -> ${neighborId} (floor ${neighbor.floor})`);
          queue.push(neighborId);
        }
      }
    }
    
    console.log(`No path found from ${stairId} to floor ${targetFloor}`);
    return false;
  }

  private doesStairConnectToFloor(stair: Node, targetFloor: number): boolean {
    const neighbors = this.adjacencyList.get(stair.node_id);
    if (!neighbors) return false;

    for (const [neighborId] of neighbors.entries()) {
      const neighbor = this.nodes.get(neighborId);
      if (neighbor && neighbor.floor === targetFloor && neighbor.type === 'stair') {
        return true;
      }
    }
    
    return false;
  }

  private getSameFloorPath(start: string, end: string): PathResult | null {
    const distances: Map<string, number> = new Map();
    const previous: Map<string, string | null> = new Map();
    const visited: Set<string> = new Set();
    const priorityQueue: [string, number][] = [];

    const startNode = this.nodes.get(start);
    const endNode = this.nodes.get(end);
    
    if (!startNode || !endNode) return null;

    this.nodes.forEach((node, nodeId) => {
      if (node.floor === startNode.floor) {
        distances.set(nodeId, Infinity);
        previous.set(nodeId, null);
      }
    });
    
    distances.set(start, 0);
    priorityQueue.push([start, 0]);

    while (priorityQueue.length > 0) {
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

    const path: string[] = [];
    let currentNode: string | null = end;

    while (currentNode !== null) {
      path.unshift(currentNode);
      currentNode = previous.get(currentNode) || null;
    }

    if (path.length === 1 && path[0] !== start) {
      return null;
    }

    const totalDistance = distances.get(end) || Infinity;
    
    return {
      path,
      distance: totalDistance,
      floorChange: false
    };
  }

  private getStairsOnFloor(floor: number): Node[] {
    const stairs: Node[] = [];
    this.nodes.forEach(node => {
      if (node.floor === floor && node.type === 'stair') {
        stairs.push(node);
      }
    });
    return stairs;
  }

  public getAllNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  public getNode(nodeId: string): Node | undefined {
    return this.nodes.get(nodeId);
  }

  public getNodesByType(type: string): Node[] {
    return this.getAllNodes().filter(node => node.type === type);
  }

  public getNodesByFloor(floor: number): Node[] {
    return this.getAllNodes().filter(node => node.floor === floor);
  }

  public getFloors(): number[] {
    const floors = new Set<number>();
    this.nodes.forEach(node => {
      floors.add(node.floor);
    });
    return Array.from(floors).sort((a, b) => a - b);
  }

  public searchNodes(query: string): Node[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllNodes().filter(node => 
      node.label.toLowerCase().includes(lowerQuery) ||
      node.type.toLowerCase().includes(lowerQuery) ||
      node.node_id.toLowerCase().includes(lowerQuery)
    );
  }

  public getConnectedFloors(fromFloor: number): number[] {
    const connectedFloors = new Set<number>();
    
    // Get all stairs on the from floor
    const stairs = this.getStairsOnFloor(fromFloor);
    
    stairs.forEach(stair => {
      const neighbors = this.adjacencyList.get(stair.node_id);
      if (neighbors) {
        for (const [neighborId] of neighbors.entries()) {
          const neighbor = this.nodes.get(neighborId);
          if (neighbor && neighbor.type === 'stair' && neighbor.floor !== fromFloor) {
            connectedFloors.add(neighbor.floor);
          }
        }
      }
    });
    
    return Array.from(connectedFloors).sort((a, b) => a - b);
  }

  // Get path with detailed step information
  public getDetailedPath(start: string, end: string): {
    path: string[];
    distance: number;
    steps: {
      nodeId: string;
      label: string;
      type: string;
      floor: number;
      distanceFromStart: number;
    }[];
    floorChange: boolean;
    message?: string;
  } | null {
    const result = this.getShortestPath(start, end);
    if (!result) return null;

    const steps = result.path.map((nodeId, index) => {
      const node = this.nodes.get(nodeId)!;
      let distanceFromStart = 0;
      if (index > 0) {
        for (let i = 0; i < index; i++) {
          const fromNode = result.path[i];
          const toNode = result.path[i + 1];
          const edgeDistance = this.adjacencyList.get(fromNode)?.get(toNode) || 0;
          distanceFromStart += edgeDistance;
        }
      }
      
      return {
        nodeId,
        label: node.label,
        type: node.type,
        floor: node.floor,
        distanceFromStart
      };
    });

    return {
      path: result.path,
      distance: result.distance,
      steps,
      floorChange: result.floorChange,
      message: result.message
    };
  }

  public hasPath(start: string, end: string): boolean {
    const result = this.getShortestPath(start, end);
    return result !== null && result.path.length > 0;
  }

  public getReachableNodes(start: string, maxDistance: number): Node[] {
    const startNode = this.nodes.get(start);
    if (!startNode) return [];

    const distances: Map<string, number> = new Map();
    const visited: Set<string> = new Set();
    const queue: [string, number][] = [[start, 0]];
    
    distances.set(start, 0);
    const reachableNodes: Node[] = [];

    while (queue.length > 0) {
      const [currentNode, currentDistance] = queue.shift()!;
      
      if (visited.has(currentNode)) continue;
      visited.add(currentNode);

      const node = this.nodes.get(currentNode);
      if (node && currentNode !== start) {
        reachableNodes.push(node);
      }

      const neighbors = this.adjacencyList.get(currentNode);
      if (!neighbors) continue;

      for (const [neighbor, weight] of neighbors.entries()) {
        const newDistance = currentDistance + weight;
        if (newDistance <= maxDistance) {
          const existingDistance = distances.get(neighbor) || Infinity;
          if (newDistance < existingDistance) {
            distances.set(neighbor, newDistance);
            queue.push([neighbor, newDistance]);
          }
        }
      }
    }

    return reachableNodes;
  }
}