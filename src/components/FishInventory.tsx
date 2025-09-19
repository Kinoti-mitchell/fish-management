import { memo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { FishCard } from "./ui/fish-card";
import { Search, Filter, Fish, Edit, Trash2, MapPin, Calendar } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { NavigationSection } from "../types";
import { getStatusBadge, formatDate } from "../utils/helpers";

interface FishInventoryProps {
  onNavigate: (section: NavigationSection, fishId?: string) => void;
  fishDataHook: ReturnType<typeof import("../hooks/useFishData").useFishData>;
}

// Filters Card
const FiltersCard = memo(
  ({
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    speciesFilter,
    setSpeciesFilter,
    uniqueSpecies,
    viewMode,
    setViewMode,
  }: {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    statusFilter: string;
    setStatusFilter: (value: string) => void;
    speciesFilter: string;
    setSpeciesFilter: (value: string) => void;
    uniqueSpecies: string[];
    viewMode: "table" | "cards";
    setViewMode: (mode: "table" | "cards") => void;
  }) => (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="w-4 h-4" />
          Filters & Search
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, species, or zone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Health Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="fresh">Fresh</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>

            <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Species" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Species</SelectItem>
                {uniqueSpecies.map((species) => (
                  <SelectItem key={species} value={species}>
                    {species}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                variant={viewMode === "cards" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("cards")}
                className="flex-1"
              >
                Cards
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="flex-1"
              >
                Table
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
);

FiltersCard.displayName = "FiltersCard";

// Results Summary
const ResultsSummary = memo(
  ({
    filteredCount,
    totalCount,
    healthCounts,
  }: {
    filteredCount: number;
    totalCount: number;
    healthCounts: { fresh: number; processed: number; sold: number };
  }) => (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Showing {filteredCount} of {totalCount} fish
      </span>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span>Fresh: {healthCounts.fresh}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span>Processed: {healthCounts.processed}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
          <span>Sold: {healthCounts.sold}</span>
        </div>
      </div>
    </div>
  )
);

ResultsSummary.displayName = "ResultsSummary";

// Main Inventory Component
export const FishInventory = memo(({ onNavigate, fishDataHook }: FishInventoryProps) => {
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");

  const {
    filteredFish,
    healthStatusCounts,
    uniqueSpecies,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    speciesFilter,
    setSpeciesFilter,
    fishData,
    deleteFish,
  } = fishDataHook;

  const handleEdit = (fishId: string) => {
    onNavigate("edit", fishId);
  };

  const handleDelete = (fishId: string) => {
    if (window.confirm("Are you sure you want to delete this fish?")) {
      deleteFish(fishId);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Fish Inventory</h1>
          <p className="text-muted-foreground">Manage your fish collection in Lake Victoria</p>
        </div>
        <Button
          onClick={() => onNavigate("add")}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Fish className="w-4 h-4" />
          Add Fish
        </Button>
      </div>

      <FiltersCard
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        speciesFilter={speciesFilter}
        setSpeciesFilter={setSpeciesFilter}
        uniqueSpecies={uniqueSpecies}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <ResultsSummary
        filteredCount={filteredFish.length}
        totalCount={fishData.length}
        healthCounts={healthStatusCounts}
      />

      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFish.map((fish) => (
            <FishCard
              key={fish.id}
              fish={fish}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Species</TableHead>
                    <TableHead className="hidden md:table-cell">Age</TableHead>
                    <TableHead className="hidden md:table-cell">Weight</TableHead>
                    <TableHead className="hidden lg:table-cell">Length</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Last Checked</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFish.map((fish) => (
                    <TableRow key={fish.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{fish.name}</div>
                          <div className="text-xs text-muted-foreground sm:hidden">{fish.species}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{fish.species}</TableCell>
                      <TableCell className="hidden md:table-cell">{fish.age}y</TableCell>
                      <TableCell className="hidden md:table-cell">{fish.weight}kg</TableCell>
                      <TableCell className="hidden lg:table-cell">{fish.length}cm</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{fish.location}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(fish.status)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{formatDate(fish.lastChecked)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(fish.id)}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDelete(fish.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredFish.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Fish className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium text-lg mb-2">No fish found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search criteria or add new fish to your inventory.
            </p>
            <Button onClick={() => onNavigate("add")} className="gap-2">
              <Fish className="w-4 h-4" />
              Add Your First Fish
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
});

FishInventory.displayName = "FishInventory";
export default FishInventory;
