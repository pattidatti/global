export type GameStatus = 'active' | 'frozen' | 'ended';

export type Biome = 'plains' | 'coast' | 'mountain' | 'desert' | 'arctic' | 'regnskog' | 'other';

export type ResourceType = 'food' | 'oil' | 'metal' | 'trade' | 'military' | 'influence';

export type BuildingType = 'farm' | 'mine' | 'oilrig' | 'harbor' | 'barracks' | 'cityExpand';

export interface BuildingDef {
  cost: number;
  buildTimeMin: number;
  output: Partial<Record<ResourceType, number>>;
  biomeMul: Partial<Record<Biome | 'others', number>>;
  requires?: 'coast' | 'city';
  unlocks?: 'seaAdjacency';
}

export interface BuildQueueItem {
  buildingId: string;
  type: BuildingType;
  startedAt: number;
  completesAt: number;
}

export interface Building {
  type: BuildingType;
  builtAt: number;
  pendingHarvest: Partial<Record<ResourceType, number>>;
  lastHarvestedAt: number | null;
  maxStorage: number;
}

export interface Region {
  ownerId: string | null;
  integration: number;
  integrationStartedAt: number | null;
  biome: Biome;
  resources: Partial<Record<ResourceType, number>>;
  buildQueue: BuildQueueItem[];
  buildings: Record<string, Building>;
  maxSlots: number;
  lastTickAt: number;
  satisfaction: number;
  population: number;
  defense: number;
  nationId?: string | null;
  contestedAt?: number | null;
  // Statiske geo-metadata (settes ved seed, leses av formNation/markets/etc.)
  countryCode?: string;
  culturalGroup?: string;
  strategicValue?: number;
  /** Trade-bond per slot — bygges opp av investInRegion. Brukt i attractiveness. */
  tradeBond?: Record<string, number>;
  /** Streak-teller for NPC-defection — antall makro-tikker spiller leder. */
  defectionStreak?: Record<string, number>;
}

export interface ExpandRegionArgs {
  gameId: string;
  targetRegionId: string;
}

export interface BuildBuildingArgs {
  gameId: string;
  regionId: string;
  buildingType: BuildingType;
}

export interface CancelBuildArgs {
  gameId: string;
  regionId: string;
  buildingId: string;
}

export interface HarvestBuildingArgs {
  gameId: string;
  regionId: string;
  buildingId: string;
}

export interface GameMeta {
  teacherId: string;
  createdAt: number;
  status: GameStatus;
  unFormed: boolean;
  nationCount: number;
  schemaVersion: number;
  lastMacroTickAt: number;
}

export interface RosterSlot {
  displayName: string;
  createdAt: number;
  joinedAt: number | null;
}

export interface ServerListEntry {
  name: string;
  teacherName: string;
  teacherId: string;
  status: GameStatus;
  playerCount: number;
  createdAt: number;
}

export interface Player {
  displayName: string;
  empireColor: string;
  empireColorIdx: number;
  treasury: number;
  influence: number;
  military: number;
  regionIds: string[];
  nationId: string | null;
  joinedAt: number;
  lastSeenAt: number;
  /** Vedlikeholdskostnad trukket i siste makrotikk. UI viser dette som indikator. */
  lastMaintenanceCost?: number;
}

// ===========================================================================
// Fase 2-typer: Nasjon, marked, diplomati, allianse, krig, chat
// ===========================================================================

export type NationType = 'historical' | 'custom';

export interface NationBonus {
  production?: number;
  prestige?: number;
}

export interface Nation {
  founderId: string;        // slotId
  name: string;
  flag: string;             // emoji eller short tag
  type: NationType;
  cultureMatch: number;     // 0–1 (andelen regioner som deler dominantCulture)
  dominantCulture: string;  // f.eks. "nordic"
  color: string;            // hsl(...)
  bonus: NationBonus;
  members: string[];        // [slotId] — for unioner senere; alltid minst founderId
  formedAt: number;
  /** Forbund-medlemskap. En nasjon kan være i maks ett forbund. */
  leagueId?: string | null;
}

// ===========================================================================
// Forbund (defense pact mellom nasjoner)
// ===========================================================================

export interface LeaguePendingInvite {
  invitedAt: number;
  invitedBy: string; // slotId (forbundets grunnlegger)
}

export interface League {
  name: string;
  founderNationId: string;
  memberNationIds: string[];
  charter: 'defense_pact';
  formedAt: number;
  pendingInvites?: Record<string, LeaguePendingInvite>;
}

export interface CreateLeagueArgs {
  gameId: string;
  name: string;
}

export interface InviteNationToLeagueArgs {
  gameId: string;
  leagueId: string;
  targetNationId: string;
}

export interface AcceptLeagueInviteArgs {
  gameId: string;
  leagueId: string;
  nationId: string;
}

export interface LeaveLeagueArgs {
  gameId: string;
  leagueId: string;
  nationId: string;
}

