// src/hooks/useFishData.ts
import { useState, useEffect, useMemo } from "react";
import { Fish } from "../types";
import { supabase } from "../lib/supabaseClient";
import { filterFish, getHealthStatusCounts, getUniqueSpecies } from "../utils/helpers";

export const useFishData = () => {
  const [fishData, setFishData] = useState<Fish[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [speciesFilter, setSpeciesFilter] = useState("all");

  // Fetch fish from Supabase
  const fetchFish = async () => {
    try {
      const { data, error } = await supabase
        .from("fish_inventory")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFishData(data || []);
    } catch (err: any) {
      console.error("Error fetching fish:", err.message);
    }
  };

  useEffect(() => {
    fetchFish();
  }, []);

  const filteredFish = useMemo(
    () => filterFish(fishData, searchTerm, statusFilter, speciesFilter),
    [fishData, searchTerm, statusFilter, speciesFilter]
  );

  const healthStatusCounts = useMemo(
    () => getHealthStatusCounts(filteredFish),
    [filteredFish]
  );

  const uniqueSpecies = useMemo(() => getUniqueSpecies(fishData), [fishData]);

  const addFish = async (fish: Omit<Fish, "id">) => {
    try {
      const { data, error } = await supabase.from("fish_inventory").insert([fish]);
      if (error) throw error;
      setFishData((prev) => [...prev, data[0]]);
    } catch (err: any) {
      console.error("Error adding fish:", err.message);
    }
  };

  const updateFish = async (id: string, updates: Partial<Fish>) => {
    try {
      const { data, error } = await supabase.from("fish_inventory").update(updates).eq("id", id);
      if (error) throw error;
      setFishData((prev) => prev.map((f) => (f.id === id ? data[0] : f)));
    } catch (err: any) {
      console.error("Error updating fish:", err.message);
    }
  };

  const deleteFish = async (id: string) => {
    try {
      const { error } = await supabase.from("fish_inventory").delete().eq("id", id);
      if (error) throw error;
      setFishData((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      console.error("Error deleting fish:", err.message);
    }
  };

  const getFishById = (id: string) => fishData.find((f) => f.id === id);

  return {
    fishData,
    filteredFish,
    healthStatusCounts,
    uniqueSpecies,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    speciesFilter,
    setSpeciesFilter,
    addFish,
    updateFish,
    deleteFish,
    getFishById,
  };
};
