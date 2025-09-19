import { Fish } from "../types";
import { Badge } from "../components/ui/badge";

// ✅ SAFE: Handles undefined or unknown status values
export const getStatusBadge = (status: Fish["status"]) => {
  const statusConfig = {
    fresh: {
      className: "bg-green-500 text-white",
      label: "Fresh",
    },
    processed: {
      className: "bg-blue-500 text-white",
      label: "Processed",
    },
    sold: {
      className: "bg-gray-500 text-white",
      label: "Sold",
    },
  };

  const config = statusConfig[status];

  if (!config) {
    console.warn(`⚠️ Unknown status: ${status}`);
    return (
      <Badge className="bg-gray-300 text-black">Unknown</Badge>
    );
  }

  return (
    <Badge className={config.className}>{config.label}</Badge>
  );
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const filterFish = (
  fish: Fish[],
  searchTerm: string,
  statusFilter: string,
  speciesFilter: string,
): Fish[] => {
  return fish.filter((item) => {
    const matchesSearch =
      item.species
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      item.location
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      item.size
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    const matchesSpecies =
      speciesFilter === "all" || item.species === speciesFilter;

    return matchesSearch && matchesStatus && matchesSpecies;
  });
};

export const getHealthStatusCounts = (fish: Fish[]) => {
  return {
    fresh: fish.filter((f) => f.status === "fresh").length,
    processed: fish.filter((f) => f.status === "processed")
      .length,
    sold: fish.filter((f) => f.status === "sold").length,
    total: fish.length,
  };
};

export const getUniqueSpecies = (fish: Fish[]): string[] => {
  return [...new Set(fish.map((item) => item.species))];
};

export const calculateStats = (fish: Fish[]) => {
  const totalWeight = fish.reduce(
    (sum, item) => sum + item.weight,
    0,
  );
  const avgWeight =
    fish.length > 0 ? totalWeight / fish.length : 0;

  return {
    totalFish: fish.length,
    totalWeight: totalWeight.toFixed(1),
    avgWeight: avgWeight.toFixed(1),
    species: getUniqueSpecies(fish).length,
    freshCount: fish.filter((f) => f.status === "fresh").length,
    processedCount: fish.filter((f) => f.status === "processed")
      .length,
    soldCount: fish.filter((f) => f.status === "sold").length,
  };
};

export const getFishGradeColor = (grade?: "A" | "B" | "C") => {
  if (!grade) return "bg-gray-500";

  const gradeColors = {
    A: "bg-green-500",
    B: "bg-yellow-500",
    C: "bg-orange-500",
  };

  return gradeColors[grade];
};

export const formatWeight = (weight: number): string => {
  return `${weight.toFixed(1)} kg`;
};

export const getDaysFromDate = (dateString: string): number => {
  const date = new Date(dateString);
  const today = new Date();
  const diffTime = today.getTime() - date.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

export const getFreshnessBadge = (caughtDate: string) => {
  const days = getDaysFromDate(caughtDate);

  if (days <= 1) {
    return (
      <Badge className="bg-green-500 text-white">
        Very Fresh
      </Badge>
    );
  } else if (days <= 3) {
    return (
      <Badge className="bg-yellow-500 text-white">Fresh</Badge>
    );
  } else if (days <= 7) {
    return (
      <Badge className="bg-orange-500 text-white">Good</Badge>
    );
  } else {
    return (
      <Badge className="bg-red-500 text-white">
        Check Quality
      </Badge>
    );
  }
};