// src/components/FishForm.tsx
import { useState, useEffect } from "react";
import { supabase, handleSupabaseError } from "../lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ArrowLeft, Save, Fish, AlertCircle } from "lucide-react";
import { NavigationSection, Fish as FishType } from "../types";
import { LAKE_VICTORIA_SPECIES, ZONES, FISH_PRICES } from "../data/constants";
import { validate, validationSchemas, sanitizeData } from "../utils/validation";
import { Alert, AlertDescription } from "./ui/alert";

interface FishFormProps {
  onNavigate: (section: NavigationSection) => void;
  fishId?: string;
  mode: "add" | "edit";
  fish?: FishType;
  onSave: (fishData: Partial<FishType>) => void;
}

export function FishForm({ onNavigate, mode, fish, onSave }: FishFormProps) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    species: "",
    name: "",
    age: 0,
    weight: 0,
    length: 0,
    location: "",
    healthStatus: "healthy" as const,
    notes: "",
    source: "wild" as const,
    price: 0,
    inStock: true,
  });

  // Populate form in edit mode
  useEffect(() => {
    if (mode === "edit" && fish) {
      setFormData({
        species: fish.species,
        name: fish.name,
        age: fish.age,
        weight: fish.weight,
        length: fish.length,
        location: fish.location,
        healthStatus: fish.healthStatus,
        notes: fish.notes,
        source: fish.source,
        price: fish.price,
        inStock: fish.inStock,
      });
    }
  }, [mode, fish]);

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-update price if species changes
      if (field === "species" && typeof value === "string" && value in FISH_PRICES) {
        updated.price = FISH_PRICES[value as keyof typeof FISH_PRICES];
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const fishData = {
      ...formData,
      lastChecked: new Date().toISOString().split("T")[0],
      catchDate: mode === "add" ? new Date().toISOString().split("T")[0] : fish?.catchDate,
    };

    try {
      if (mode === "add") {
        const { error } = await supabase.from("fish_inventory").insert([fishData]);
        if (error) throw error;
      } else if (mode === "edit" && fish?.id) {
        const { error } = await supabase.from("fish_inventory").update(fishData).eq("id", fish.id);
        if (error) throw error;
      }

      onSave(fishData);
      onNavigate("inventory");
    } catch (error: any) {
      console.error("Error saving fish:", error.message);
      alert("Failed to save fish entry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => onNavigate("inventory")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            {mode === "add" ? "Add New Fish" : "Edit Fish"}
          </h1>
          <p className="text-muted-foreground">
            {mode === "add" ? "Enter fish details for Lake Victoria inventory" : "Update fish information"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fish className="w-5 h-5" />
            Fish Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Species */}
            <div className="space-y-2">
              <Label htmlFor="species">Species *</Label>
              <Select value={formData.species} onValueChange={(value) => handleInputChange("species", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Lake Victoria species" />
                </SelectTrigger>
                <SelectContent>
                  {LAKE_VICTORIA_SPECIES.map((species) => (
                    <SelectItem key={species} value={species}>
                      {species}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Fish ID/Name *</Label>
              <Input
                id="name"
                placeholder="e.g., TIL-001"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>

            {/* Zone */}
            <div className="space-y-2">
              <Label htmlFor="location">Zone/Location *</Label>
              <Select value={formData.location} onValueChange={(value) => handleInputChange("location", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select fishing zone" />
                </SelectTrigger>
                <SelectContent>
                  {ZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Weight */}
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => handleInputChange("weight", parseFloat(e.target.value) || 0)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes & Observations</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t">
              <Button type="submit" className="gap-2 bg-blue-600 hover:bg-blue-700" disabled={loading}>
                <Save className="w-4 h-4" />
                {loading ? "Saving..." : mode === "add" ? "Add Fish to Inventory" : "Update Fish Record"}
              </Button>
              <Button type="button" variant="outline" onClick={() => onNavigate("inventory")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default FishForm;
