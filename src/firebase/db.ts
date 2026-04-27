import {
  getDatabase,
  ref,
  onValue,
  off,
  type DatabaseReference,
} from 'firebase/database';
import { firebaseApp } from './config';
import type { GameMeta, RosterSlot, ServerListEntry } from '../types/game';
import type { Region } from '../types/region';
import type { Player } from '../types/player';
import type { Nation } from '../types/nation';
import type { TradeOrder, PriceHistoryEntry, ResourceType, TradeSide } from '../types/trade';
import type { Diplomacy } from '../types/diplomacy';
import type { ChatMessage } from '../types/chat';
import type { War, Unit } from '../types/war';
import type { League } from '../types/league';
import type { UnMeeting } from '../types/un';

export const db = getDatabase(firebaseApp);

// Path helpers
export const paths = {
  gameMeta:      (gameId: string) => `games/${gameId}/meta`,
  roster:        (gameId: string) => `games/${gameId}/roster`,
  rosterSlot:    (gameId: string, slotId: string) => `games/${gameId}/roster/${slotId}`,
  regions:       (gameId: string) => `games/${gameId}/regions`,
  region:        (gameId: string, regionId: string) => `games/${gameId}/regions/${regionId}`,
  players:       (gameId: string) => `games/${gameId}/players`,
  player:        (gameId: string, slotId: string) => `games/${gameId}/players/${slotId}`,
  nations:       (gameId: string) => `games/${gameId}/nations`,
  nation:        (gameId: string, nationId: string) => `games/${gameId}/nations/${nationId}`,
  usedColors:    (gameId: string) => `games/${gameId}/usedColors`,
  regionSummary: (gameId: string) => `games/${gameId}/regionsSummary`,
  marketOrders:  (gameId: string, resource: ResourceType, side: TradeSide) =>
    `games/${gameId}/markets/orders/${resource}/${side}`,
  marketHistory: (gameId: string, resource: ResourceType) =>
    `games/${gameId}/markets/priceHistory/${resource}`,
  diplomacy:     (gameId: string) => `games/${gameId}/diplomacy`,
  chatChannel:   (gameId: string, channelId: string) =>
    `games/${gameId}/chat/${channelId}`,
  wars:          (gameId: string) => `games/${gameId}/wars`,
  units:         (gameId: string) => `games/${gameId}/units`,
  leagues:       (gameId: string) => `games/${gameId}/leagues`,
  unMeetings:    (gameId: string) => `games/${gameId}/unMeetings`,
};

export function subscribeToGameMeta(
  gameId: string,
  cb: (meta: GameMeta | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.gameMeta(gameId));
  onValue(r, snap => cb(snap.val() as GameMeta | null));
  return () => off(r);
}

export function subscribeToPlayer(
  gameId: string,
  slotId: string,
  cb: (player: Player | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.player(gameId, slotId));
  onValue(r, snap => cb(snap.val() as Player | null));
  return () => off(r);
}

export function subscribeToRegion(
  gameId: string,
  regionId: string,
  cb: (region: Region | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.region(gameId, regionId));
  onValue(r, snap => cb(snap.val() as Region | null));
  return () => off(r);
}

export function subscribeToRegions(
  gameId: string,
  cb: (regions: Record<string, Region> | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.regions(gameId));
  onValue(r, snap => cb(snap.val() as Record<string, Region> | null));
  return () => off(r);
}

export function subscribeToNation(
  gameId: string,
  nationId: string,
  cb: (nation: Nation | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.nation(gameId, nationId));
  onValue(r, snap => cb(snap.val() as Nation | null));
  return () => off(r);
}

export function subscribeToNations(
  gameId: string,
  cb: (nations: Record<string, Nation> | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.nations(gameId));
  onValue(r, snap => cb(snap.val() as Record<string, Nation> | null));
  return () => off(r);
}

export function subscribeToRoster(
  gameId: string,
  cb: (roster: Record<string, RosterSlot> | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.roster(gameId));
  onValue(r, snap => cb(snap.val() as Record<string, RosterSlot> | null));
  return () => off(r);
}

export function subscribeToMarketOrders(
  gameId: string,
  resource: ResourceType,
  side: TradeSide,
  cb: (orders: Record<string, TradeOrder> | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.marketOrders(gameId, resource, side));
  onValue(r, snap => cb(snap.val() as Record<string, TradeOrder> | null));
  return () => off(r);
}

export function subscribeToMarketHistory(
  gameId: string,
  resource: ResourceType,
  cb: (history: Record<string, PriceHistoryEntry> | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.marketHistory(gameId, resource));
  onValue(r, snap => cb(snap.val() as Record<string, PriceHistoryEntry> | null));
  return () => off(r);
}

export function subscribeToDiplomacy(
  gameId: string,
  cb: (diplomacy: Record<string, Diplomacy> | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.diplomacy(gameId));
  onValue(r, snap => cb(snap.val() as Record<string, Diplomacy> | null));
  return () => off(r);
}

export function subscribeToChat(
  gameId: string,
  channelId: string,
  cb: (messages: Record<string, ChatMessage> | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.chatChannel(gameId, channelId));
  onValue(r, snap => cb(snap.val() as Record<string, ChatMessage> | null));
  return () => off(r);
}

export function subscribeToWars(
  gameId: string,
  cb: (wars: Record<string, War> | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.wars(gameId));
  onValue(r, snap => cb(snap.val() as Record<string, War> | null));
  return () => off(r);
}

export function subscribeToUnits(
  gameId: string,
  cb: (units: Record<string, Unit> | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.units(gameId));
  onValue(r, snap => cb(snap.val() as Record<string, Unit> | null));
  return () => off(r);
}

export function subscribeToLeagues(
  gameId: string,
  cb: (leagues: Record<string, League> | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.leagues(gameId));
  onValue(r, snap => cb(snap.val() as Record<string, League> | null));
  return () => off(r);
}

export function subscribeToUnMeetings(
  gameId: string,
  cb: (meetings: Record<string, UnMeeting> | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, paths.unMeetings(gameId));
  onValue(r, snap => cb(snap.val() as Record<string, UnMeeting> | null));
  return () => off(r);
}

export function subscribeToServerList(
  cb: (servers: Record<string, ServerListEntry> | null) => void,
): () => void {
  const r: DatabaseReference = ref(db, 'serverList');
  onValue(r, snap => cb(snap.val() as Record<string, ServerListEntry> | null));
  return () => off(r);
}

