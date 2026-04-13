import { useQuery } from "@tanstack/react-query";

interface NHTSAMake {
  Make_ID: number;
  Make_Name: string;
}

interface NHTSAModel {
  Model_ID: number;
  Model_Name: string;
}

const NHTSA_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";

export function useVehicleMakes() {
  return useQuery({
    queryKey: ["nhtsa-makes"],
    queryFn: async () => {
      const res = await fetch(`${NHTSA_BASE}/GetAllMakes?format=json`);
      const json = await res.json();
      const makes: NHTSAMake[] = json.Results ?? [];
      return makes
        .map((m) => ({
          value: m.Make_Name.toUpperCase(),
          label: m.Make_Name.toUpperCase(),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
    staleTime: 1000 * 60 * 60 * 24, // 24h cache
    gcTime: 1000 * 60 * 60 * 24,
  });
}

export function useVehicleModels(makeName: string) {
  return useQuery({
    queryKey: ["nhtsa-models", makeName],
    queryFn: async () => {
      const res = await fetch(
        `${NHTSA_BASE}/GetModelsForMake/${encodeURIComponent(makeName)}?format=json`
      );
      const json = await res.json();
      const models: NHTSAModel[] = json.Results ?? [];
      return models
        .map((m) => ({
          value: m.Model_Name.toUpperCase(),
          label: m.Model_Name.toUpperCase(),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    },
    enabled: !!makeName,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });
}
