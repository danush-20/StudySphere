import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function LocationPicker({ value, onChange, placeholder = "Search locality, area..." }) {

  const [query, setQuery] = useState(value?.display || "");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 500);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const fetchSuggestions = async (text) => {
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&countrycodes=in&format=json&limit=6&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en" }
      });
      const data = await res.json();
      setSuggestions(data);
    } catch (e) {
      console.log("Nominatim search error:", e.message);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (item) => {
    const a = item.address;
    // Priority: suburb/neighbourhood → town → city → state_district
    const local = a.suburb || a.neighbourhood || a.quarter || a.town || a.village || a.city_district;
    const city = a.city || a.state_district || a.county;
    const state = a.state;
    if (local && city) return { main: local, secondary: `${city}, ${state}` };
    if (city) return { main: city, secondary: state };
    return { main: item.display_name.split(",")[0], secondary: item.display_name.split(",").slice(1, 3).join(",") };
  };

  const handleSelect = (item) => {
    const { main, secondary } = getDisplayName(item);
    const display = secondary ? `${main}, ${secondary}` : main;
    setQuery(display);
    setFocused(false);
    setSuggestions([]);
    onChange({ city: main, display });
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setFocused(false);
    onChange({ city: "", display: "" });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.inputWrapper, focused && styles.inputWrapperFocused]}>
        <Ionicons name="location-outline" size={16} color="#aaa" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#bbb"
          value={query}
          onChangeText={(t) => { setQuery(t); setFocused(true); }}
          onFocus={() => setFocused(true)}
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color="#2e7d32" style={{ marginRight: 4 }} />}
        {query.length > 0 && !loading && (
          <TouchableOpacity onPress={handleClear}>
            <Ionicons name="close-circle" size={16} color="#ccc" />
          </TouchableOpacity>
        )}
      </View>

      {focused && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.place_id?.toString() || item.osm_id?.toString()}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            renderItem={({ item }) => {
              const { main, secondary } = getDisplayName(item);
              return (
                <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
                  <Ionicons name="location-outline" size={14} color="#888" style={{ marginRight: 8, marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemMain}>{main}</Text>
                    {secondary ? <Text style={styles.itemSecondary} numberOfLines={1}>{secondary}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {focused && query.length >= 2 && !loading && suggestions.length === 0 && (
        <View style={styles.noResults}>
          <Text style={styles.noResultsText}>No results for "{query}"</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", zIndex: 99 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#e0e0e0",
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: "#fafafa", marginTop: 10
  },
  inputWrapperFocused: { borderColor: "#2e7d32" },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: "#222" },
  dropdown: {
    position: "absolute", top: "100%", left: 0, right: 0,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0e0e0",
    borderRadius: 10, marginTop: 4,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8,
    elevation: 8, zIndex: 100
  },
  item: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 0.5, borderColor: "#f0f0f0"
  },
  itemMain: { fontSize: 14, fontWeight: "600", color: "#222" },
  itemSecondary: { fontSize: 12, color: "#888", marginTop: 1 },
  noResults: { padding: 12, alignItems: "center" },
  noResultsText: { fontSize: 13, color: "#aaa" }
});