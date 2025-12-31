import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapView } from "../components/MapView";
import { QRScanner } from "../components/QRScanner";
import { Edge, Graph, Node } from "../utils/dijkstra";

// Import your data
import edgesData from "../data/edges.json";
import nodesData from "../data/nodes.json";

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
  const [accessibleOnly, setAccessibleOnly] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize graph with data
    const initGraph = () => {
      try {
        setNodes(nodesData as Node[]);
        setEdges(edgesData as Edge[]);
        const newGraph = new Graph(
          nodesData as Node[],
          edgesData as Edge[],
          accessibleOnly
        );
        setGraph(newGraph);
        setLoading(false);
      } catch (error) {
        console.error("Error initializing graph:", error);
        setLoading(false);
      }
    };

    initGraph();
  }, [accessibleOnly]);

  useEffect(() => {
    // Recalculate path when destination or current location changes
    if (graph && currentLocation && destination) {
      const result = graph.getShortestPath(currentLocation, destination);
      if (result) {
        setPath(result.path);
        setDistance(result.distance);
      } else {
        Alert.alert(
          "No Path Found",
          "There is no accessible path to this destination."
        );
        setPath([]);
        setDistance(0);
      }
    }
  }, [graph, currentLocation, destination]);

  const handleQRScan = (data: string) => {
    // Parse QR code data
    let nodeId = data.trim();

    // Check if it's in JSON format
    if (nodeId.startsWith("{")) {
      try {
        const parsed = JSON.parse(nodeId);
        nodeId = parsed.node_id || nodeId;
      } catch (e) {
        console.log("QR data is not JSON, using as-is");
      }
    }

    // Check if it has "node:" prefix
    if (nodeId.startsWith("node:")) {
      nodeId = nodeId.substring(5);
    }

    const node = graph?.getNode(nodeId);
    if (node) {
      setCurrentLocation(nodeId);
      Alert.alert("Location Set", `You are at: ${node.label}`, [
        {
          text: "OK",
          onPress: () => setShowDestinations(true),
        },
      ]);
      setShowScanner(false);
    } else {
      Alert.alert("Invalid QR Code", `Node "${nodeId}" not found in the map.`);
    }
  };

  const handleDestinationSelect = (node: Node) => {
    setDestination(node.node_id);
    setShowDestinations(false);
  };

  const getCurrentNode = (): Node | undefined => {
    return currentLocation ? graph?.getNode(currentLocation) : undefined;
  };

  const getDestinationNode = (): Node | undefined => {
    return destination ? graph?.getNode(destination) : undefined;
  };

  const toggleAccessibleOnly = () => {
    setAccessibleOnly(!accessibleOnly);
    setLoading(true);
    // Graph will be recreated in useEffect
  };

  const clearDestination = () => {
    setDestination(null);
    setPath([]);
    setDistance(0);
  };

  const resetNavigation = () => {
    setCurrentLocation(null);
    setDestination(null);
    setPath([]);
    setDistance(0);
    setShowDestinations(false);
  };

  // Filter out current location from destinations
  const getDestinationNodes = (): Node[] => {
    if (!currentLocation) return [];
    return nodes.filter((node) => node.node_id !== currentLocation);
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

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      shop: "Shops",
      café: "Café",
      restaurant: "Restaurants",
      entrance: "Entrance/Exit",
      stair: "Stairs",
      junction: "Junctions",
      exit: "Exits",
    };

    return labels[type] || type;
  };

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Indoor Navigation</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[
              styles.accessibilityButton,
              accessibleOnly && styles.accessibilityButtonActive,
            ]}
            onPress={toggleAccessibleOnly}
          >
            <Text style={styles.accessibilityButtonText}>
              ♿ {accessibleOnly ? "Accessible" : "All Routes"}
            </Text>
          </TouchableOpacity>

          {currentLocation && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetNavigation}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setShowScanner(true)}
          >
            <Text style={styles.scanButtonText}>Scan QR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Current Location and Destination Info */}
      {currentLocation ? (
        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Current:</Text>
            <Text style={styles.infoValue}>
              {getCurrentNode()?.label || "Unknown"}
            </Text>
          </View>

          {destination ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Destination:</Text>
                <Text style={styles.infoValue}>
                  {getDestinationNode()?.label || "Unknown"}
                </Text>
                <TouchableOpacity onPress={clearDestination}>
                  <Text style={styles.clearButton}>×</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Distance:</Text>
                <Text style={styles.infoValue}>
                  {distance.toFixed(2)} meters
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Path:</Text>
                <ScrollView horizontal style={styles.pathScroll}>
                  <Text style={styles.pathText}>
                    {path
                      .map((id) => graph?.getNode(id)?.label || id)
                      .join(" → ")}
                  </Text>
                </ScrollView>
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={styles.chooseDestinationButton}
              onPress={() => setShowDestinations(true)}
            >
              <Text style={styles.chooseDestinationButtonText}>
                Choose Destination
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Welcome to Indoor Navigation</Text>
          <Text style={styles.instructionText}>
            Scan a QR code to set your current location and start navigation
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => setShowScanner(true)}
          >
            <Text style={styles.startButtonText}>
              Start by Scanning QR Code
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map View */}
      <View style={styles.mapContainer}>
        <MapView
          nodes={nodes}
          edges={edges.filter((edge) => !accessibleOnly || edge.accessible)}
          path={path}
          currentLocation={getCurrentNode()}
          onNodePress={(node) => {
            if (currentLocation && node.node_id !== currentLocation) {
              setDestination(node.node_id);
            }
          }}
        />
      </View>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />

      {/* Destinations Modal */}
      <Modal
        visible={showDestinations}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDestinations(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Destination</Text>
              <TouchableOpacity onPress={() => setShowDestinations(false)}>
                <Text style={styles.modalClose}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.destinationsList}>
              {(() => {
                const destinationNodes = getDestinationNodes();
                const groupedNodes = groupNodesByType(destinationNodes);

                return Object.entries(groupedNodes).map(([type, typeNodes]) => (
                  <View key={type} style={styles.destinationSection}>
                    <Text style={styles.destinationSectionTitle}>
                      {getTypeLabel(type)}
                    </Text>
                    {typeNodes.map((node) => (
                      <TouchableOpacity
                        key={node.node_id}
                        style={[
                          styles.destinationItem,
                          destination === node.node_id &&
                            styles.selectedDestinationItem,
                        ]}
                        onPress={() => handleDestinationSelect(node)}
                      >
                        <View
                          style={[
                            styles.destinationColor,
                            { backgroundColor: getNodeColor(node.type) },
                          ]}
                        />
                        <View style={styles.destinationInfo}>
                          <Text style={styles.destinationLabel}>
                            {node.label}
                          </Text>
                          <Text style={styles.destinationType}>
                            {node.type.toUpperCase()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ));
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },
  scanButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scanButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  resetButton: {
    backgroundColor: "#FF9800",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  resetButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  accessibilityButton: {
    backgroundColor: "#E0E0E0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  accessibilityButtonActive: {
    backgroundColor: "#4CAF50",
  },
  accessibilityButtonText: {
    color: "#333",
    fontWeight: "600",
  },
  infoContainer: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  clearButton: {
    fontSize: 20,
    color: "#F44336",
    marginLeft: 8,
    paddingHorizontal: 8,
  },
  pathScroll: {
    flex: 1,
    maxHeight: 40,
  },
  pathText: {
    fontSize: 12,
    color: "#666",
  },
  welcomeContainer: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  instructionText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    width: "80%",
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  chooseDestinationButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
    alignSelf: "center",
  },
  chooseDestinationButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  mapContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  modalClose: {
    fontSize: 30,
    color: "#666",
    paddingHorizontal: 10,
  },
  destinationsList: {
    padding: 20,
  },
  destinationSection: {
    marginBottom: 24,
  },
  destinationSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  destinationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedDestinationItem: {
    backgroundColor: "#E3F2FD",
    borderWidth: 2,
    borderColor: "#2196F3",
  },
  destinationColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  destinationInfo: {
    flex: 1,
  },
  destinationLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  destinationType: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
});
