// components/NodeList.tsx
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Node } from "../utils/dijkstra";

interface NodeListProps {
  nodes: Node[];
  onSelect: (node: Node) => void;
  selectedNodeId?: string;
}

export const NodeList: React.FC<NodeListProps> = ({
  nodes,
  onSelect,
  selectedNodeId,
}) => {
  const groupNodesByType = () => {
    const grouped: Record<string, Node[]> = {};

    nodes.forEach((node) => {
      if (!grouped[node.type]) {
        grouped[node.type] = [];
      }
      grouped[node.type].push(node);
    });

    return grouped;
  };

  const groupedNodes = groupNodesByType();

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      shop: "Shops",
      café: "Cafe",
      restaurant: "Restaurants",
      entrance: "Entrance/Exit",
      stair: "Stairs",
      junction: "Junctions",
      exit: "Exits",
    };

    return labels[type] || type;
  };

  return (
    <ScrollView style={styles.container}>
      {Object.entries(groupedNodes).map(([type, typeNodes]) => (
        <View key={type} style={styles.section}>
          <Text style={styles.sectionTitle}>{getTypeLabel(type)}</Text>
          {typeNodes.map((node) => (
            <TouchableOpacity
              key={node.node_id}
              style={[
                styles.nodeItem,
                selectedNodeId === node.node_id && styles.selectedNodeItem,
              ]}
              onPress={() => onSelect(node)}
            >
              <View
                style={[
                  styles.nodeColor,
                  { backgroundColor: getNodeColor(node.type) },
                ]}
              />
              <View style={styles.nodeInfo}>
                <Text style={styles.nodeLabel}>{node.label}</Text>
                <Text style={styles.nodeType}>{node.type.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </ScrollView>
  );
};

const getNodeColor = (type: string): string => {
  switch (type) {
    case "entrance":
      return "#4CAF50";
    case "exit":
      return "#F44336";
    case "shop":
      return "#2196F3";
    case "cafe":
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  section: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    paddingTop: 8,
  },
  nodeItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedNodeItem: {
    backgroundColor: "#E3F2FD",
    borderWidth: 2,
    borderColor: "#2196F3",
  },
  nodeColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  nodeInfo: {
    flex: 1,
  },
  nodeLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  nodeType: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
});