export interface DissolveLeagueArgs {
  gameId: string;
  leagueId: string;
}

// ===========================================================================
// FN-møte (lærer-definert agenda)
// ===========================================================================

export type UnMeetingStatus = 'open' | 'closed';

export interface UnMeeting {
  agenda: string;
  options: string[];        // 2–4 alternativer
  startedAt: number;
  startedBy: string;        // teacher uid
  status: UnMeetingStatus;
  closedAt?: number;
  votes?: Record<string, number>; // nationId → optionIndex
}

export interface StartUnMeetingArgs {
  gameId: string;
  agenda: string;
  options: string[];
}

export interface CastUnVoteArgs {
  gameId: string;
  meetingId: string;
  optionIndex: number;
}

export interface CloseUnMeetingArgs {
  gameId: string;
  meetingId: string;
}

export type TradeSide = 'buy' | 'sell';
export type TradeStatus = 'open' | 'filled' | 'cancelled' | 'partial';

export interface TradeOrder {
  ownerId: string;          // slotId
  resource: ResourceType;
  side: TradeSide;
  quantity: number;         // gjenværende usolgt mengde
  originalQuantity: number; // for partial fill-statistikk
  pricePerUnit: number;
  postedAt: number;
  status: TradeStatus;
  filledAt?: number;
  cancelledAt?: number;
}

export interface PriceHistoryEntry {
  avgPrice: number;
  volume: number;
  ts: number;
}

// Diplomati: én node per (a, b) der a < b alfabetisk på slotId
export type DiplomacyStatus = 'neutral' | 'alliance' | 'war' | 'trade' | 'pending-alliance';

export interface DiplomaticNote {
  fromSlotId: string;
  text: string;
  sentAt: number;
}

export interface Diplomacy {
  status: DiplomacyStatus;
  since: number;
  proposerId?: string | null; // for pending-alliance: hvem foreslo
  notes?: Record<string, DiplomaticNote>;
}

export interface Alliance {
  members: string[];        // [slotId, slotId]
  formedAt: number;
}

export type UnitType = 'infantry' | 'armor' | 'navy';

export interface Unit {
  ownerId: string;          // slotId
  regionId: string;         // hvor enheten står nå
  type: UnitType;
  strength: number;         // HP-lignende
  movedAt: number;
}

export type WarStatus = 'active' | 'ceasefire' | 'ended';

export interface BattleLogEntry {
  tick: number;
  regionId: string;
  attackerLoss: number;
  defenderLoss: number;
  ts: number;
}

export interface War {
  attacker: string;         // slotId
  defender: string;         // slotId
  startedAt: number;
  contestedRegionIds: string[];
  battleLog: BattleLogEntry[];
  status: WarStatus;
  endedAt: number | null;
  ceasefireProposedBy?: string | null;
}

export interface ChatMessage {
  authorSlotId: string;
  text: string;
  sentAt: number;
}

// Callable response envelope — alle callable-funksjoner returnerer dette
export type CallableResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; melding: string };

// ===========================================================================
// Argument-typer for Fase 2-callables
// ===========================================================================

export interface FormNationArgs {
  gameId: string;
  slotId: string;
  name: string;
  flag: string;
  type: NationType;
  color: string;
}

export interface DissolveNationArgs {
  gameId: string;
  nationId: string;
}

export interface ProposeTradeArgs {
  gameId: string;
  slotId: string;
  resource: ResourceType;
  side: TradeSide;
  quantity: number;
  pricePerUnit: number;
}

export interface CancelTradeArgs {
  gameId: string;
  slotId: string;
  resource: ResourceType;
  side: TradeSide;
  orderId: string;
}

export interface AcceptTradeArgs {
  gameId: string;
  slotId: string;
  resource: ResourceType;
  side: TradeSide; // siden av order-en spilleren matcher mot
  orderId: string;
  quantity: number;
}

export interface ProposeAllianceArgs {
  gameId: string;
  slotId: string;
  targetSlotId: string;
}

export interface AcceptAllianceArgs {
  gameId: string;
  slotId: string;
  targetSlotId: string;
}

export interface BreakAllianceArgs {
  gameId: string;
  slotId: string;
  targetSlotId: string;
}

export interface SendDiplomaticNoteArgs {
  gameId: string;
  slotId: string;
  targetSlotId: string;
  text: string;
}

export interface DeclareWarArgs {
  gameId: string;
  slotId: string;        // angriper
  targetSlotId: string;  // forsvarer
  contestedRegionIds: string[];
}

export interface DeployUnitsArgs {
  gameId: string;
  slotId: string;
  regionId: string;
  unitType: UnitType;
  count: number;
}

export interface ProposeCeasefireArgs {
  gameId: string;
  slotId: string;
  warId: string;
}

export interface AcceptCeasefireArgs {
  gameId: string;
  slotId: string;
  warId: string;
}
