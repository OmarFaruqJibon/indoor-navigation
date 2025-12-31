import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Polygon,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { Edge, Node } from "../utils/dijkstra";

const { width, height } = Dimensions.get("window");

interface MapViewProps {
  nodes: Node[];
  edges: Edge[];
  path: string[];
  onNodePress?: (node: Node) => void;
  currentLocation?: Node | null;
}

export const MapView: React.FC<MapViewProps> = ({
  nodes,
  edges,
  path,
  onNodePress,
  currentLocation,
}) => {
  const [scale, setScale] = useState(0.3);
  const [translateX, setTranslateX] = useState(width / 2);
  const [translateY, setTranslateY] = useState(height / 2);
  const [lastScale, setLastScale] = useState(0.3);
  const [lastTranslateX, setLastTranslateX] = useState(width / 2);
  const [lastTranslateY, setLastTranslateY] = useState(height / 2);

  const pinchDistance = useRef(0);
  const pinchScale = useRef(0.3);
  const isPinching = useRef(false);

  const calculateBounds = () => {
    if (nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);

    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  };

  const bounds = calculateBounds();
  const mapWidth = bounds.maxX - bounds.minX + 300;
  const mapHeight = bounds.maxY - bounds.minY + 300;
  const mapCenterX = (bounds.minX + bounds.maxX) / 2;
  const mapCenterY = (bounds.minY + bounds.maxY) / 2;

  // Initialize map
  useEffect(() => {
    if (nodes.length > 0) {
      const scaleX = (width * 0.8) / mapWidth;
      const scaleY = (height * 0.8) / mapHeight;
      const initialScale = Math.min(scaleX, scaleY, 0.8);

      setScale(initialScale);
      setLastScale(initialScale);
      setTranslateX(width / 2 - mapCenterX * initialScale);
      setTranslateY(height / 2 - mapCenterY * initialScale);
      setLastTranslateX(width / 2 - mapCenterX * initialScale);
      setLastTranslateY(height / 2 - mapCenterY * initialScale);
    }
  }, [nodes]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setLastTranslateX(translateX);
        setLastTranslateY(translateY);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isPinching.current) {
          setTranslateX(lastTranslateX + gestureState.dx);
          setTranslateY(lastTranslateY + gestureState.dy);
        }
      },
      onPanResponderRelease: () => {
        const maxTranslateX = width * 0.5;
        const maxTranslateY = height * 0.5;
        const minTranslateX = -mapWidth * scale + width * 0.5;
        const minTranslateY = -mapHeight * scale + height * 0.5;

        setTranslateX(
          Math.max(minTranslateX, Math.min(maxTranslateX, translateX))
        );
        setTranslateY(
          Math.max(minTranslateY, Math.min(maxTranslateY, translateY))
        );
      },
    })
  ).current;

  // Handle pinch to zoom
  const handleTouchStart = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;
    if (touches.length === 2) {
      isPinching.current = true;
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      pinchDistance.current = Math.sqrt(dx * dx + dy * dy);
      pinchScale.current = scale;
    }
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;
    if (touches.length === 2) {
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (pinchDistance.current > 0) {
        const pinchRatio = distance / pinchDistance.current;
        const newScale = Math.max(
          0.1,
          Math.min(2, pinchScale.current * pinchRatio)
        );

        const centerX = (touches[0].pageX + touches[1].pageX) / 2;
        const centerY = (touches[0].pageY + touches[1].pageY) / 2;

        const scaleRatio = newScale / scale;
        const newTranslateX = centerX - (centerX - translateX) * scaleRatio;
        const newTranslateY = centerY - (centerY - translateY) * scaleRatio;

        setScale(newScale);
        setTranslateX(newTranslateX);
        setTranslateY(newTranslateY);
      }
    }
  };

  const handleTouchEnd = () => {
    isPinching.current = false;
    pinchDistance.current = 0;

    const clampedScale = Math.max(0.1, Math.min(2, scale));
    if (clampedScale !== scale) {
      setScale(clampedScale);
    }

    const maxTranslateX = width * 0.5;
    const maxTranslateY = height * 0.5;
    const minTranslateX = -mapWidth * clampedScale + width * 0.5;
    const minTranslateY = -mapHeight * clampedScale + height * 0.5;

    setTranslateX(Math.max(minTranslateX, Math.min(maxTranslateX, translateX)));
    setTranslateY(Math.max(minTranslateY, Math.min(maxTranslateY, translateY)));
  };

  // Zoom functions
  const zoomIn = () => {
    const newScale = Math.min(2, scale * 1.2);
    const centerX = width / 2;
    const centerY = height / 2;

    const scaleRatio = newScale / scale;
    const newTranslateX = centerX - (centerX - translateX) * scaleRatio;
    const newTranslateY = centerY - (centerY - translateY) * scaleRatio;

    setScale(newScale);
    setTranslateX(newTranslateX);
    setTranslateY(newTranslateY);
  };

  const zoomOut = () => {
    const newScale = Math.max(0.1, scale / 1.2);
    const centerX = width / 2;
    const centerY = height / 2;

    const scaleRatio = newScale / scale;
    const newTranslateX = centerX - (centerX - translateX) * scaleRatio;
    const newTranslateY = centerY - (centerY - translateY) * scaleRatio;

    setScale(newScale);
    setTranslateX(newTranslateX);
    setTranslateY(newTranslateY);
  };

  const resetView = () => {
    const scaleX = (width * 0.8) / mapWidth;
    const scaleY = (height * 0.8) / mapHeight;
    const newScale = Math.min(scaleX, scaleY, 0.8);

    setScale(newScale);
    setTranslateX(width / 2 - mapCenterX * newScale);
    setTranslateY(height / 2 - mapCenterY * newScale);
  };

  const getNodeColor = (type: string): string => {
    switch (type) {
      case "entrance":
        return "#2A9D8F";
      case "exit":
        return "#E63946";
      case "shop":
        return "#4A6FA5";
      case "café":
        return "#D4A762";
      case "restaurant":
        return "#E76F51";
      case "stair":
        return "#9D4EDD";
      case "junction":
        return "#6C757D";
      default:
        return "#495057";
    }
  };

  const getNodeIcon = (type: string): string => {
    switch (type) {
      case "entrance":
        return "🚪";
      case "exit":
        return "🚶‍♂️";
      case "shop":
        return "🛍️";
      case "café":
        return "☕";
      case "restaurant":
        return "🍽️";
      case "stair":
        return "🔼";
      case "junction":
        return "➕";
      default:
        return "📍";
    }
  };

  const isNodeInPath = (nodeId: string): boolean => {
    return path.includes(nodeId);
  };

  const getNodeSize = (type: string): number => {
    const baseSize = 16 * scale;
    switch (type) {
      case "entrance":
      case "exit":
        return Math.max(20, Math.min(30, baseSize * 1.5));
      case "shop":
      case "café":
      case "restaurant":
        return Math.max(18, Math.min(26, baseSize * 1.3));
      default:
        return Math.max(12, Math.min(20, baseSize));
    }
  };

  const isPathEdge = (from: string, to: string): boolean => {
    const fromIndex = path.indexOf(from);
    const toIndex = path.indexOf(to);
    return (
      fromIndex !== -1 && toIndex !== -1 && Math.abs(fromIndex - toIndex) === 1
    );
  };

  // mall floor structure
  const renderMallStructure = () => {
    const leftBound = bounds.minX;
    const rightBound = bounds.maxX;
    const verticalMid = (bounds.minY + bounds.maxY) / 2;

    const areas = [
      {
        x: leftBound,
        y: bounds.minY,
        width: rightBound - leftBound,
        height: verticalMid - bounds.minY,
        label: "Main Atrium",
        color: "#F0F7FF",
      },
      {
        x: leftBound,
        y: verticalMid,
        width: rightBound - leftBound,
        height: bounds.maxY - verticalMid,
        label: "Shopping Area",
        color: "#FFF5F0",
      },
    ];

    return (
      <G>
        {/* Mall areas */}
        {areas.map((area, index) => (
          <G key={`area-${index}`}>
            <Rect
              x={area.x}
              y={area.y}
              width={area.width}
              height={area.height}
              fill={area.color}
              stroke="#E2E8F0"
              strokeWidth="2"
              rx="10"
              ry="10"
            />
            <SvgText
              x={area.x + area.width / 2}
              y={area.y + 30}
              fill="#64748B"
              fontSize="14"
              fontWeight="500"
              textAnchor="middle"
            >
              {area.label}
            </SvgText>
          </G>
        ))}

        {/* Main corridors */}
        {/* <Line
          x1={bounds.minX + 50}
          y1={verticalMid}
          x2={bounds.maxX - 50}
          y2={verticalMid}
          stroke="#CBD5E1"
          strokeWidth="8"
          strokeLinecap="round"
        /> */}

        {/* Vertical main corridor */}
        {/* <Line
          x1={mapCenterX}
          y1={bounds.minY + 50}
          x2={mapCenterX}
          y2={bounds.maxY - 50}
          stroke="#CBD5E1"
          strokeWidth="6"
          strokeLinecap="round"
        /> */}
      </G>
    );
  };

  return (
    <View
      style={styles.container}
      {...panResponder.panHandlers}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#4A6FA5" stopOpacity="1" />
            <Stop offset="100%" stopColor="#2A9D8F" stopOpacity="1" />
          </LinearGradient>

          <LinearGradient
            id="currentLocationGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#2A9D8F" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#1A7D6F" stopOpacity="0.8" />
          </LinearGradient>

          <LinearGradient
            id="destinationGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#E63946" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#C61926" stopOpacity="0.8" />
          </LinearGradient>
        </Defs>

        <G
          transform={`translate(${translateX}, ${translateY}) scale(${scale})`}
        >
          {/* Mall structure background */}
          {renderMallStructure()}
          {edges
            .filter((edge) => edge.accessible)
            .map((edge, index) => {
              const fromNode = nodes.find((n) => n.node_id === edge.from);
              const toNode = nodes.find((n) => n.node_id === edge.to);

              if (!fromNode || !toNode) return null;

              const pathEdge = isPathEdge(edge.from, edge.to);

              return (
                <Line
                  key={`edge-${index}`}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={pathEdge ? "url(#pathGradient)" : "#E2E8F0"}
                  strokeWidth={pathEdge ? 6 : 4}
                  strokeLinecap="round"
                  strokeDasharray={edge.accessible ? "none" : "5,3"}
                />
              );
            })}

          {path.map((nodeId, index) => {
            if (index === path.length - 1) return null;

            const currentNode = nodes.find((n) => n.node_id === nodeId);
            const nextNode = nodes.find((n) => n.node_id === path[index + 1]);

            if (!currentNode || !nextNode) return null;

            return (
              <G key={`path-${index}`}>
                <Line
                  x1={currentNode.x}
                  y1={currentNode.y}
                  x2={nextNode.x}
                  y2={nextNode.y}
                  stroke="url(#pathGradient)"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeOpacity="0.9"
                />

                {/* Walking direction indicator */}
                {index < path.length - 2 && (
                  <Polygon
                    points={`
                      ${nextNode.x - 5},${nextNode.y - 10}
                      ${nextNode.x + 5},${nextNode.y}
                      ${nextNode.x - 5},${nextNode.y + 10}
                    `}
                    fill="#4A6FA5"
                    transform={`rotate(${
                      Math.atan2(
                        nextNode.y - currentNode.y,
                        nextNode.x - currentNode.x
                      ) *
                      (180 / Math.PI)
                    }, ${nextNode.x}, ${nextNode.y})`}
                  />
                )}
              </G>
            );
          })}

          {/* Draw nodes*/}
          {nodes.map((node) => {
            const isCurrent = currentLocation?.node_id === node.node_id;
            const isDestination =
              path.length > 0 && node.node_id === path[path.length - 1];
            const isInPath = isNodeInPath(node.node_id);
            const size = getNodeSize(node.type);

            return (
              <G
                key={node.node_id}
                onPress={() => onNodePress && onNodePress(node)}
              >
                {(isCurrent || isDestination) && (
                  <Circle
                    cx={node.x}
                    cy={node.y}
                    r={size + 8}
                    fill={isCurrent ? "#2A9D8F20" : "#E6394620"}
                  />
                )}

                {/* Node background */}
                <Circle
                  cx={node.x}
                  cy={node.y}
                  r={size}
                  fill={
                    isCurrent
                      ? "url(#currentLocationGradient)"
                      : isDestination
                      ? "url(#destinationGradient)"
                      : getNodeColor(node.type)
                  }
                  stroke="#FFFFFF"
                  strokeWidth="3"
                />

                {/* Node icon*/}
                <SvgText
                  x={node.x}
                  y={node.y + size * 0.4}
                  fill="#FFFFFF"
                  fontSize={size - 4}
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {getNodeIcon(node.type)}
                </SvgText>

                {/* Node label */}
                {scale > 0.2 && (
                  <>
                    <SvgText
                      x={node.x}
                      y={node.y - size - 8}
                      fill="#1A1A1A"
                      fontSize={Math.max(10, 12 * scale)}
                      fontWeight="600"
                      textAnchor="middle"
                      stroke="#FFFFFF"
                      strokeWidth={2 * scale}
                      strokeOpacity="0.8"
                    >
                      {node.label}
                    </SvgText>

                    {/* Type label */}
                    {scale > 0.3 && (
                      <SvgText
                        x={node.x}
                        y={node.y - size - 20}
                        fill="#64748B"
                        fontSize={Math.max(8, 10 * scale)}
                        fontWeight="500"
                        textAnchor="middle"
                      >
                        {node.type.toUpperCase()}
                      </SvgText>
                    )}
                  </>
                )}
              </G>
            );
          })}
        </G>
      </Svg>

      {/* Map controls */}
      <View style={styles.mapControls}>
        <View>
          {/* <TouchableOpacity style={styles.zoomButton} onPress={zoomIn}>
            <Ionicons name="add" size={24} color="#4A6FA5" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomButton} onPress={zoomOut}>
            <Ionicons name="remove" size={24} color="#4A6FA5" />
          </TouchableOpacity>
          <View style={styles.zoomDivider} /> */}
          <TouchableOpacity style={styles.zoomButton} onPress={resetView}>
            <Ionicons name="expand" size={20} color="#4A6FA5" />
          </TouchableOpacity>
        </View>

        {/* Scale indicator */}
        {/* <View style={styles.scaleIndicator}>
          <Text style={styles.scaleText}>{Math.round(scale * 100)}%</Text>
        </View> */}

        {/* Instructions */}
        {/* <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Pinch to zoom • Drag to pan
          </Text>
        </View> */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    position: "relative",
    overflow: "hidden",
  },
  mapControls: {
    position: "absolute",
    right: 16,
    bottom: 16,
    alignItems: "flex-end",
  },
  zoomControls: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 4,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    marginBottom: 12,
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 2,
  },
  zoomDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 8,
  },
  scaleIndicator: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    // backgroundColor: "#F8F9FA",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scaleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A6FA5",
  },
  instructions: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  instructionText: {
    fontSize: 8,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});
