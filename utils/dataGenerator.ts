// utils/dataGenerator.ts
import { Edge, Node } from './dijkstra';

const baseNodes: Omit<Node, 'floor'>[] = [
  { qr_id: "entrance", node_id: "entrance", x: 931.02, y: 364.36, type: "entrance", label: "Main Entrance" },
  { qr_id: "j1", node_id: "j1", x: 822.85, y: 364.36, type: "junction", label: "Junction 1" },
  { qr_id: "j2", node_id: "j2", x: 599.68, y: 364.36, type: "junction", label: "Junction 2" },
  { qr_id: "j3", node_id: "j3", x: 484.58, y: 364.36, type: "junction", label: "Junction 3" },
  { qr_id: "j4", node_id: "j4", x: 198.09, y: 364.36, type: "junction", label: "Junction 4" },
  { qr_id: "j5", node_id: "j5", x: 198.09, y: 1234.32, type: "junction", label: "Junction 5" },
  { qr_id: "j6", node_id: "j6", x: 305.98, y: 1234.32, type: "junction", label: "Junction 6" },
  { qr_id: "j7", node_id: "j7", x: 484.58, y: 1234.32, type: "junction", label: "Junction 7" },
  { qr_id: "j8", node_id: "j8", x: 484.58, y: 1119.12, type: "junction", label: "Junction 8" },
  { qr_id: "j9", node_id: "j9", x: 822.85, y: 1119.12, type: "junction", label: "Junction 9" },
  { qr_id: "cf", node_id: "cf", x: 599.68, y: 305.74, type: "café", label: "Café" },
  { qr_id: "rst", node_id: "rst", x: 484.58, y: 640.78, type: "restaurant", label: "Restaurant" },
  { qr_id: "stair", node_id: "stair", x: 198.09, y: 177.72, type: "stair", label: "Staircase" },
  { qr_id: "ex", node_id: "ex", x: 305.98, y: 1388.67, type: "exit", label: "Exit" },
];

// Base shop positions
const shopPositions = [
  { x: 198.09, y: 514.4 },
  { x: 198.09, y: 836.88 },
  { x: 198.09, y: 1130.93 },
  { x: 484.58, y: 996 },
  { x: 198.09, y: 994.79 },
  { x: 822.85, y: 997.37 },
  { x: 647.8, y: 1119.12 },
  { x: 822.85, y: 841.4 },
  { x: 484.58, y: 894 },
  { x: 822.85, y: 622.4 },
];

// Base edges
const baseEdges: Omit<Edge, 'floor'>[] = [
  { from: "entrance", to: "j1", distance: 10.82 },
  { from: "j1", to: "j2", distance: 22.32 },
  { from: "j2", to: "j3", distance: 11.51 },
  { from: "j3", to: "j4", distance: 28.72 },
  { from: "j1", to: "shop10", distance: 27.64 },
  { from: "shop10", to: "shop8", distance: 15.92 },
  { from: "shop8", to: "shop6", distance: 19.74 },
  { from: "shop6", to: "j9", distance: 12.17 },
  { from: "j2", to: "cf", distance: 5.86 },
  { from: "j3", to: "rst", distance: 27.64 },
  { from: "rst", to: "shop9", distance: 15.92 },
  { from: "shop9", to: "shop4", distance: 18.00 },
  { from: "shop4", to: "j8", distance: 13.91 },
  { from: "j8", to: "j7", distance: 11.52 },
  { from: "j8", to: "shop7", distance: 7.60 },
  { from: "shop7", to: "j9", distance: 26.00 },
  { from: "j7", to: "j6", distance: 17.86 },
  { from: "j6", to: "j5", distance: 10.79 },
  { from: "j4", to: "shop1", distance: 2.10 },
  { from: "j4", to: "shop2", distance: 47.25 },
  { from: "shop2", to: "shop5", distance: 15.80 },
  { from: "shop5", to: "shop3", distance: 13.60 },
  { from: "shop3", to: "j5", distance: 10.34 },
  { from: "j4", to: "stair", distance: 18.66 },
  { from: "j6", to: "ex", distance: 15.43 },
];

// Helper function
function distance(a: Node, b: Node): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function findNearestWalkableNode(stair: Node, nodes: Node[]): Node | null {
  let nearest: Node | null = null;
  let min = Infinity;

  for (const n of nodes) {
    if (n.type !== 'stair') {
      const d = distance(stair, n);
      if (d < min) {
        min = d;
        nearest = n;
      }
    }
  }

  return nearest;
}

export function generateMultiFloorData(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Generate nodes for each floor (1-10)
  for (let floor = 1; floor <= 10; floor++) {
    // Add base nodes for this floor
    baseNodes.forEach(baseNode => {
      nodes.push({
        ...baseNode,
        node_id: `${baseNode.node_id}_${floor}`,
        qr_id: `${baseNode.qr_id}_${floor}`,
        floor,
        label: `${baseNode.label} (Floor ${floor})`,
      });
    });

    // Add shops for this floor
    for (let shopNum = 1; shopNum <= 10; shopNum++) {
      const globalShopNum = (floor - 1) * 10 + shopNum;
      const pos = shopPositions[shopNum - 1];
      nodes.push({
        qr_id: `shop${globalShopNum}_${floor}`,
        node_id: `shop${globalShopNum}_${floor}`,
        floor,
        x: pos.x,
        y: pos.y,
        type: "shop",
        label: `Store ${globalShopNum} (Floor ${floor})`,
      });
    }

    // Add edges for this floor
    baseEdges.forEach(e => {
      let from = e.from;
      let to = e.to;

      // Handle shop node IDs
      if (from.startsWith("shop")) {
        const shopNum = parseInt(from.replace("shop", ""));
        from = `shop${(floor - 1) * 10 + shopNum}_${floor}`;
      }
      if (to.startsWith("shop")) {
        const shopNum = parseInt(to.replace("shop", ""));
        to = `shop${(floor - 1) * 10 + shopNum}_${floor}`;
      }

      // Add floor suffix to other nodes
      from = `${from}_${floor}`;
      to = `${to}_${floor}`;

      edges.push({ from, to, distance: e.distance });
    });
  }

  // Connect staircases between floors
  for (let floor = 1; floor <= 10; floor++) {
    // Connect to floor above (if exists)
    if (floor < 10) {
      edges.push({ 
        from: `stair_${floor}`, 
        to: `stair_${floor + 1}`, 
        distance: 5 // Staircase travel distance
      });
    }
    // Connect to floor below (if exists)
    if (floor > 1) {
      edges.push({ 
        from: `stair_${floor}`, 
        to: `stair_${floor - 1}`, 
        distance: 5 // Staircase travel distance
      });
    }
  }

  return { nodes, edges };
}