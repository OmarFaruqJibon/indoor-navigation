import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapView } from "../components/MapView";
import { NodeList } from "../components/NodeList";
import { QRScanner } from "../components/QRScanner";
import { Edge, Graph, Node } from "../utils/dijkstra";

// Import your data
import edgesData from "../data/edges.json";
import nodesData from "../data/nodes.json";

export default function Index() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [currentLocation, setCurrentLocation] = useState<string>("entrance");
  const [destination, setDestination] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [distance, setDistance] = useState<number>(0);
  const [showScanner, setShowScanner] = useState(false);
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
    if (graph && destination) {
      const result = graph.getShortestPath(currentLocation, destination);
      if (result) {
        setPath(result.path);
        setDistance(result.distance);
      }
    }
  }, [graph, currentLocation, destination]);

  const handleNodeSelect = (node: Node) => {
    setDestination(node.node_id);
  };

  const handleQRScan = (data: string) => {
    // Assuming QR code contains node_id
    const node = graph?.getNode(data);
    if (node) {
      setCurrentLocation(data);
      Alert.alert("Location Updated", `You are now at: ${node.label}`);
    } else {
      Alert.alert("Invalid QR Code", "This QR code is not recognized.");
    }
  };

  const getCurrentNode = (): Node | undefined => {
    return graph?.getNode(currentLocation);
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
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setShowScanner(true)}
          >
            <Text style={styles.scanButtonText}>Scan QR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Current Location and Destination Info */}
      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Current:</Text>
          <Text style={styles.infoValue}>
            {getCurrentNode()?.label || "Unknown"}
          </Text>
        </View>
        {destination && (
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
              <Text style={styles.infoValue}>{distance.toFixed(2)} meters</Text>
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
        )}
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.mapContainer}>
          <MapView
            nodes={nodes}
            edges={edges.filter((edge) => !accessibleOnly || edge.accessible)}
            path={path}
            currentLocation={getCurrentNode()}
            onNodePress={handleNodeSelect}
          />
        </View>

        <View style={styles.listContainer}>
          <NodeList
            nodes={nodes.filter((node) => node.node_id !== currentLocation)}
            onSelect={handleNodeSelect}
            selectedNodeId={destination || undefined}
          />
        </View>
      </View>

      {/* QR Scanner Modal */}
      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />
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
  content: {
    flex: 1,
    flexDirection: "row",
  },
  mapContainer: {
    flex: 2,
    borderRightWidth: 1,
    borderRightColor: "#E0E0E0",
  },
  listContainer: {
    flex: 1,
    width: 300,
  },
});
