// app/index.tsx
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapView } from "../components/MapView";
import { QRScanner } from "../components/QRScanner";
import { generateMultiFloorData } from "../utils/dataGenerator";
import { Edge, Graph, Node } from "../utils/dijkstra";

const { width, height } = Dimensions.get("window");
const IS_SMALL_DEVICE = width < 375;
const IS_LARGE_DEVICE = width > 414;

const PANEL_STATES = {
  COLLAPSED: 0,   
  PARTIAL: 1,   
  EXPANDED: 2,
};

const PANEL_HEIGHTS = {
  COLLAPSED: 60,
  PARTIAL: height * 0.4,
  EXPANDED: height * 0.85,
};

// Helper 
const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    shop: "Stores",
    café: "Coffee & Café",
    restaurant: "Restaurants",
    entrance: "Entrances",
    exit: "Exits",
    stair: "Stairs",
    elevator: "Elevators",
    junction: "Junctions",
    restroom: "Restrooms",
    info: "Information",
    escalator: "Escalators",
  };
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
};

const getTypeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    shop: "storefront",
    café: "local-cafe",
    restaurant: "restaurant",
    entrance: "door-back",
    exit: "exit-to-app",
    stair: "stairs",
    elevator: "elevator",
    escalator: "escalator",
    junction: "adjust",
    restroom: "wc",
    info: "info",
  };
  return icons[type] || "place";
};

const getTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    shop: "#4A6FA5",
    café: "#D4A762",
    restaurant: "#E76F51",
    entrance: "#2A9D8F",
    exit: "#E63946",
    stair: "#9D4EDD",
    elevator: "#F4A261",
    escalator: "#FF6B6B",
    junction: "#6C757D",
    restroom: "#2A9D8F",
    info: "#457B9D",
  };
  return colors[type] || "#495057";
};

