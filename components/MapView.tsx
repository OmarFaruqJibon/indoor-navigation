import React, { useEffect, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { Edge, Node } from "../utils/dijkstra";

const { width, height } = Dimensions.get("window");

interface MapViewProps {
  nodes: Node[];
  edges: Edge[];
  path: string[];
  scale?: number;
  onNodePress?: (node: Node) => void;
  currentLocation?: { x: number; y: number } | null;
}

export const MapView: React.FC<MapViewProps> = ({
  nodes,
  edges,
  path,
  scale = 0.3,
  onNodePress,
  currentLocation,
}) => {
  const [mapDimensions, setMapDimensions] = useState({
    width: 1000,
    height: 1500,
  });

  // Calculate viewBox based on node positions
  useEffect(() => {
    if (nodes.length > 0) {
      const xs = nodes.map((n) => n.x);
      const ys = nodes.map((n) => n.y);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const padding = 100;

      setMapDimensions({
        width: maxX + padding,
        height: maxY + padding,
      });
    }
  }, [nodes]);

  const getNodeColor = (type: string): string => {
    switch (type) {
      case "entrance":
        return "#4CAF50";
      case "exit":
        return "#F44336";
      case "shop":
        return "#2196F3";
      case "café":
        return "#FF9800";
      case "restaurant":
        return "#E91E63";
      case "stair":
        return "#9C27B0";
      case "junction":
        return "#607D8B";
      default:
        return "#757575";
    }
  };

  const isNodeInPath = (nodeId: string): boolean => {
    return path.includes(nodeId);
  };

  return (
    <View style={styles.container}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${mapDimensions.width} ${mapDimensions.height}`}
      >
        {/* Draw edges first */}
        {edges
          .filter((edge) => edge.accessible)
          .map((edge, index) => {
            const fromNode = nodes.find((n) => n.node_id === edge.from);
            const toNode = nodes.find((n) => n.node_id === edge.to);

            if (!fromNode || !toNode) return null;

            const isPathEdge =
              path.includes(edge.from) && path.includes(edge.to);

            return (
              <Line
                key={`edge-${index}`}
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke={isPathEdge ? "#FF5722" : "#BDBDBD"}
                strokeWidth={isPathEdge ? 3 : 2}
                strokeDasharray={edge.accessible ? "none" : "5,5"}
              />
            );
          })}

        {/* Draw nodes */}
        {nodes.map((node) => {
          const isInPath = isNodeInPath(node.node_id);

          return (
            <React.Fragment key={node.node_id}>
              <Circle
                cx={node.x}
                cy={node.y}
                r={isInPath ? 12 : 8}
                fill={getNodeColor(node.type)}
                stroke="#FFFFFF"
                strokeWidth={2}
                onPress={() => onNodePress && onNodePress(node)}
              />
              <SvgText
                x={node.x}
                y={node.y - 20}
                fill="#000"
                fontSize="12"
                textAnchor="middle"
                fontWeight="bold"
              >
                {node.label}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Draw current location */}
        {currentLocation && (
          <Circle
            cx={currentLocation.x}
            cy={currentLocation.y}
            r={10}
            fill="#FFEB3B"
            stroke="#F57C00"
            strokeWidth={3}
          />
        )}

        {/* Draw path */}
        {path.map((nodeId, index) => {
          if (index === path.length - 1) return null;

          const currentNode = nodes.find((n) => n.node_id === nodeId);
          const nextNode = nodes.find((n) => n.node_id === path[index + 1]);

          if (!currentNode || !nextNode) return null;

          return (
            <Line
              key={`path-${index}`}
              x1={currentNode.x}
              y1={currentNode.y}
              x2={nextNode.x}
              y2={nextNode.y}
              stroke="#FF5722"
              strokeWidth={4}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
});
