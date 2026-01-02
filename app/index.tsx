// app/index.tsx
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapView } from "../components/MapView";
import { QRScanner } from "../components/QRScanner";
import { generateMultiFloorData } from "../utils/dataGenerator";
import { Edge, Graph, Node } from "../utils/dijkstra";

const { width, height } = Dimensions.get("window");

export default function Index() {
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
  const [showInstructions, setShowInstructions] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentFloor, setCurrentFloor] = useState<number | null>(null);
  const [targetFloor, setTargetFloor] = useState<number | null>(null);
  const [floorChangeMessage, setFloorChangeMessage] = useState<string>("");
  const [showFloorSelector, setShowFloorSelector] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    const initGraph = () => {
      try {
        const { nodes: generatedNodes, edges: generatedEdges } = generateMultiFloorData();

        setNodes(generatedNodes);
        setEdges(generatedEdges);
        const newGraph = new Graph(
          generatedNodes,
          generatedEdges
        );
        setGraph(newGraph);
        setLoading(false);

        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      } catch (error) {
        console.error("Error initializing graph:", error);
        setLoading(false);
      }
    };

    initGraph();
  }, []);

  useEffect(() => {
    if (graph && currentLocation && destination) {
      const result = graph.getShortestPath(currentLocation, destination);
      if (result) {
        setPath(result.path);
        setDistance(result.distance);
        setEstimatedTime(Math.ceil(result.distance / 50));

        if (result.floorChange) {
          setTargetFloor(result.targetFloor || null);
          setFloorChangeMessage(result.message || "");
          Alert.alert(
            "Floor Change Required",
            result.message || `Please go to floor ${result.targetFloor}`,
            [
              {
                text: "OK",
                onPress: () => {
                  setFloorChangeMessage(result.message || "");
                }
              }
            ]
          );
        } else {
          setTargetFloor(null);
          setFloorChangeMessage("");
        }
      } else {
        Alert.alert(
          "No Path Found",
          "There is no accessible path to this destination."
        );
        setPath([]);
        setDistance(0);
        setEstimatedTime(0);
        setTargetFloor(null);
        setFloorChangeMessage("");
      }
    }
  }, [graph, currentLocation, destination]);

  const handleQRScan = (data: string) => {
    let nodeId = data.trim();

    if (nodeId.startsWith("{")) {
      try {
        const parsed = JSON.parse(nodeId);
        nodeId = parsed.node_id || nodeId;
        const floor = parsed.floor || 1;

        const node = graph?.getNode(nodeId);
        if (node) {
          setCurrentLocation(nodeId);
          setCurrentFloor(node.floor);
          setShowScanner(false);

          Animated.sequence([
            Animated.timing(slideAnim, {
              toValue: 300,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]).start();

          setTimeout(() => setShowDestinations(true), 500);
        } else {
          Alert.alert("Invalid QR Code", `Node "${nodeId}" not found in the map.`);
        }
        return;
      } catch (e) {
        console.log("QR data is not JSON, using as-is");
      }
    }

    if (nodeId.startsWith("node:")) {
      nodeId = nodeId.substring(5);
    }

    const node = graph?.getNode(nodeId);
    if (node) {
      setCurrentLocation(nodeId);
      setCurrentFloor(node.floor);
      setShowScanner(false);

      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => setShowDestinations(true), 500);
    } else {
      Alert.alert("Invalid QR Code", `Node "${nodeId}" not found in the map.`);
    }
  };

  const handleDestinationSelect = (node: Node) => {
    setDestination(node.node_id);
    setShowDestinations(false);
    setSearchQuery("");
  };

  const getCurrentNode = (): Node | undefined => {
    return currentLocation ? graph?.getNode(currentLocation) : undefined;
  };

  const getDestinationNode = (): Node | undefined => {
    return destination ? graph?.getNode(destination) : undefined;
  };

  const clearDestination = () => {
    setDestination(null);
    setPath([]);
    setDistance(0);
    setEstimatedTime(0);
    setTargetFloor(null);
    setFloorChangeMessage("");
    setSearchQuery("");
  };

  const resetNavigation = () => {
    setCurrentLocation(null);
    setCurrentFloor(null);
    setDestination(null);
    setPath([]);
    setDistance(0);
    setEstimatedTime(0);
    setShowDestinations(false);
    setSearchQuery("");
    setTargetFloor(null);
    setFloorChangeMessage("");
  };

  const getCurrentFloorNodes = (): Node[] => {
    if (!currentFloor) return [];
    return nodes.filter(node => node.floor === currentFloor);
  };

  const getDestinationNodes = (): Node[] => {
    if (!currentLocation || !currentFloor) return [];

    return nodes.filter((node) =>
      node.node_id !== currentLocation &&
      node.type !== 'junction' &&
      node.type !== 'stair'
    );
  };

  const getFilteredNodes = (): Node[] => {
    const destinationNodes = getDestinationNodes();

    if (!searchQuery.trim()) {
      return destinationNodes;
    }

    const query = searchQuery.toLowerCase().trim();
    return destinationNodes.filter((node) => {
      return (
        node.label.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query) ||
        node.node_id.toLowerCase().includes(query)
      );
    });
  };

  const groupNodesByType = (nodes: Node[]) => {
    const grouped: Record<string, Node[]> = {};

    nodes.forEach((node) => {
      if (!grouped[node.type]) {
        grouped[node.type] = [];
      }
      grouped[node.type].push(node);
    });

    return grouped;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "shop":
        return "storefront";
      case "café":
        return "local-cafe";
      case "restaurant":
        return "restaurant";
      case "entrance":
        return "entry";
      case "exit":
        return "exit-to-app";
      case "stair":
        return "stairs";
      case "junction":
        return "adjust";
      default:
        return "place";
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case "shop":
        return "#4A6FA5";
      case "café":
        return "#D4A762";
      case "restaurant":
        return "#E76F51";
      case "entrance":
        return "#2A9D8F";
      case "exit":
        return "#E63946";
      case "stair":
        return "#9D4EDD";
      case "junction":
        return "#6C757D";
      default:
        return "#495057";
    }
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      shop: "Stores",
      café: "Coffee & Café",
      restaurant: "Dining",
      entrance: "Entrances",
      stair: "Stairs & Escalators",
      junction: "Intersections",
      exit: "Exits",
    };

    return labels[type] || type;
  };

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case "shop":
        return "shopping-bag";
      case "café":
        return "coffee";
      case "restaurant":
        return "utensils";
      case "entrance":
        return "door-open";
      case "stair":
        return "walking";
      case "junction":
        return "exchange-alt";
      case "exit":
        return "sign-out-alt";
      default:
        return "map-marker-alt";
    }
  };

  const handleModalClose = () => {
    setShowDestinations(false);
    setSearchQuery("");
  };

  // Get floors list
  const getFloors = (): number[] => {
    if (!graph) return [];
    return graph.getFloors();
  };

  const getNodesForCurrentMap = (): Node[] => {
    if (!currentFloor) return nodes;
    return nodes.filter(node => node.floor === currentFloor);
  };

  // Handle floor selection
  const handleFloorSelect = (floor: number) => {
    if (currentFloor !== floor) {
      Alert.alert(
        "Switch Floor",
        `Switch to floor ${floor}? You'll need to scan a QR code on that floor to continue.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Switch",
            onPress: () => {
              setShowFloorSelector(false);
              Alert.alert(
                "Go to Floor",
                `Please go to floor ${floor} and scan a QR code to continue navigation.`,
                [{ text: "OK" }]
              );
            }
          }
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#4A6FA5" />
          <Text style={styles.loadingText}>Loading Mall Map...</Text>
          <Text style={styles.loadingSubtext}>
            Preparing multi-floor navigation
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Main Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>

          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>Navigator</Text>
              <Text style={styles.subtitle}>
                {currentFloor ? `Floor ${currentFloor}` : "Multi-floor Navigation"}
              </Text>
            </View>
            
            <View style={styles.headerActions}>
              <View>
              {currentFloor && (
                <TouchableOpacity
                  style={[styles.iconButton, styles.floorButton]}
                  onPress={() => setShowFloorSelector(true)}
                >
                  <Ionicons name="business" size={22} color="#4A6FA5" />
                  <Text style={styles.floorText}>{currentFloor}</Text>
                </TouchableOpacity>
              )}

            </View>
            <TouchableOpacity
                style={[styles.iconButton, styles.infoButton]}
                onPress={() => setShowInstructions(true)}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={24}
                  color="#4A6FA5"
                />
              </TouchableOpacity>
            </View>


          </View>


        </Animated.View>

        <Animated.View
          style={[
            styles.statusCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {currentLocation ? (
            <>
              <View style={styles.statusHeader}>
                <View style={styles.locationIndicator}>
                  <Ionicons name="location" size={20} color="#2A9D8F" />
                  <Text style={styles.currentLocationText}>
                    You are at: {getCurrentNode()?.label}
                  </Text>
                  {currentFloor && (
                    <View style={styles.floorBadge}>
                      <Text style={styles.floorBadgeText}>Floor {currentFloor}</Text>
                    </View>
                  )}
                </View>
                {/* <TouchableOpacity
                  onPress={resetNavigation}
                  style={styles.resetBtn}
                >
                  <Ionicons name="refresh" size={18} color="#6C757D" />
                  <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity> */}
              </View>

              {destination ? (
                <View style={styles.navigationInfo}>
                  <View style={styles.destinationRow}>
                    <Ionicons name="flag" size={20} color="#E63946" />
                    <View style={styles.destinationInfo}>
                      <Text style={styles.destinationText}>
                        {getDestinationNode()?.label}
                      </Text>
                      {getDestinationNode()?.floor && (
                        <Text style={styles.destinationFloor}>
                          Floor {getDestinationNode()?.floor}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={clearDestination}
                      style={styles.clearBtn}
                    >
                      <Ionicons name="close-circle" size={20} color="#E63946" />
                    </TouchableOpacity>
                  </View>

                  {floorChangeMessage ? (
                    <View style={styles.floorChangeAlert}>
                      <Ionicons name="alert-circle" size={24} color="#FF9800" />
                      <View style={styles.floorChangeMessage}>
                        <Text style={styles.floorChangeTitle}>
                          Floor Change Required
                        </Text>
                        <Text style={styles.floorChangeText}>
                          {floorChangeMessage}
                        </Text>
                        {targetFloor && (
                          <TouchableOpacity
                            style={styles.goToFloorButton}
                            onPress={() => {
                              Alert.alert(
                                "Navigate to Floor",
                                `Please go to floor ${targetFloor} and scan a QR code.`,
                                [{ text: "OK" }]
                              );
                            }}
                          >
                            <Text style={styles.goToFloorText}>
                              Go to Floor {targetFloor}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.statsContainer}>
                        <View style={styles.statBox}>
                          <Text style={styles.statValue}>
                            {distance.toFixed(1)} m
                          </Text>
                          <Text style={styles.statLabel}>Distance</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statValue}>{estimatedTime} min</Text>
                          <Text style={styles.statLabel}>Est. Time</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statValue}>{path.length - 1}</Text>
                          <Text style={styles.statLabel}>Steps</Text>
                        </View>
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.pathContainer}
                      >
                        {path.map((nodeId, index) => (
                          <View key={nodeId} style={styles.pathStep}>
                            {index > 0 && (
                              <Ionicons
                                name="chevron-forward"
                                size={16}
                                color="#6C757D"
                                style={styles.pathArrow}
                              />
                            )}
                            <View
                              style={[
                                styles.pathDot,
                                {
                                  backgroundColor:
                                    index === 0
                                      ? "#2A9D8F"
                                      : index === path.length - 1
                                        ? "#E63946"
                                        : "#4A6FA5",
                                },
                              ]}
                            />
                            <Text style={styles.pathStepText}>
                              {graph?.getNode(nodeId)?.label || nodeId}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.chooseDestinationBtn}
                  onPress={() => setShowDestinations(true)}
                >
                  <Ionicons name="navigate" size={24} color="#FFFFFF" />
                  <Text style={styles.chooseDestinationText}>
                    Choose Destination
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.welcomeContent}>
              <Ionicons
                name="layers"
                size={48}
                color="#4A6FA5"
                style={styles.welcomeIcon}
              />
              <Text style={styles.welcomeTitle}>Welcome to Mall Navigator</Text>
              <Text style={styles.welcomeDescription}>
                Scan a QR code at any location in the mall to start navigation
              </Text>
              <TouchableOpacity
                style={styles.scanStartBtn}
                onPress={() => setShowScanner(true)}
              >
                <Ionicons name="qr-code" size={24} color="#FFFFFF" />
                <Text style={styles.scanStartText}>Scan QR to Start</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* Map Container */}
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <View style={styles.mapTitleRow}>
              <Text style={styles.mapTitle}>
                {currentFloor ? `Floor ${currentFloor} Map` : "Mall Map"}
              </Text>
              {currentFloor && (
                <TouchableOpacity
                  style={styles.floorSelectorButton}
                  onPress={() => setShowFloorSelector(true)}
                >
                  <Text style={styles.floorSelectorText}>Change Floor</Text>
                  <Ionicons name="chevron-down" size={16} color="#4A6FA5" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.mapSubtitle}>
              {currentFloor
                ? "Tap locations to navigate • Zoom & pan to explore"
                : "Scan QR code to see specific floor map"}
            </Text>
          </View>
          <View style={styles.mapWrapper}>
            <MapView
              nodes={getNodesForCurrentMap()}
              edges={edges}
              path={path}
              currentLocation={getCurrentNode()}
              onNodePress={(node) => {
                if (currentLocation && node.node_id !== currentLocation) {
                  setDestination(node.node_id);
                }
              }}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowScanner(true)}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#4A6FA5" }]}>
                <Ionicons name="qr-code" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionText}>Scan QR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => currentLocation && setShowDestinations(true)}
              disabled={!currentLocation}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: currentLocation ? "#2A9D8F" : "#CCCCCC" },
                ]}
              >
                <Ionicons name="navigate" size={24} color="#FFFFFF" />
              </View>
              <Text
                style={[
                  styles.actionText,
                  !currentLocation && styles.disabledText,
                ]}
              >
                Navigate
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={resetNavigation}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#E76F51" }]}>
                <Ionicons name="refresh" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Floating QR Button */}
      {!showScanner && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => setShowScanner(true)}
        >
          <Ionicons name="qr-code" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* QR Scanner Modal */}
      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />

      {/* Destinations Modal */}
      <DestinationModal
        visible={showDestinations}
        onClose={handleModalClose}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredNodes={getFilteredNodes()}
        groupNodesByType={groupNodesByType}
        getCategoryIcon={getCategoryIcon}
        getTypeColor={getTypeColor}
        getTypeLabel={getTypeLabel}
        getTypeIcon={getTypeIcon}
        destination={destination}
        handleDestinationSelect={handleDestinationSelect}
        currentFloor={currentFloor}
      />

      {/* Floor Selector Modal */}
      <Modal
        visible={showFloorSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFloorSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "60%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Floor</Text>
                <Text style={styles.modalSubtitle}>
                  Choose floor to navigate
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowFloorSelector(false)}
              >
                <Ionicons name="close" size={28} color="#6C757D" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.floorList}>
              {getFloors().map((floor) => (
                <TouchableOpacity
                  key={floor}
                  style={[
                    styles.floorItem,
                    currentFloor === floor && styles.selectedFloorItem,
                  ]}
                  onPress={() => handleFloorSelect(floor)}
                >
                  <View style={styles.floorItemContent}>
                    <View style={styles.floorIcon}>
                      <Ionicons
                        name="business"
                        size={24}
                        color={currentFloor === floor ? "#4A6FA5" : "#6C757D"}
                      />
                    </View>
                    <View style={styles.floorInfo}>
                      <Text style={[
                        styles.floorNumber,
                        currentFloor === floor && styles.selectedFloorNumber
                      ]}>
                        Floor {floor}
                      </Text>
                      <Text style={styles.floorDescription}>
                        {floor === 1 ? "Main Entrance • Food Court" :
                          floor === 2 ? "Electronics • Fashion" :
                            floor === 3 ? "Home Decor • Furniture" :
                              floor === 4 ? "Sports • Toys" :
                                floor === 5 ? "Beauty • Health" :
                                  floor === 6 ? "Books • Stationery" :
                                    floor === 7 ? "Restaurants • Dining" :
                                      floor === 8 ? "Cinema • Entertainment" :
                                        floor === 9 ? "Office Supplies • Business" :
                                          floor === 10 ? "Observation Deck • Services" : "Shopping Floor"}
                      </Text>
                    </View>
                    {currentFloor === floor && (
                      <View style={styles.currentFloorBadge}>
                        <Text style={styles.currentFloorBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Instructions Modal */}
      <InstructionsModal
        visible={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </SafeAreaView>
  );
}

// Destination Modal Component
const DestinationModal = ({
  visible,
  onClose,
  searchQuery,
  setSearchQuery,
  filteredNodes,
  groupNodesByType,
  getCategoryIcon,
  getTypeColor,
  getTypeLabel,
  getTypeIcon,
  destination,
  handleDestinationSelect,
  currentFloor,
}: any) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>Select Destination</Text>
            <Text style={styles.modalSubtitle}>
              {currentFloor ? `Current Floor: ${currentFloor}` : "Choose where to go"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={onClose}
          >
            <Ionicons name="close" size={28} color="#6C757D" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#6C757D"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search destinations..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearSearchButton}
                onPress={() => setSearchQuery("")}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.destinationsList}
          showsVerticalScrollIndicator={false}
        >
          {filteredNodes.length === 0 ? (
            <View style={styles.noResultsContainer}>
              <Ionicons
                name="search-outline"
                size={48}
                color="#CBD5E1"
              />
              <Text style={styles.noResultsTitle}>No results found</Text>
              <Text style={styles.noResultsText}>
                {searchQuery
                  ? `No destinations matching "${searchQuery}"`
                  : "No destinations available"}
              </Text>
            </View>
          ) : searchQuery ? (
            <View style={styles.searchResultsSection}>
              <View style={styles.categoryHeader}>
                <FontAwesome5
                  name="search"
                  size={18}
                  color="#4A6FA5"
                />
                <Text style={styles.categoryTitle}>
                  Search Results ({filteredNodes.length})
                </Text>
              </View>
              <View style={styles.destinationsGrid}>
                {filteredNodes.map((node: Node) => (
                  <TouchableOpacity
                    key={node.node_id}
                    style={[
                      styles.destinationCard,
                      destination === node.node_id &&
                      styles.selectedDestinationCard,
                    ]}
                    onPress={() => handleDestinationSelect(node)}
                  >
                    <View
                      style={[
                        styles.destinationIcon,
                        { backgroundColor: getTypeColor(node.type) },
                      ]}
                    >
                      <MaterialIcons
                        name={getTypeIcon(node.type)}
                        size={20}
                        color="#FFFFFF"
                      />
                    </View>
                    <Text
                      style={styles.destinationName}
                      numberOfLines={2}
                    >
                      {node.label}
                    </Text>
                    <Text style={styles.destinationType}>
                      Floor {node.floor}
                    </Text>
                    {destination === node.node_id && (
                      <View style={styles.selectedBadge}>
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color="#FFFFFF"
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            Object.entries(groupNodesByType(filteredNodes)).map(([type, typeNodes]: [string, any]) => (
              <View key={type} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <FontAwesome5
                    name={getCategoryIcon(type)}
                    size={18}
                    color={getTypeColor(type)}
                  />
                  <Text style={styles.categoryTitle}>
                    {getTypeLabel(type)}
                  </Text>
                  <Text style={styles.categoryCount}>
                    ({typeNodes.length})
                  </Text>
                </View>

                <View style={styles.destinationsGrid}>
                  {typeNodes.map((node: Node) => (
                    <TouchableOpacity
                      key={node.node_id}
                      style={[
                        styles.destinationCard,
                        destination === node.node_id &&
                        styles.selectedDestinationCard,
                      ]}
                      onPress={() => handleDestinationSelect(node)}
                    >
                      <View
                        style={[
                          styles.destinationIcon,
                          { backgroundColor: getTypeColor(node.type) },
                        ]}
                      >
                        <MaterialIcons
                          name={getTypeIcon(node.type)}
                          size={20}
                          color="#FFFFFF"
                        />
                      </View>
                      <Text
                        style={styles.destinationName}
                        numberOfLines={2}
                      >
                        {node.label}
                      </Text>
                      <Text style={styles.destinationType}>
                        Floor {node.floor}
                      </Text>
                      {destination === node.node_id && (
                        <View style={styles.selectedBadge}>
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color="#FFFFFF"
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

// Instructions Modal Component
const InstructionsModal = ({ visible, onClose }: any) => (
  <Modal
    visible={visible}
    animationType="slide"
    transparent={true}
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { maxHeight: "80%" }]}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>How to Use</Text>
            <Text style={styles.modalSubtitle}>Multi-floor Navigation Guide</Text>
          </View>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={onClose}
          >
            <Ionicons name="close" size={28} color="#6C757D" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.instructionsList}>
          <View style={styles.instructionItem}>
            <View style={styles.instructionIcon}>
              <Ionicons name="qr-code" size={24} color="#4A6FA5" />
            </View>
            <View style={styles.instructionContent}>
              <Text style={styles.instructionTitle}>1. Scan QR Code</Text>
              <Text style={styles.instructionText}>
                Find and scan QR codes placed throughout the mall to set your current location and floor.
              </Text>
            </View>
          </View>

          <View style={styles.instructionItem}>
            <View style={styles.instructionIcon}>
              <Ionicons name="layers" size={24} color="#2A9D8F" />
            </View>
            <View style={styles.instructionContent}>
              <Text style={styles.instructionTitle}>2. Multi-floor Navigation</Text>
              <Text style={styles.instructionText}>
                The app automatically detects floor changes. If your destination is on another floor, it will guide you to the nearest stairs.
              </Text>
            </View>
          </View>

          <View style={styles.instructionItem}>
            <View style={styles.instructionIcon}>
              <Ionicons name="navigate" size={24} color="#E76F51" />
            </View>
            <View style={styles.instructionContent}>
              <Text style={styles.instructionTitle}>3. Choose Destination</Text>
              <Text style={styles.instructionText}>
                Select where you want to go from the destinations list or tap on the map. The app shows which floor each destination is on.
              </Text>
            </View>
          </View>

          <View style={styles.instructionItem}>
            <View style={styles.instructionIcon}>
              <Ionicons name="business" size={24} color="#9D4EDD" />
            </View>
            <View style={styles.instructionContent}>
              <Text style={styles.instructionTitle}>4. Change Floors</Text>
              <Text style={styles.instructionText}>
                Use the floor selector to switch between floors. Scan a QR code on the new floor to continue navigation.
              </Text>
            </View>
          </View>

          {/* <View style={styles.instructionItem}>
            <View style={styles.instructionIcon}>
              <MaterialIcons name="accessible" size={24} color="#FF9800" />
            </View>
            <View style={styles.instructionContent}>
              <Text style={styles.instructionTitle}>5. Accessible Routes</Text>
              <Text style={styles.instructionText}>
                Toggle the accessibility icon to show only wheelchair-accessible routes across all floors.
              </Text>
            </View>
          </View> */}
        </ScrollView>

        <TouchableOpacity
          style={styles.gotItButton}
          onPress={onClose}
        >
          <Text style={styles.gotItButtonText}>Got It!</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContent: {
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4A6FA5",
    marginTop: 20,
  },
  loadingSubtext: {
    fontSize: 14,
    color: "#6C757D",
    marginTop: 8,
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingTop: Platform.OS === "ios" ? 0 : 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },




  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#6C757D",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  floorButton: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: "#E8F4FF",
  },
  floorText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A6FA5",
  },
  accessibilityButton: {
    backgroundColor: "#E8F5E9",
  },
  infoButton: {
    backgroundColor: "#E8F4FF",
  },
  content: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    margin: 20,
    borderRadius: 20,
    padding: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  locationIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  currentLocationText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  floorBadge: {
    backgroundColor: "#E8F4FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  floorBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4A6FA5",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
  },
  resetText: {
    fontSize: 14,
    color: "#6C757D",
  },
  navigationInfo: {
    marginTop: 10,
  },
  destinationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  destinationInfo: {
    flex: 1,
  },
  destinationText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  destinationFloor: {
    fontSize: 14,
    color: "#6C757D",
    marginTop: 2,
  },
  clearBtn: {
    padding: 4,
  },
  floorChangeAlert: {
    flexDirection: "row",
    backgroundColor: "#FFF3E0",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  floorChangeMessage: {
    flex: 1,
  },
  floorChangeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF9800",
    marginBottom: 4,
  },
  floorChangeText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  goToFloorButton: {
    backgroundColor: "#4A6FA5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  goToFloorText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
  },
  statBox: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#4A6FA5",
  },
  statLabel: {
    fontSize: 12,
    color: "#6C757D",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pathContainer: {
    marginTop: 10,
  },
  pathStep: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  pathArrow: {
    marginHorizontal: 4,
  },
  pathDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  pathStepText: {
    fontSize: 14,
    color: "#495057",
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  chooseDestinationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#4A6FA5",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 10,
  },
  chooseDestinationText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  welcomeContent: {
    alignItems: "center",
    paddingVertical: 10,
  },
  welcomeIcon: {
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
  },
  welcomeDescription: {
    fontSize: 15,
    color: "#6C757D",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  scanStartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#4A6FA5",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
  },
  scanStartText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  mapContainer: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  mapHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  mapTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  mapTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  floorSelectorButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  floorSelectorText: {
    fontSize: 14,
    color: "#4A6FA5",
    fontWeight: "600",
  },
  mapSubtitle: {
    fontSize: 14,
    color: "#6C757D",
  },
  mapWrapper: {
    height: 500,
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    overflow: "hidden",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  quickActions: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 20,
    padding: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  actionButton: {
    alignItems: "center",
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionText: {
    fontSize: 12,
    color: "#495057",
    fontWeight: "500",
  },
  disabledText: {
    color: "#CCCCCC",
  },
  floatingButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#4A6FA5",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: height * 0.85,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6C757D",
    marginTop: 4,
  },
  modalCloseBtn: {
    padding: 4,
  },
  // Search styles
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1A1A1A",
    paddingVertical: 8,
  },
  clearSearchButton: {
    padding: 4,
  },
  destinationsList: {
    padding: 20,
  },
  categorySection: {
    marginBottom: 30,
  },
  searchResultsSection: {
    marginBottom: 30,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    flex: 1,
  },
  categoryCount: {
    fontSize: 14,
    color: "#6C757D",
  },
  destinationsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  destinationCard: {
    width: (width - 64) / 3,
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    position: "relative",
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedDestinationCard: {
    borderColor: "#4A6FA5",
    backgroundColor: "#E8F4FF",
  },
  destinationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  destinationName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 4,
  },
  destinationType: {
    fontSize: 11,
    color: "#6C757D",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectedBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4A6FA5",
    justifyContent: "center",
    alignItems: "center",
  },
  // No results styles
  noResultsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  noResultsTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#4A6FA5",
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    maxWidth: "80%",
  },
  // Floor list styles
  floorList: {
    padding: 20,
  },
  floorItem: {
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedFloorItem: {
    borderColor: "#4A6FA5",
    backgroundColor: "#E8F4FF",
  },
  floorItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  floorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  floorInfo: {
    flex: 1,
  },
  floorNumber: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  selectedFloorNumber: {
    color: "#4A6FA5",
  },
  floorDescription: {
    fontSize: 14,
    color: "#6C757D",
    lineHeight: 20,
  },
  currentFloorBadge: {
    backgroundColor: "#2A9D8F",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentFloorBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  instructionsList: {
    padding: 20,
  },
  instructionItem: {
    flexDirection: "row",
    marginBottom: 24,
  },
  instructionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  instructionContent: {
    flex: 1,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 14,
    color: "#6C757D",
    lineHeight: 20,
  },
  gotItButton: {
    backgroundColor: "#4A6FA5",
    margin: 20,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  gotItButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});