export default function Index() {
  // States
  const [graph, setGraph] = useState<Graph | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [distance, setDistance] = useState<number>(0);
  const [showScanner, setShowScanner] = useState(false);
  const [showDestinations, setShowDestinations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentFloor, setCurrentFloor] = useState<number | null>(null);
  const [targetFloor, setTargetFloor] = useState<number | null>(null);
  const [floorChangeMessage, setFloorChangeMessage] = useState<string>("");
  const [panelState, setPanelState] = useState<number>(PANEL_STATES.COLLAPSED);
  const [isPanelVisible, setIsPanelVisible] = useState(false);

  // Animations
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const searchBarAnim = useRef(new Animated.Value(0)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(height)).current;

  const panelY = useRef(height);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const lastPanelY = useRef(height);
  const panelVelocity = useRef(0);
  const lastDragTime = useRef(0);

  // Initialize app
  useEffect(() => {
    const initApp = async () => {
      try {
        const { nodes: generatedNodes, edges: generatedEdges } = generateMultiFloorData();
        setNodes(generatedNodes);
        setEdges(generatedEdges);
        setGraph(new Graph(generatedNodes, generatedEdges));

        Animated.timing(fadeInAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();

        setTimeout(() => setLoading(false), 1000);
      } catch (error) {
        console.error("Initialization error:", error);
        setLoading(false);
      }
    };

    initApp();
  }, []);

  useEffect(() => {
    if (graph && currentLocation && destination) {
      const result = graph.getShortestPath(currentLocation, destination);
      if (result) {
        setPath(result.path);
        setDistance(result.distance);
        setEstimatedTime(Math.max(1, Math.ceil(result.distance / 40)));

        if (result.floorChange) {
          setTargetFloor(result.targetFloor || null);
          setFloorChangeMessage(result.message || "");
        } else {
          setTargetFloor(null);
          setFloorChangeMessage("");
        }

        if (!isPanelVisible) {
          setIsPanelVisible(true);
          setPanelState(PANEL_STATES.PARTIAL);
          animatePanelToState(PANEL_STATES.PARTIAL);
        }
      }
    }
  }, [graph, currentLocation, destination, isPanelVisible]);

  // Memoized values
  const currentNode = useMemo(() =>
    currentLocation ? graph?.getNode(currentLocation) : undefined,
    [currentLocation, graph]
  );

  const destinationNode = useMemo(() =>
    destination ? graph?.getNode(destination) : undefined,
    [destination, graph]
  );

  const nodesForCurrentMap = useMemo(() =>
    currentFloor ? nodes.filter(node => node.floor === currentFloor) : nodes,
    [currentFloor, nodes]
  );

  const destinationNodes = useMemo(() => {
    if (!currentLocation || !currentFloor) return [];
    return nodes.filter(node =>
      node.node_id !== currentLocation &&
      node.type !== 'junction' &&
      node.type !== 'stair'
    );
  }, [currentLocation, currentFloor, nodes]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return destinationNodes;

    const query = searchQuery.toLowerCase().trim();
    return destinationNodes.filter(node =>
      node.label.toLowerCase().includes(query) ||
      node.type.toLowerCase().includes(query) ||
      node.node_id.toLowerCase().includes(query)
    );
  }, [destinationNodes, searchQuery]);

  const floors = useMemo(() =>
    graph ? graph.getFloors() : [],
    [graph]
  );

  // Panel helper 
  const getPanelTranslateYForState = useCallback((state: number) => {
    switch (state) {
      case PANEL_STATES.COLLAPSED:
        return height - PANEL_HEIGHTS.COLLAPSED;
      case PANEL_STATES.PARTIAL:
        return height - PANEL_HEIGHTS.PARTIAL;
      case PANEL_STATES.EXPANDED:
        return height - PANEL_HEIGHTS.EXPANDED;
      default:
        return height - PANEL_HEIGHTS.COLLAPSED;
    }
  }, [height]);

  const animatePanelToState = useCallback((state: number) => {
    const targetY = getPanelTranslateYForState(state);
    panelY.current = targetY;

    Animated.spring(panelTranslateY, {
      toValue: targetY,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [getPanelTranslateYForState]);

  // Panel drag handlers
  const panelPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: (_, gestureState) => {
        isDragging.current = true;
        dragStartY.current = gestureState.y0;
        lastPanelY.current = panelY.current;
        lastDragTime.current = Date.now();
        panelTranslateY.setValue(panelY.current);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isDragging.current) return;

        const deltaY = gestureState.moveY - dragStartY.current;
        const newY = Math.max(
          height - PANEL_HEIGHTS.EXPANDED,
          Math.min(height - PANEL_HEIGHTS.COLLAPSED, lastPanelY.current + deltaY)
        );

        panelTranslateY.setValue(newY);
        panelY.current = newY;

        const currentTime = Date.now();
        const timeDelta = currentTime - lastDragTime.current;
        if (timeDelta > 0) {
          panelVelocity.current = deltaY / timeDelta;
        }
        lastDragTime.current = currentTime;
      },
      onPanResponderRelease: () => {
        isDragging.current = false;

        const velocityThreshold = 0.3;
        const snapThreshold = PANEL_HEIGHTS.PARTIAL / 3;
        const currentHeight = height - panelY.current;

        let targetState = panelState;

        if (Math.abs(panelVelocity.current) > velocityThreshold) {
          if (panelVelocity.current > 0) {
            if (panelState === PANEL_STATES.COLLAPSED) {
              targetState = PANEL_STATES.PARTIAL;
            } else if (panelState === PANEL_STATES.PARTIAL) {
              targetState = PANEL_STATES.EXPANDED;
            }
          } else {
            if (panelState === PANEL_STATES.EXPANDED) {
              targetState = PANEL_STATES.PARTIAL;
            } else if (panelState === PANEL_STATES.PARTIAL) {
              targetState = PANEL_STATES.COLLAPSED;
            }
          }
        } else {
          if (currentHeight > PANEL_HEIGHTS.PARTIAL + snapThreshold) {
            targetState = PANEL_STATES.EXPANDED;
          } else if (currentHeight > PANEL_HEIGHTS.COLLAPSED + snapThreshold) {
            targetState = PANEL_STATES.PARTIAL;
          } else {
            targetState = PANEL_STATES.COLLAPSED;
          }
        }

        setPanelState(targetState);
        animatePanelToState(targetState);
      },
    })
  ).current;

  // Event handlers
  const handleQRScan = useCallback((data: string) => {
    try {
      let nodeId = data.trim();

      if (nodeId.startsWith("{")) {
        const parsed = JSON.parse(nodeId);
        nodeId = parsed.node_id || nodeId;
      }
      if (nodeId.startsWith("node:")) {
        nodeId = nodeId.substring(5);
      }

      const node = graph?.getNode(nodeId);
      if (node) {
        setCurrentLocation(node.node_id);
        setCurrentFloor(node.floor);
        setShowScanner(false);

        Animated.spring(searchBarAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }).start();

        Alert.alert(
          "Location Set",
          `You are now at ${node.label} on Floor ${node.floor}`,
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Invalid QR Code", "This QR code is not recognized.");
      }
    } catch (error) {
      Alert.alert("Scan Error", "Unable to read QR code. Please try again.");
    }
  }, [graph]);

  const handleDestinationSelect = useCallback((node: Node) => {
    setDestination(node.node_id);
    setShowDestinations(false);
    setSearchQuery("");

    if (!isPanelVisible) {
      setIsPanelVisible(true);
      setPanelState(PANEL_STATES.PARTIAL);
      animatePanelToState(PANEL_STATES.PARTIAL);
    }
  }, [isPanelVisible, animatePanelToState]);

  const togglePanel = useCallback(() => {
    if (!isPanelVisible) {
      setIsPanelVisible(true);
      setPanelState(PANEL_STATES.PARTIAL);
      animatePanelToState(PANEL_STATES.PARTIAL);
    } else {
      const newState = panelState === PANEL_STATES.COLLAPSED ?
        PANEL_STATES.PARTIAL : PANEL_STATES.COLLAPSED;
      setPanelState(newState);
      animatePanelToState(newState);
    }
  }, [isPanelVisible, panelState, animatePanelToState]);

  const expandPanel = useCallback(() => {
    if (panelState !== PANEL_STATES.EXPANDED) {
      setPanelState(PANEL_STATES.EXPANDED);
      animatePanelToState(PANEL_STATES.EXPANDED);
    }
  }, [panelState, animatePanelToState]);

  const collapsePanel = useCallback(() => {
    if (panelState !== PANEL_STATES.COLLAPSED) {
      setPanelState(PANEL_STATES.COLLAPSED);
      animatePanelToState(PANEL_STATES.COLLAPSED);
    }
  }, [panelState, animatePanelToState]);

  const clearNavigation = useCallback(() => {
    setDestination(null);
    setPath([]);
    setDistance(0);
    setEstimatedTime(0);
    setTargetFloor(null);
    setFloorChangeMessage("");
    setSearchQuery("");

    setPanelState(PANEL_STATES.COLLAPSED);
    animatePanelToState(PANEL_STATES.COLLAPSED);
  }, [animatePanelToState]);

  const resetAll = useCallback(() => {
    setCurrentLocation(null);
    setCurrentFloor(null);
    clearNavigation();
    setShowDestinations(false);
    setIsPanelVisible(false);

    panelY.current = height;
    Animated.spring(panelTranslateY, {
      toValue: height,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();

    Animated.spring(searchBarAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [clearNavigation, height]);

  const handleNodePress = useCallback((node: Node) => {
    if (currentLocation && node.node_id !== currentLocation) {
      setDestination(node.node_id);

      if (!isPanelVisible) {
        setIsPanelVisible(true);
        setPanelState(PANEL_STATES.PARTIAL);
        animatePanelToState(PANEL_STATES.PARTIAL);
      }
    }
  }, [currentLocation, isPanelVisible, animatePanelToState]);

  const handleFloorSelect = useCallback((floor: number) => {
    if (currentFloor !== floor) {
      Alert.alert(
        "Switch Floor",
        `Navigate to Floor ${floor}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Navigate",
            onPress: () => {
              setCurrentFloor(floor);
              Alert.alert(
                "Floor Changed",
                `You are now viewing Floor ${floor}. Scan a QR code to set your location.`,
                [{ text: "OK" }]
              );
            }
          }
        ]
      );
    }
  }, [currentFloor]);

  const getPanelStateIcon = useCallback(() => {
    if (!isPanelVisible) return "chevron-up";

    switch (panelState) {
      case PANEL_STATES.EXPANDED:
        return "chevron-down";
      case PANEL_STATES.PARTIAL:
        return "chevron-up";
      case PANEL_STATES.COLLAPSED:
        return "chevron-up";
      default:
        return "chevron-up";
    }
  }, [isPanelVisible, panelState]);

  const getCategoryIcon = useCallback((type: string) => {
    const icons: Record<string, string> = {
      shop: "shopping-bag",
      café: "coffee",
      restaurant: "utensils",
      entrance: "door-open",
      stair: "walking",
      elevator: "elevator",
      escalator: "arrows-alt-v",
      junction: "exchange-alt",
      exit: "sign-out-alt",
      restroom: "restroom",
      info: "info-circle",
    };
    return icons[type] || "map-marker-alt";
  }, []);

  const groupNodesByType = useCallback((nodes: Node[]) => {
    const grouped: Record<string, Node[]> = {};
    nodes.forEach(node => {
      if (!grouped[node.type]) grouped[node.type] = [];
      grouped[node.type].push(node);
    });
    return grouped;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingContent, { opacity: fadeInAnim }]}>
          <ActivityIndicator size={IS_LARGE_DEVICE ? "large" : "small"} color="#4A6FA5" />
          <Text style={styles.loadingTitle}>Mall Navigator</Text>
          <Text style={styles.loadingSubtitle}>Loading Indoor Navigation...</Text>
          <View style={styles.loadingProgress}>
            <View style={styles.loadingBar} />
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          nodes={nodesForCurrentMap}
          edges={edges}
          path={path}
          currentLocation={currentNode}
          destination={destinationNode}
          onNodePress={handleNodePress}
        />
      </View>

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerOpacity,
            transform: [{
              translateY: searchBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -10]
              })
            }]
          }
        ]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.appTitle}>MallNav</Text>
            <Text style={styles.appSubtitle}>
              {currentFloor ? `Floor ${currentFloor}` : "Indoor Navigation"}
            </Text>
          </View>

          <View style={styles.headerRight}>
            {currentFloor && (
              <TouchableOpacity
                style={styles.floorBadge}
                onPress={() => handleFloorSelect(currentFloor)}
              >
                <Ionicons name="layers" size={16} color="#4A6FA5" />
                <Text style={styles.floorBadgeText}>F{currentFloor}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowScanner(true)}
            >
              <Ionicons name="qr-code-outline" size={22} color="#4A6FA5" />
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View
          style={[
            styles.searchContainer,
            {
              opacity: searchBarAnim,
              transform: [{
                translateY: searchBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0]
                })
              }]
            }
          ]}
        >
          <TouchableOpacity
            style={styles.searchInput}
            onPress={() => setShowDestinations(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="search" size={18} color="#6C757D" />
            <Text style={styles.searchPlaceholder}>
              {destination ? `To: ${destinationNode?.label}` : "Search destination..."}
            </Text>
            {destination && (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={clearNavigation}
              >
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.scanButton]}
          onPress={() => setShowScanner(true)}
        >
          <Ionicons name="qr-code" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.navButton,
            !currentLocation && styles.disabledButton
          ]}
          onPress={() => currentLocation && setShowDestinations(true)}
          disabled={!currentLocation}
        >
          <Ionicons
            name="navigate"
            size={22}
            color={currentLocation ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.resetButton]}
          onPress={resetAll}
        >
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {destination && (
          <TouchableOpacity
            style={[styles.actionButton, styles.panelToggleButton]}
            onPress={togglePanel}
          >
            <Ionicons
              name={getPanelStateIcon()}
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        )}
      </View>

      {destination && isPanelVisible && (
        <Animated.View
          style={[
            styles.destinationPanel,
            {
              transform: [{ translateY: panelTranslateY }],
            }
          ]}
        >
          <PanelHandle
            panelState={panelState}
            destination={destinationNode}
            onExpand={() => {
              setPanelState(PANEL_STATES.PARTIAL);
              animatePanelToState(PANEL_STATES.PARTIAL);
            }}
            panHandlers={panelPanResponder.panHandlers}
          />

          {(panelState === PANEL_STATES.PARTIAL || panelState === PANEL_STATES.EXPANDED) && (
            <PanelContent
              panelState={panelState}
              currentLocation={currentNode}
              destination={destinationNode}
              currentFloor={currentFloor}
              distance={distance}
              estimatedTime={estimatedTime}
              path={path}
              graph={graph}
              floorChangeMessage={floorChangeMessage}
              targetFloor={targetFloor}
              onFloorSelect={handleFloorSelect}
              onClear={clearNavigation}
              onExpand={expandPanel}
              onCollapse={collapsePanel}
            />
          )}
        </Animated.View>
      )}

      {/* QR Scanner Modal */}
      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />

      {/* Destinations Modal */}
      <DestinationsModal
        visible={showDestinations}
        onClose={() => setShowDestinations(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredNodes={filteredNodes}
        groupNodesByType={groupNodesByType}
        getCategoryIcon={getCategoryIcon}
        getTypeColor={getTypeColor}
        destination={destination}
        handleDestinationSelect={handleDestinationSelect}
        currentFloor={currentFloor}
      />

      {/* No Location Overlay */}
      {!currentLocation && (
        <WelcomeOverlay
          fadeInAnim={fadeInAnim}
          onScanPress={() => setShowScanner(true)}
        />
      )}
    </SafeAreaView>
  );
}

// Panel Handle
const PanelHandle = React.memo(({
  panelState,
  destination,
  onExpand,
  panHandlers
}: {
  panelState: number;
  destination?: Node;
  onExpand: () => void;
  panHandlers: any;
}) => (
  <View
    {...panHandlers}
    style={[
      styles.panelHandle,
      panelState === PANEL_STATES.COLLAPSED && styles.collapsedHandle
    ]}
  >
    <View style={styles.handleBar} />
    {panelState === PANEL_STATES.COLLAPSED && destination && (
      <View style={styles.collapsedContent}>
        <View style={styles.collapsedInfo}>
          <Ionicons name="flag" size={14} color="#E63946" />
          <Text style={styles.collapsedText} numberOfLines={1}>
            Route to {destination.label}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.collapsedExpandButton}
          onPress={onExpand}
        >
          <Ionicons name="chevron-up" size={16} color="#4A6FA5" />
        </TouchableOpacity>
      </View>
    )}
  </View>
));
PanelHandle.displayName = "PanelHandle";

// Panel Content
const PanelContent = React.memo(({
  panelState,
  currentLocation,
  destination,
  currentFloor,
  distance,
  estimatedTime,
  path,
  graph,
  floorChangeMessage,
  targetFloor,
  onFloorSelect,
  onClear,
  onExpand,
  onCollapse,
}: any) => (
  <View
    style={[
      styles.panelContent,
      {
        height: panelState === PANEL_STATES.EXPANDED ?
          PANEL_HEIGHTS.EXPANDED - 60 : PANEL_HEIGHTS.PARTIAL - 60,
      }
    ]}
  >
    <View style={styles.panelHeader}>
      <Text style={styles.panelTitle}>Route Details</Text>
      <View style={styles.panelHeaderActions}>
        {panelState === PANEL_STATES.PARTIAL && (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={onExpand}
          >
            <Ionicons name="expand" size={20} color="#4A6FA5" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.panelCloseButton}
          onPress={onCollapse}
        >
          <Ionicons name="chevron-down" size={24} color="#6C757D" />
        </TouchableOpacity>
      </View>
    </View>

    <ScrollView
      style={styles.panelScrollView}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={true}
    >
      <DestinationInfoContent
        currentLocation={currentLocation}
        destination={destination}
        currentFloor={currentFloor}
        distance={distance}
        estimatedTime={estimatedTime}
        path={path}
        graph={graph}
        floorChangeMessage={floorChangeMessage}
        targetFloor={targetFloor}
        onFloorSelect={onFloorSelect}
        panelState={panelState}
      />
    </ScrollView>
  </View>
));
PanelContent.displayName = "PanelContent";

// Destination Info
const DestinationInfoContent = React.memo(({
  currentLocation,
  destination,
  currentFloor,
  distance,
  estimatedTime,
  path,
  graph,
  floorChangeMessage,
  targetFloor,
  onFloorSelect,
  panelState,
}: any) => {
  const steps = useMemo(() => {
    if (path.length < 2) return [];

    const stepsArray = [];
    for (let i = 0; i < path.length; i++) {
      const node = graph?.getNode(path[i]);
      if (node) {
        stepsArray.push({
          ...node,
          isFirst: i === 0,
          isLast: i === path.length - 1,
          index: i,
        });
      }
    }
    return stepsArray;
  }, [path, graph]);

  return (
    <View style={infoStyles.container}>

      {/* Floor Change Alert */}
      {floorChangeMessage ? (
        <View style={infoStyles.alertContainer}>
          <View style={infoStyles.alertHeader}>
            <Ionicons name="swap-vertical" size={20} color="#FF9800" />
            <Text style={infoStyles.alertTitle}>Floor Change Required</Text>
          </View>
          <Text style={infoStyles.alertText}>{floorChangeMessage}</Text>
          {targetFloor && (
            <TouchableOpacity
              style={infoStyles.alertButton}
              onPress={() => onFloorSelect(targetFloor)}
            >
              <Text style={infoStyles.alertButtonText}>Go to Floor {targetFloor}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={infoStyles.statsContainer}>
          <View style={infoStyles.statRow}>
            <View style={infoStyles.statItem}>
              <Ionicons name="walk" size={24} color="#4A6FA5" />
              <Text style={infoStyles.statValue}>{distance.toFixed(0)}m</Text>
              <Text style={infoStyles.statLabel}>Distance</Text>
            </View>

            <View style={infoStyles.statItem}>
              <Ionicons name="time" size={24} color="#2A9D8F" />
              <Text style={infoStyles.statValue}>{estimatedTime} min</Text>
              <Text style={infoStyles.statLabel}>Est. Time</Text>
            </View>

            <View style={infoStyles.statItem}>
              <Ionicons name="footsteps" size={24} color="#E76F51" />
              <Text style={infoStyles.statValue}>{path.length - 1}</Text>
              <Text style={infoStyles.statLabel}>Steps</Text>
            </View>

            <View style={infoStyles.statItem}>
              <Ionicons name="layers" size={24} color="#9D4EDD" />
              <Text style={infoStyles.statValue}>{currentFloor}</Text>
              <Text style={infoStyles.statLabel}>Current Floor</Text>
            </View>
          </View>
        </View>
      )}


      {/* Route Overview */}
      <View style={infoStyles.routeOverview}>
        <View style={infoStyles.locationRow}>
          <View style={[infoStyles.dot, infoStyles.startDot]}>
            <Ionicons name="locate" size={14} color="#FFFFFF" />
          </View>
          <View style={infoStyles.locationInfo}>
            <Text style={infoStyles.locationLabel}>Start</Text>
            <Text style={infoStyles.locationName}>{currentLocation?.label}</Text>
            <Text style={infoStyles.locationDetail}>Floor {currentFloor}</Text>
          </View>
        </View>

        <View style={infoStyles.distanceLine}>
          <View style={infoStyles.distanceDot} />
          <View style={infoStyles.distanceLineMiddle} />
          <View style={infoStyles.distanceDot} />
        </View>

        <View style={infoStyles.locationRow}>
          <View style={[infoStyles.dot, infoStyles.endDot]}>
            <Ionicons name="flag" size={14} color="#FFFFFF" />
          </View>
          <View style={infoStyles.locationInfo}>
            <Text style={infoStyles.locationLabel}>Destination</Text>
            <Text style={infoStyles.locationName}>{destination?.label}</Text>
            <Text style={infoStyles.locationDetail}>
              Floor {destination?.floor}
              {destination?.floor !== currentFloor &&
                ` • ${Math.abs((destination?.floor || 0) - currentFloor!)} floor(s) away`}
            </Text>
          </View>
        </View>
      </View>

      {/* Route Steps */}
      {panelState > PANEL_STATES.COLLAPSED && steps.length > 0 && (
        <View style={infoStyles.stepsContainer}>
          <View style={infoStyles.sectionHeader}>
            <Ionicons name="list" size={20} color="#4A6FA5" />
            <Text style={infoStyles.sectionTitle}>Step-by-Step Directions</Text>
            <Text style={infoStyles.stepCount}>({steps.length - 1} steps)</Text>
          </View>

          <View style={infoStyles.stepsList}>
            {steps.map((step: any) => (
              <View key={step.node_id} style={infoStyles.stepItem}>
                <View style={infoStyles.stepIndicator}>
                  <View style={[
                    infoStyles.stepDot,
                    step.isFirst && infoStyles.stepDotStart,
                    step.isLast && infoStyles.stepDotEnd,
                    !step.isFirst && !step.isLast && infoStyles.stepDotIntermediate
                  ]}>
                    {step.isFirst ? (
                      <Ionicons name="locate" size={10} color="#FFFFFF" />
                    ) : step.isLast ? (
                      <Ionicons name="flag" size={10} color="#FFFFFF" />
                    ) : (
                      <Text style={infoStyles.stepNumber}>{step.index}</Text>
                    )}
                  </View>
                  {!step.isLast && (
                    <View style={infoStyles.stepLine} />
                  )}
                </View>

                <View style={infoStyles.stepContent}>
                  <Text style={infoStyles.stepName}>{step.label}</Text>
                  <View style={infoStyles.stepDetails}>
                    <View style={[
                      infoStyles.typeBadge,
                      { backgroundColor: getTypeColor(step.type) + '20' }
                    ]}>
                      <MaterialIcons
                        name={getTypeIcon(step.type)}
                        size={12}
                        color={getTypeColor(step.type)}
                      />
                      <Text style={[
                        infoStyles.typeText,
                        { color: getTypeColor(step.type) }
                      ]}>
                        {getTypeLabel(step.type)}
                      </Text>
                    </View>
                    <Text style={infoStyles.floorBadge}>
                      Floor {step.floor}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Quick Tips */}
      {panelState === PANEL_STATES.EXPANDED && (
        <View style={infoStyles.tipsContainer}>
          <View style={infoStyles.sectionHeader}>
            <Ionicons name="bulb" size={20} color="#FFB74D" />
            <Text style={infoStyles.sectionTitle}>Navigation Tips</Text>
          </View>

          <View style={infoStyles.tipsList}>
            <View style={infoStyles.tipItem}>
              <Ionicons name="eye" size={16} color="#4A6FA5" />
              <Text style={infoStyles.tipText}>
                Follow the highlighted path on the map
              </Text>
            </View>

            <View style={infoStyles.tipItem}>
              <Ionicons name="alert-circle" size={16} color="#FF9800" />
              <Text style={infoStyles.tipText}>
                Look for floor change indicators when needed
              </Text>
            </View>

            <View style={infoStyles.tipItem}>
              <Ionicons name="map" size={16} color="#2A9D8F" />
              <Text style={infoStyles.tipText}>
                Zoom in on the map for more detail
              </Text>
            </View>

            <View style={infoStyles.tipItem}>
              <Ionicons name="refresh" size={16} color="#E76F51" />
              <Text style={infoStyles.tipText}>
                Rescan QR codes when changing floors
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
});
DestinationInfoContent.displayName = "DestinationInfoContent";

const DestinationsModal = React.memo(({
  visible,
  onClose,
  searchQuery,
  setSearchQuery,
  filteredNodes,
  groupNodesByType,
  getCategoryIcon,
  getTypeColor,
  destination,
  handleDestinationSelect,
  currentFloor,
}: any) => {
  const groupedNodes = useMemo(() =>
    groupNodesByType(filteredNodes),
    [filteredNodes, groupNodesByType]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <View style={modalStyles.headerContent}>
              <Text style={modalStyles.title}>Choose Destination</Text>
              <Text style={modalStyles.subtitle}>
                {currentFloor ? `Floor ${currentFloor} • ${filteredNodes.length} locations` : "Select where to go"}
              </Text>
            </View>
            <TouchableOpacity style={modalStyles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#6C757D" />
            </TouchableOpacity>
          </View>

          <View style={modalStyles.searchSection}>
            <View style={modalStyles.searchInputContainer}>
              <Ionicons name="search" size={18} color="#6C757D" style={modalStyles.searchIcon} />
              <TextInput
                style={modalStyles.searchInput}
                placeholder="Search stores, restaurants, services..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={modalStyles.clearButton}
                  onPress={() => setSearchQuery("")}
                >
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {filteredNodes.length === 0 ? (
            <View style={modalStyles.emptyState}>
              <Ionicons name="search-outline" size={56} color="#CBD5E1" />
              <Text style={modalStyles.emptyTitle}>No results found</Text>
              <Text style={modalStyles.emptyText}>
                {searchQuery
                  ? `No matches for "${searchQuery}"`
                  : "No destinations available"}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={modalStyles.content}
              showsVerticalScrollIndicator={false}
            >
              {searchQuery ? (
                <SearchResults
                  nodes={filteredNodes}
                  destination={destination}
                  handleDestinationSelect={handleDestinationSelect}
                  getTypeColor={getTypeColor}
                />
              ) : (
                <CategorySections
                  groupedNodes={groupedNodes}
                  destination={destination}
                  handleDestinationSelect={handleDestinationSelect}
                  getCategoryIcon={getCategoryIcon}
                  getTypeColor={getTypeColor}
                />
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
});
DestinationsModal.displayName = "DestinationsModal";

// Search Results
const SearchResults = React.memo(({ nodes, destination, handleDestinationSelect, getTypeColor }: any) => (
  <View style={modalStyles.searchResults}>
    <Text style={modalStyles.sectionTitle}>
      Search Results ({nodes.length})
    </Text>
    <View style={modalStyles.resultsGrid}>
      {nodes.map((node: Node) => (
        <DestinationCard
          key={node.node_id}
          node={node}
          isSelected={destination === node.node_id}
          onPress={() => handleDestinationSelect(node)}
          getTypeColor={getTypeColor}
        />
      ))}
    </View>
  </View>
));
SearchResults.displayName = "SearchResults";

// Category Sections
const CategorySections = React.memo(({ groupedNodes, destination, handleDestinationSelect, getCategoryIcon, getTypeColor }: any) => (
  <>
    {Object.entries(groupedNodes).map(([type, typeNodes]: [string, any]) => (
      <View key={type} style={modalStyles.categorySection}>
        <View style={modalStyles.categoryHeader}>
          <FontAwesome5
            name={getCategoryIcon(type)}
            size={18}
            color={getTypeColor(type)}
          />
          <Text style={modalStyles.categoryTitle}>{getTypeLabel(type)}</Text>
          <Text style={modalStyles.categoryCount}>({typeNodes.length})</Text>
        </View>
        <View style={modalStyles.categoryGrid}>
          {typeNodes.slice(0, 6).map((node: Node) => (
            <DestinationCard
              key={node.node_id}
              node={node}
              isSelected={destination === node.node_id}
              onPress={() => handleDestinationSelect(node)}
              getTypeColor={getTypeColor}
            />
          ))}
        </View>
      </View>
    ))}
  </>
));
CategorySections.displayName = "CategorySections";

// Destination Card
const DestinationCard = React.memo(({ node, isSelected, onPress, getTypeColor }: any) => (
  <TouchableOpacity
    style={[
      modalStyles.destinationCard,
      isSelected && modalStyles.destinationCardSelected
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[
      modalStyles.cardIcon,
      { backgroundColor: getTypeColor(node.type) + '20' }
    ]}>
      <MaterialIcons
        name={getTypeIcon(node.type)}
        size={20}
        color={getTypeColor(node.type)}
      />
    </View>
    <Text style={modalStyles.cardName} numberOfLines={2}>
      {node.label}
    </Text>
    <Text style={modalStyles.cardFloor}>Floor {node.floor}</Text>
    {isSelected && (
      <View style={modalStyles.selectedBadge}>
        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
      </View>
    )}
  </TouchableOpacity>
));
DestinationCard.displayName = "DestinationCard";

// Welcome Overlay 
const WelcomeOverlay = React.memo(({ fadeInAnim, onScanPress }: any) => (
  <View style={styles.welcomeOverlay}>
    <Animated.View style={[styles.welcomeContent, { opacity: fadeInAnim }]}>
      <View style={styles.welcomeIconContainer}>
        <Ionicons name="map" size={48} color="#4A6FA5" />
      </View>
      <Text style={styles.welcomeTitle}>Welcome to Mall Navigator</Text>
      <Text style={styles.welcomeSubtitle}>
        Scan a QR code at any location to start indoor navigation
      </Text>
      <TouchableOpacity
        style={styles.scanButtonLarge}
        onPress={onScanPress}
      >
        <Ionicons name="qr-code" size={24} color="#FFFFFF" />
        <Text style={styles.scanButtonText}>Scan QR Code to Start</Text>
      </TouchableOpacity>
      <Text style={styles.welcomeTip}>
        Look for QR codes near entrances, elevators, and information desks
      </Text>
    </Animated.View>
  </View>
));
WelcomeOverlay.displayName = "WelcomeOverlay";

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 40,
  },
  loadingTitle: {
    fontSize: IS_SMALL_DEVICE ? 24 : 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 24,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: IS_SMALL_DEVICE ? 14 : 16,
    color: '#6C757D',
    marginBottom: 24,
  },
  loadingProgress: {
    width: IS_SMALL_DEVICE ? 150 : 200,
    height: 4,
    backgroundColor: '#E9ECEF',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingBar: {
    height: '100%',
    backgroundColor: '#4A6FA5',
    width: '60%',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    position: 'absolute',
    // top: Platform.OS === 'ios' ? 10 : 20,
    top: 40,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appTitle: {
    fontSize: IS_SMALL_DEVICE ? 18 : 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  appSubtitle: {
    fontSize: 12,
    color: '#6C757D',
    marginTop: 2,
  },
  floorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  floorBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A6FA5',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    marginTop: 12,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: '#6C757D',
  },
  clearSearchButton: {
    padding: 2,
  },
  quickActions: {
    position: 'absolute',
    bottom: IS_SMALL_DEVICE ? 100 : 120,
    right: 16,
    gap: 12,
  },
  actionButton: {
    width: IS_SMALL_DEVICE ? 48 : 56,
    height: IS_SMALL_DEVICE ? 48 : 56,
    borderRadius: IS_SMALL_DEVICE ? 24 : 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  scanButton: {
    backgroundColor: '#4A6FA5',
  },
  navButton: {
    backgroundColor: '#2A9D8F',
  },
  resetButton: {
    backgroundColor: '#E76F51',
  },
  panelToggleButton: {
    backgroundColor: '#6C757D',
  },
  disabledButton: {
    backgroundColor: 'rgba(108, 117, 125, 0.5)',
  },
  destinationPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PANEL_HEIGHTS.EXPANDED,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    overflow: 'hidden',
  },
  panelHandle: {
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  collapsedHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
  },
  collapsedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    marginLeft: 12,
  },
  collapsedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  collapsedText: {
    fontSize: 14,
    color: '#4A6FA5',
    fontWeight: '600',
  },
  collapsedExpandButton: {
    padding: 4,
  },
  panelContent: {
    flex: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  panelHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  expandButton: {
    padding: 4,
  },
  panelCloseButton: {
    padding: 4,
  },
  panelScrollView: {
    flex: 1,
  },
  panelFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    gap: 12,
  },
  panelActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  clearButton: {
    backgroundColor: '#6C757D',
  },
  navigateButton: {
    backgroundColor: '#4A6FA5',
  },
  panelActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  welcomeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  welcomeContent: {
    alignItems: 'center',
    maxWidth: 400,
  },
  welcomeIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: IS_SMALL_DEVICE ? 24 : 28,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: IS_SMALL_DEVICE ? 15 : 17,
    color: '#6C757D',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  scanButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A6FA5',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  scanButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  welcomeTip: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
  },
});

const infoStyles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 10,
  },
  routeOverview: {
    marginBottom: 24,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  startDot: {
    backgroundColor: '#2A9D8F',
  },
  endDot: {
    backgroundColor: '#E63946',
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#6C757D',
    marginBottom: 2,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  locationDetail: {
    fontSize: 13,
    color: '#4A6FA5',
    fontWeight: '500',
  },
  distanceLine: {
    alignItems: 'center',
    marginLeft: 14,
    marginVertical: 4,
    width: 2,
  },
  distanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  distanceLineMiddle: {
    flex: 1,
    width: 2,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  alertContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
  },
  alertText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  alertButton: {
    backgroundColor: '#4A6FA5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6C757D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  stepsContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  stepCount: {
    fontSize: 14,
    color: '#6C757D',
    fontWeight: '500',
  },
  stepsList: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepIndicator: {
    alignItems: 'center',
    marginRight: 12,
    width: 24,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  stepDotStart: {
    backgroundColor: '#2A9D8F',
  },
  stepDotEnd: {
    backgroundColor: '#E63946',
  },
  stepDotIntermediate: {
    backgroundColor: '#4A6FA5',
  },
  stepNumber: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepLine: {
    position: 'absolute',
    top: 24,
    bottom: -16,
    width: 2,
    backgroundColor: '#E2E8F0',
  },
  stepContent: {
    flex: 1,
  },
  stepName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  stepDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  floorBadge: {
    fontSize: 12,
    color: '#6C757D',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tipsContainer: {
    backgroundColor: '#F0F7FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  tipsList: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#4A6FA5',
    lineHeight: 20,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: height * 0.85,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4A6FA5',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#6C757D',
    textAlign: 'center',
  },
  searchResults: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categorySection: {
    marginBottom: 30,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  categoryCount: {
    fontSize: 14,
    color: '#6C757D',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  destinationCard: {
    width: (width - 64) / 3,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  destinationCardSelected: {
    borderColor: '#4A6FA5',
    backgroundColor: '#E8F4FF',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
    minHeight: 36,
  },
  cardFloor: {
    fontSize: 11,
    color: '#6C757D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4A6FA5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});