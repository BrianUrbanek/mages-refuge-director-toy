import type {
  EncounterConfig,
  Portal,
  Group,
  SelectionState,
} from "./encounter-manager";
export declare function validateSelection(config: EncounterConfig): void;
export declare class EncounterList {
  constructor(seed?: number);
  select(
    config: EncounterConfig,
    portals: Portal[],
    ordinal?: number,
    totalBudget?: number,
  ): {
    group?: Omit<Group, "id">;
    error?: string;
    events: Array<{ type: string; [key: string]: unknown }>;
  };
  snapshot(): SelectionState;
}
