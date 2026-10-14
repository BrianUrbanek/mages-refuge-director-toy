export interface EncounterCard {
  id: string;
  kind: "normal" | "breach" | "standalone" | "reshuffle";
  targetMultiplier?: number;
  target?: number;
  preferredTags?: string[];
  groupTags?: string[];
  portalTags?: string[];
  groupTagPolicy?: "enforce" | "prefer" | "ignore";
  portalTagPolicy?: "enforce" | "prefer" | "ignore";
}
export interface EncounterSelection {
  id: string;
  mode: "ordered" | "random";
  cards: EncounterCard[];
  minTarget?: number;
  maxTarget?: number;
}
export interface AuthoredGroup {
  id: string;
  standalone: boolean;
  tags: string[];
  members: string[];
  portalPreferences?: string[];
}
export interface SelectionState {
  listId?: string;
  mode?: "ordered" | "random";
  remaining: string[];
  excluded: string[];
  cycle: number;
  randomState: number;
}
export interface EnemyVariant {
  id: string;
  name: string;
  cost: number;
  tags: string[];
  tier: "normal" | "elite" | "champion";
  footprint: number;
}
export interface EncounterConfig {
  selection?: EncounterSelection;
  groups?: AuthoredGroup[];
  id: string;
  menu: string;
  enemies: EnemyVariant[];
  cores: string[][];
  required: string[];
  preferred: string[];
  local?: [string, number][];
  portalPreferences?: string[];
  corePortalPreferences?: Record<number, string[]>;
  targets: number[];
  finalTarget?: number;
  flowRate: number;
  rules: {
    maxMembers: number;
    maxChampions: number;
    maxAverageCost: number;
    incompatiblePairs?: [string, string][];
  };
}
export interface DirectorRuntimeOptions {
  engineRecoverySeconds?: number;
  warningLeadSeconds?: number;
}
export interface Group {
  standalone?: boolean;
  groupId?: string;
  groupTags?: string[];
  portalId?: string;
  requiredPortalTags?: string[];
  intent?: "breach" | "standalone";
  telegraph?: boolean;
  selection?: {
    listId: string;
    cardId: string;
    kind: EncounterCard["kind"];
    mode: EncounterSelection["mode"];
    cycle: number;
    fallback?: boolean;
  };
  id: number;
  configId: string;
  menu: string;
  target: number;
  cost: number;
  members: EnemyVariant[];
  core: number;
  trace: string[];
  finalSpend: boolean;
  portalPreferences: string[];
}
export interface Portal {
  id: string;
  tags: string[];
  eligible: boolean;
  breachable?: boolean;
}
export interface SpawnAdapter {
  assetsReady(group: Group): boolean;
  canEnter(group: Group, entrance: string): boolean;
  /** Commit all members atomically, hidden until spawn-committed is consumed. Failure must clean up uncommitted actors. */
  commitSpawn(
    group: Group,
    entrance: string,
  ):
    | { success: false }
    | { success: true; actorIds: (string | number)[]; portals?: Portal[] };
}
export interface EncounterSnapshot {
  selection: SelectionState | null;
  time: number;
  potential: number;
  available: number;
  introduced: number;
  spent: number;
  next: Group | null;
  dispatch: {
    planId: number;
    entrance: string;
    origin: string;
    until: number;
  } | null;
  pending: boolean;
  lastSpawn: number;
  fundingEta: number | null;
  recoveryRemaining: number;
  portals: Portal[];
  finalSpend: boolean;
  finalComplete: boolean;
  ended: boolean;
  wait: string;
  waitReason:
    | "ready"
    | "funding"
    | "unfundable"
    | "forecast"
    | "assets"
    | "engine-recovery"
    | "portal-capacity"
    | "spawn-failure"
    | "stopped"
    | "composition-error";
  fuelSources: Array<{ source: string; remaining: number }>;
  runtime: Required<DirectorRuntimeOptions>;
  error: string | null;
  livingOpposition: number;
}
export declare function composeGroup(
  config: EncounterConfig,
  ordinal?: number,
  finalBudget?: number | null,
): Omit<Group, "id"> | { error: string } | null;
export declare class EncounterManager {
  constructor(args: {
    config: EncounterConfig;
    runtime?: DirectorRuntimeOptions;
    selectionSeed?: number;
  });
  updatePortals(portals: Portal[]): void;
  selectPortal(group: Group, adapter: SpawnAdapter): string | null;
  cancelDispatch(reason: string): void;
  addPotential(amount: number, source: string): void;
  transfer(amount: number, source?: string | null, reason?: string): number;
  isEventApplied(id: string): boolean;
  sourcePotential(source: string): number;
  updateConfig(config: EncounterConfig): void;
  applyOnce(
    id: string,
    operations?: { add?: number; transfer?: number; trigger?: boolean },
  ): boolean;
  requestSpawn(): void;
  invalidate(): void;
  beginFinalSpend(reason: string): boolean;
  notifyDefeat(actorId: string | number): void;
  fundingEta(): number | null;
  recoveryRemaining(): number;
  tick(dt: number, adapter: SpawnAdapter): void;
  snapshot(): EncounterSnapshot;
  drainEvents(): Array<{
    id: number;
    time: number;
    type: string;
    [key: string]: unknown;
  }>;
  verify(): number;
  end(): void;
}
