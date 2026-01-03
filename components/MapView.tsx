// components/MapView.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
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
  Text as SvgText
} from "react-native-svg";
import { Edge, Node } from "../utils/dijkstra";

const { width, height } = Dimensions.get("window");

interface MapViewProps {
  nodes: Node[];
  edges: Edge[];
  path: string[];
  onNodePress?: (node: Node) => void;
  destination?: Node;
  currentLocation?: Node | null;
}

export const MapView: React.FC<MapViewProps> = ({
  nodes,
  edges,
  path,
  onNodePress,
  destination,
  currentLocation,
}) => {
  // States
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [lastScale, setLastScale] = useState(1);
  const [lastTranslateX, setLastTranslateX] = useState(0);
  const [lastTranslateY, setLastTranslateY] = useState(0);
  const [activeFloor, setActiveFloor] = useState<number>(1);
  const [showFloorSelector, setShowFloorSelector] = useState(false);

  const touchStartRef = useRef({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const isPinchingRef = useRef(false);
  const initialDistanceRef = useRef(0);
  const initialScaleRef = useRef(1);
  const initialTranslateRef = useRef({ x: 0, y: 0 });

  // Extract unique floors from nodes
  const availableFloors = useMemo(() => 
    Array.from(new Set(nodes.map(n => n.floor || 1))).sort((a, b) => a - b),
    [nodes]
  );

  // Filter nodes for active floor
  const floorNodes = useMemo(() => 
    nodes.filter(n => (n.floor || 1) === activeFloor), 
    [nodes, activeFloor]
  );

  // Filter edges where BOTH nodes are on active floor OR it's an inter-floor connection
  const floorEdges = useMemo(() => {
    return edges.filter(edge => {
      const fromNode = nodes.find(n => n.node_id === edge.from);
      const toNode = nodes.find(n => n.node_id === edge.to);
      
      if (!fromNode || !toNode) return false;
      
      // Check if both nodes are on active floor
      const bothOnActiveFloor = (fromNode.floor || 1) === activeFloor && 
                               (toNode.floor || 1) === activeFloor;
      
      // Check if it's an inter-floor connection (staircase)
      const isStairConnection = (fromNode.type === 'stair' || toNode.type === 'stair') &&
                               Math.abs((fromNode.floor || 1) - (toNode.floor || 1)) === 1;
      
      // Show if both on same floor OR it's a staircase connection to active floor
      if (bothOnActiveFloor) {
        return true;
      }
      
      // For inter-floor connections, show if at least one node is on active floor
      if (isStairConnection) {
        const fromFloor = fromNode.floor || 1;
        const toFloor = toNode.floor || 1;
        return fromFloor === activeFloor || toFloor === activeFloor;
      }
      
      return false;
    });
  }, [edges, nodes, activeFloor]);

  // Filter path segments that are visible on current floor
  const visiblePathSegments = useMemo(() => {
    const segments = [];
    
    for (let i = 0; i < path.length - 1; i++) {
      const fromNode = nodes.find(n => n.node_id === path[i]);
      const toNode = nodes.find(n => n.node_id === path[i + 1]);
      
      if (!fromNode || !toNode) continue;
      
      const fromFloor = fromNode.floor || 1;
      const toFloor = toNode.floor || 1;
      
      // Show segment if:
      // 1. Both nodes are on current floor, OR
      // 2. It's a staircase connection involving current floor
      if (fromFloor === activeFloor && toFloor === activeFloor) {
        // Same floor segment
        segments.push({
          from: fromNode,
          to: toNode,
          fromFloor,
          toFloor,
          isInterFloor: false,
          isStaircase: false
        });
      } else if ((fromFloor === activeFloor || toFloor === activeFloor) && 
                 (fromNode.type === 'stair' || toNode.type === 'stair')) {
        // Staircase connection involving current floor
        segments.push({
          from: fromNode,
          to: toNode,
          fromFloor,
          toFloor,
          isInterFloor: true,
          isStaircase: true
        });
      }
    }
    
    return segments;
  }, [path, nodes, activeFloor]);

  // Calculate map bounds based on active floor nodes
  const { bounds, mapWidth, mapHeight, mapCenterX, mapCenterY } = useMemo(() => {
    if (floorNodes.length === 0) {
      return {
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
        mapWidth: 0,
        mapHeight: 0,
        mapCenterX: 0,
        mapCenterY: 0
      };
    }

    const xs = floorNodes.map(n => n.x);
    const ys = floorNodes.map(n => n.y);

    const bounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
    
    const mapWidth = bounds.maxX - bounds.minX;
    const mapHeight = bounds.maxY - bounds.minY;
    const mapCenterX = (bounds.minX + bounds.maxX) / 2;
    const mapCenterY = (bounds.minY + bounds.maxY) / 2;
    
    return { bounds, mapWidth, mapHeight, mapCenterX, mapCenterY };
  }, [floorNodes]);

  // Initialize map for current floor
  useEffect(() => {
    if (floorNodes.length > 0 && mapWidth > 0 && mapHeight > 0) {
      const padding = 50;
      const scaleX = (width - padding * 2) / mapWidth;
      const scaleY = (height - padding * 2) / mapHeight;
      const initialScale = Math.min(scaleX, scaleY, 1);

      const initialTranslateX = width / 2 - mapCenterX * initialScale;
      const initialTranslateY = height / 2 - mapCenterY * initialScale;

      setScale(initialScale);
      setTranslateX(initialTranslateX);
      setTranslateY(initialTranslateY);
      setLastScale(initialScale);
      setLastTranslateX(initialTranslateX);
      setLastTranslateY(initialTranslateY);
      initialScaleRef.current = initialScale;
      initialTranslateRef.current = { x: initialTranslateX, y: initialTranslateY };
    }
  }, [floorNodes, mapWidth, mapHeight, mapCenterX, mapCenterY]);

  // Calculate distance between two points
  const calculateDistance = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Calculate midpoint
  const calculateMidpoint = (x1: number, y1: number, x2: number, y2: number) => {
    return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  };

  // Handle touch start
  const handleTouchStart = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;

    if (touches.length === 1) {
      isPinchingRef.current = false;
      setLastTranslateX(translateX);
      setLastTranslateY(translateY);
    } else if (touches.length === 2) {
      isPinchingRef.current = true;
      const touch1 = touches[0];
      const touch2 = touches[1];

      touchStartRef.current = {
        x1: touch1.pageX,
        y1: touch1.pageY,
        x2: touch2.pageX,
        y2: touch2.pageY,
      };

      initialDistanceRef.current = calculateDistance(
        touch1.pageX,
        touch1.pageY,
        touch2.pageX,
        touch2.pageY
      );
      initialScaleRef.current = scale;
      initialTranslateRef.current = { x: translateX, y: translateY };
    }
  };

  // Handle touch move
  const handleTouchMove = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;

    if (touches.length === 2 && isPinchingRef.current) {
      const touch1 = touches[0];
      const touch2 = touches[1];

      const currentDistance = calculateDistance(
        touch1.pageX,
        touch1.pageY,
        touch2.pageX,
        touch2.pageY
      );

      if (initialDistanceRef.current > 0) {
        const scaleFactor = currentDistance / initialDistanceRef.current;
        const newScale = Math.max(0.1, Math.min(3, initialScaleRef.current * scaleFactor));

        const midpoint = calculateMidpoint(
          touch1.pageX,
          touch1.pageY,
          touch2.pageX,
          touch2.pageY
        );

        const scaleRatio = newScale / initialScaleRef.current;
        const newTranslateX = midpoint.x - (midpoint.x - initialTranslateRef.current.x) * scaleRatio;
        const newTranslateY = midpoint.y - (midpoint.y - initialTranslateRef.current.y) * scaleRatio;

        setScale(newScale);
        setTranslateX(newTranslateX);
        setTranslateY(newTranslateY);
      }
    }
  };

  // Handle touch end
  const handleTouchEnd = () => {
    isPinchingRef.current = false;
    initialDistanceRef.current = 0;

    // Clamp scale
    const clampedScale = Math.max(0.1, Math.min(3, scale));
    if (clampedScale !== scale) {
      setScale(clampedScale);
    }

    const maxTranslateX = width * 0.8;
    const maxTranslateY = height * 0.8;
    const minTranslateX = -mapWidth * clampedScale + width * 0.2;
    const minTranslateY = -mapHeight * clampedScale + height * 0.2;

    setTranslateX(Math.max(minTranslateX, Math.min(maxTranslateX, translateX)));
    setTranslateY(Math.max(minTranslateY, Math.min(maxTranslateY, translateY)));
  };

  // Pan responder for single finger drag
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.numberActiveTouches === 1 && !isPinchingRef.current;
      },
      onPanResponderGrant: () => {
        if (!isPinchingRef.current) {
          setLastTranslateX(translateX);
          setLastTranslateY(translateY);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isPinchingRef.current && gestureState.numberActiveTouches === 1) {
          setTranslateX(lastTranslateX + gestureState.dx);
          setTranslateY(lastTranslateY + gestureState.dy);
        }
      },
      onPanResponderRelease: () => {
        const maxTranslateX = width * 0.8;
        const maxTranslateY = height * 0.8;
        const minTranslateX = -mapWidth * scale + width * 0.2;
        const minTranslateY = -mapHeight * scale + height * 0.2;

        setTranslateX(Math.max(minTranslateX, Math.min(maxTranslateX, translateX)));
        setTranslateY(Math.max(minTranslateY, Math.min(maxTranslateY, translateY)));
      },
    })
  ).current;

  // Zoom functions
  const zoomIn = () => {
    const newScale = Math.min(3, scale * 1.2);
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
    if (mapWidth === 0 || mapHeight === 0) return;

    const padding = 50;
    const scaleX = (width - padding * 2) / mapWidth;
    const scaleY = (height - padding * 2) / mapHeight;
    const newScale = Math.min(scaleX, scaleY, 1);

    const newTranslateX = width / 2 - mapCenterX * newScale;
    const newTranslateY = height / 2 - mapCenterY * newScale;

    setScale(newScale);
    setTranslateX(newTranslateX);
    setTranslateY(newTranslateY);
    setLastScale(newScale);
    setLastTranslateX(newTranslateX);
    setLastTranslateY(newTranslateY);
    initialScaleRef.current = newScale;
    initialTranslateRef.current = { x: newTranslateX, y: newTranslateY };
  };

  const handleFloorChange = (floor: number) => {
    setActiveFloor(floor);
    setShowFloorSelector(false);
    setTimeout(resetView, 100);
  };

  const getNodeColor = (type: string): string => {
    switch (type) {
      case "entrance": return "#2A9D8F";
      case "exit": return "#E63946";
      case "shop": return "#4A6FA5";
      case "café": return "#D4A762";
      case "restaurant": return "#E76F51";
      case "stair": return "#9D4EDD";
      case "junction": return "#6C757D";
      default: return "#495057";
    }
  };

  const getNodeIcon = (type: string): string => {
    switch (type) {
      case "entrance": return "🚪";
      case "exit": return "🚶‍♂️";
      case "shop": return "🛍️";
      case "café": return "☕";
      case "restaurant": return "🍽️";
      case "stair": return "🔼";
      case "junction": return "➕";
      default: return "📍";
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
    return fromIndex !== -1 && toIndex !== -1 && Math.abs(fromIndex - toIndex) === 1;
  };

  const renderMallStructure = () => {
    const leftBound = bounds.minX;
    const rightBound = bounds.maxX;
    const verticalMid = (bounds.minY + bounds.maxY) / 2;

    // Different colors for different floors
    const floorColors = [
      "#F0F7FF", // Floor 1
      "#F5F0FF", // Floor 2
      "#FFF0F5", // Floor 3
      "#F0FFF5", // Floor 4
      "#FFF5F0", // Floor 5
      "#F0F0FF", // Floor 6
      "#FFFFF0", // Floor 7
      "#F5FFF0", // Floor 8
      "#F0FFFF", // Floor 9
      "#FFF0F0", // Floor 10
    ];
    
    const floorColor = floorColors[(activeFloor - 1) % floorColors.length];

    return (
      <G>
        {/* Floor background */}
        <Rect
          x={bounds.minX - 100}
          y={bounds.minY - 100}
          width={mapWidth + 200}
          height={mapHeight + 200}
          fill={floorColor}
          rx="20"
          ry="20"
          opacity="0.8"
        />

        {/* Floor label */}
        <SvgText
          x={bounds.minX + mapWidth / 2}
          y={bounds.minY - 50}
          fill="#4A5568"
          fontSize="16"
          fontWeight="bold"
          textAnchor="middle"
        >
          Floor {activeFloor}
        </SvgText>

        {/* Main areas */}
        <G>
          <Rect
            x={leftBound}
            y={bounds.minY}
            width={rightBound - leftBound}
            height={verticalMid - bounds.minY}
            fill="#F0F7FF"
            stroke="#CBD5E0"
            strokeWidth="1"
            rx="10"
            ry="10"
            opacity="0.6"
          />
          <SvgText
            x={leftBound + (rightBound - leftBound) / 2}
            y={bounds.minY + 30}
            fill="#4A5568"
            fontSize="12"
            fontWeight="500"
            textAnchor="middle"
          >
            Main Atrium
          </SvgText>
        </G>

        <G>
          <Rect
            x={leftBound}
            y={verticalMid}
            width={rightBound - leftBound}
            height={bounds.maxY - verticalMid}
            fill="#FFF5F0"
            stroke="#CBD5E0"
            strokeWidth="1"
            rx="10"
            ry="10"
            opacity="0.6"
          />
          <SvgText
            x={leftBound + (rightBound - leftBound) / 2}
            y={verticalMid + 30}
            fill="#4A5568"
            fontSize="12"
            fontWeight="500"
            textAnchor="middle"
          >
            Shopping Area
          </SvgText>
        </G>
      </G>
    );
  };

  // Render inter-floor path indicators (for staircases)
  const renderInterFloorPaths = () => {
    return visiblePathSegments
      .filter(segment => segment.isInterFloor && segment.isStaircase)
      .map((segment, index) => {
        const { from, to } = segment;
        
        if (!from || !to) return null;

        // Only draw if at least one node is on current floor
        const fromFloor = from.floor || 1;
        const toFloor = to.floor || 1;
        
        if (fromFloor !== activeFloor && toFloor !== activeFloor) return null;

        // Draw dashed line for inter-floor connections
        return (
          <G key={`inter-floor-${index}`}>
            <Line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#9D4EDD"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray="8,4"
              opacity="0.7"
            />
          </G>
        );
      });
  };

  return (
    <View style={styles.container}>
      {/* Floor Selector Button */}
      {availableFloors.length > 1 && (
        <TouchableOpacity
          style={styles.floorSelectorButton}
          onPress={() => setShowFloorSelector(!showFloorSelector)}
        >
          <Ionicons name="layers-outline" size={20} color="#4A6FA5" />
          <Text style={styles.floorSelectorButtonText}>
            Floor {activeFloor}
          </Text>
          <Ionicons 
            name={showFloorSelector ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#4A6FA5" 
          />
        </TouchableOpacity>
      )}

      {/* Floor Selector Dropdown */}
      {showFloorSelector && availableFloors.length > 1 && (
        <View style={styles.floorSelectorDropdown}>
          {availableFloors.map(floor => (
            <TouchableOpacity
              key={floor}
              style={[
                styles.floorOption,
                floor === activeFloor && styles.floorOptionActive
              ]}
              onPress={() => handleFloorChange(floor)}
            >
              <Text style={[
                styles.floorOptionText,
                floor === activeFloor && styles.floorOptionTextActive
              ]}>
                Floor {floor}
              </Text>
              {floor === activeFloor && (
                <Ionicons name="checkmark" size={16} color="#4A6FA5" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Touch handling container */}
      <View
        style={styles.touchContainer}
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

            <LinearGradient
              id="interFloorGradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <Stop offset="0%" stopColor="#9D4EDD" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#7B2CBF" stopOpacity="0.8" />
            </LinearGradient>
          </Defs>

          <G transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
            {renderMallStructure()}

            {/* Draw edges for current floor */}
            {floorEdges.map((edge, index) => {
              const fromNode = nodes.find(n => n.node_id === edge.from);
              const toNode = nodes.find(n => n.node_id === edge.to);
              
              if (!fromNode || !toNode) return null;

              const fromFloor = fromNode.floor || 1;
              const toFloor = toNode.floor || 1;
              const isStairConnection = fromNode.type === 'stair' || toNode.type === 'stair';
              const isInterFloor = fromFloor !== toFloor;
              
              const pathEdge = isPathEdge(edge.from, edge.to);

              return (
                <Line
                  key={`edge-${index}`}
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={
                    pathEdge 
                      ? "url(#pathGradient)" 
                      : isInterFloor && isStairConnection
                        ? "#9D4EDD"
                        : "#CBD5E0"
                  }
                  strokeWidth={
                    pathEdge 
                      ? 6 
                      : isInterFloor && isStairConnection
                        ? 4
                        : 2
                  }
                  strokeLinecap="round"
                  strokeDasharray={isInterFloor && isStairConnection ? "8,4" : "0"}
                  opacity={pathEdge ? 0.9 : isInterFloor ? 0.7 : 0.6}
                />
              );
            })}

            {/* Draw path segments */}
            {visiblePathSegments.map((segment, index) => {
              const { from, to, isInterFloor, isStaircase } = segment;
              
              if (!from || !to) return null;

              return (
                <G key={`path-${index}`}>
                  <Line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={isStaircase ? "url(#interFloorGradient)" : "url(#pathGradient)"}
                    strokeWidth={isStaircase ? 5 : 8}
                    strokeLinecap="round"
                    strokeOpacity="0.9"
                    strokeDasharray={isStaircase ? "8,4" : "0"}
                  />

                  {/* Walking direction indicator (only for same-floor paths) */}
                  {!isInterFloor && index < visiblePathSegments.length - 1 && (
                    <Polygon
                      points={`
                        ${to.x - 5},${to.y - 10}
                        ${to.x + 5},${to.y}
                        ${to.x - 5},${to.y + 10}
                      `}
                      fill="#4A6FA5"
                      transform={`rotate(${
                        Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI)
                      }, ${to.x}, ${to.y})`}
                    />
                  )}

                  {/* Staircase direction indicator */}
                  {isStaircase && (
                    <G>
                      <Circle
                        cx={from.x}
                        cy={from.y}
                        r={8}
                        fill="#9D4EDD"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                      <SvgText
                        x={from.x}
                        y={from.y + 4}
                        fill="#FFFFFF"
                        fontSize="10"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        {(from.floor || 1) < (to.floor || 1) ? "↑" : "↓"}
                      </SvgText>
                    </G>
                  )}
                </G>
              );
            })}

            {/* Draw nodes for current floor */}
            {floorNodes.map((node) => {
              const isCurrent = currentLocation?.node_id === node.node_id;
              const isDestination = path.length > 0 && node.node_id === path[path.length - 1];
              const isInPath = isNodeInPath(node.node_id);
              const size = getNodeSize(node.type);
              const isStairNode = node.type === 'stair';

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
                    strokeWidth={isStairNode ? "4" : "3"}
                  />

                  {/* Special highlight for stairs on the path */}
                  {isInPath && isStairNode && (
                    <Circle
                      cx={node.x}
                      cy={node.y}
                      r={size + 4}
                      stroke="#9D4EDD"
                      strokeWidth="2"
                      fill="none"
                    />
                  )}

                  {/* Node icon */}
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

                  {/* Node labels (only show at certain zoom levels) */}
                  {scale > 0.3 && !isStairNode && (
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
                      {node.label.replace(` Floor ${activeFloor}`, '')}
                    </SvgText>
                  )}

                  {/* Show floor number for stair nodes */}
                  {isStairNode && scale > 0.5 && (
                    <SvgText
                      x={node.x}
                      y={node.y - size - 22}
                      fill="#9D4EDD"
                      fontSize={Math.max(10, 12 * scale)}
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      F{node.floor || 1}
                    </SvgText>
                  )}
                </G>
              );
            })}
          </G>
        </Svg>
      </View>

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <View style={styles.controlGroup}>
          <TouchableOpacity style={styles.controlButton} onPress={zoomIn}>
            <Ionicons name="add" size={22} color="#4A6FA5" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={zoomOut}>
            <Ionicons name="remove" size={22} color="#4A6FA5" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={resetView}>
            <Ionicons name="expand" size={20} color="#4A6FA5" />
          </TouchableOpacity>
        </View>

        {/* Scale indicator */}
        <View style={styles.scaleIndicator}>
          <Text style={styles.scaleText}>{Math.round(scale * 100)}%</Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Pinch to zoom • Drag to pan
          </Text>
        </View>
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
  touchContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  floorSelectorButton: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 100,
  },
  floorSelectorButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A6FA5",
  },
  floorSelectorDropdown: {
    position: "absolute",
    top: 60,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderRadius: 12,
    padding: 8,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    zIndex: 101,
    minWidth: 120,
  },
  floorOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 2,
  },
  floorOptionActive: {
    backgroundColor: "rgba(74, 111, 165, 0.1)",
  },
  floorOptionText: {
    fontSize: 14,
    color: "#4A5568",
    fontWeight: "500",
  },
  floorOptionTextActive: {
    color: "#4A6FA5",
    fontWeight: "600",
  },
  mapControls: {
    position: "absolute",
    right: 16,
    bottom: 16,
    alignItems: "flex-end",
    gap: 12,
    zIndex: 99,
  },
  controlGroup: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    padding: 4,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    gap: 1,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(248, 249, 250, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  scaleIndicator: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scaleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A6FA5",
  },
  instructions: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  instructionText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "500",
  },
});