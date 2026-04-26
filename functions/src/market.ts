import * as functions from 'firebase-functions/v2/https';
import { db } from './_db';
import { M } from './messages';
import {
  aggregateTickStats,
  isTradable,
  matchOrderBook,
  planResourceDeduction,
  totalResourceForPlayer,
  TRADABLE_RESOURCES,
} from './market-logic';
import type {
  TradeOrder,
  Region,
  Player,
  ProposeTradeArgs,
  CancelTradeArgs,
  AcceptTradeArgs,
  CallableResult,
  ResourceType,
} from './types';

const REGION = 'europe-west1';
const MAX_PRICE = 9999;
const MIN_PRICE = 0.01;

// ---------------------------------------------------------------------------
// proposeTrade
// ---------------------------------------------------------------------------

export const proposeTrade = functions.onCall<
  ProposeTradeArgs,
  Promise<CallableResult<{ orderId: string }>>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }

  const { gameId, resource, side, quantity, pricePerUnit } = req.data;
  const slotId = req.auth.uid;

  if (!gameId || !resource || !side || !quantity || !pricePerUnit) {
    return { ok: false, error: 'missing_fields', melding: 'Mangler obligatoriske felter.' };
  }

  if (!isTradable(resource)) {
    return { ok: false, error: 'not_tradable', melding: 'Denne ressursen er ikke omsettelig.' };
  }

  if (quantity <= 0 || !Number.isFinite(quantity)) {
    return { ok: false, error: 'invalid_quantity', melding: 'Mengden må være positiv.' };
  }
  if (pricePerUnit < MIN_PRICE || pricePerUnit > MAX_PRICE) {
    return { ok: false, error: 'invalid_price', melding: `Pris må være mellom ${MIN_PRICE} og ${MAX_PRICE}.` };
  }

  const [rosterSnap, metaSnap, playerSnap] = await Promise.all([
    db.ref(`games/${gameId}/roster/${slotId}`).once('value'),
    db.ref(`games/${gameId}/meta/status`).once('value'),
    db.ref(`games/${gameId}/players/${slotId}`).once('value'),
  ]);

  if (!rosterSnap.exists()) {
    return { ok: false, error: 'not_in_game', melding: 'Du er ikke med i dette spillet.' };
  }
  if (metaSnap.val() !== 'active') {
    return { ok: false, error: 'game_not_active', melding: M.SPILL_IKKE_AKTIVT };
  }

  const player = playerSnap.val() as Player | null;
  if (!player) return { ok: false, error: 'no_player', melding: M.IKKE_AUTENTISERT };

  const now = Date.now();

  // Reserver økonomisk ressurs avhengig av side
  if (side === 'buy') {
    const cost = quantity * pricePerUnit;
    if (player.treasury < cost) {
      return { ok: false, error: 'insufficient_funds', melding: M.IKKE_NOK_PENGER };
    }
    // Atomisk trekk via transaction
    let trekt = false;
    await db.ref(`games/${gameId}/players/${slotId}/treasury`).transaction((curr: number | null) => {
      const t = curr ?? 0;
      if (t < cost) return; // avbryt
      trekt = true;
      return t - cost;
    });
    if (!trekt) {
      return { ok: false, error: 'insufficient_funds', melding: M.IKKE_NOK_PENGER };
    }
  } else {
    // sell — sjekk og trekk fra regioner
    const regionSnaps = await Promise.all(
      (player.regionIds ?? []).map(async rid => {
        const s = await db.ref(`games/${gameId}/regions/${rid}`).once('value');
        return { regionId: rid, region: s.val() as Region | null };
      }),
    );
    const regions = regionSnaps
      .filter(({ region }) => region !== null)
      .map(({ regionId, region }) => ({ ...(region as Region), regionId }));

    const have = totalResourceForPlayer(regions, resource);
    if (have < quantity) {
      return {
        ok: false,
        error: 'insufficient_resource',
        melding: `Du har bare ${have} ${resource} (krever ${quantity}).`,
      };
    }

    const { plan, shortfall } = planResourceDeduction(regions, resource, quantity);
    if (shortfall > 0) {
      return {
        ok: false,
        error: 'insufficient_resource',
        melding: `Mangler ${shortfall} ${resource} totalt.`,
      };
    }

    // Trekk fra hver region (multi-path update)
    const updates: Record<string, unknown> = {};
    for (const step of plan) {
      updates[`games/${gameId}/regions/${step.regionId}/resources/${resource}`] = step.remainingAfter;
    }
    await db.ref().update(updates);
  }

  const orderRef = db.ref(`games/${gameId}/markets/orders/${resource}/${side}`).push();
  const orderId = orderRef.key!;
  const order: TradeOrder = {
    ownerId: slotId,
    resource,
    side,
    quantity,
    originalQuantity: quantity,
    pricePerUnit,
    postedAt: now,
    status: 'open',
  };
  await orderRef.set(order);

  return { ok: true, data: { orderId } };
});

// ---------------------------------------------------------------------------
// cancelTrade — refunder reserverte midler
// ---------------------------------------------------------------------------

export const cancelTrade = functions.onCall<
  CancelTradeArgs,
  Promise<CallableResult>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }

  const { gameId, resource, side, orderId } = req.data;
  const slotId = req.auth.uid;

  const orderPath = `games/${gameId}/markets/orders/${resource}/${side}/${orderId}`;
  const orderSnap = await db.ref(orderPath).once('value');
  const order = orderSnap.val() as TradeOrder | null;

  if (!order) return { ok: false, error: 'order_not_found', melding: 'Ordren ble ikke funnet.' };
  if (order.ownerId !== slotId) {
    return { ok: false, error: 'not_owner', melding: 'Du eier ikke denne ordren.' };
  }
  if (order.status !== 'open') {
    return { ok: false, error: 'not_open', melding: 'Ordren er ikke åpen.' };
  }

  const now = Date.now();

  if (side === 'buy') {
    const refund = order.quantity * order.pricePerUnit;
    await db.ref(`games/${gameId}/players/${slotId}/treasury`).transaction(
      (curr: number | null) => (curr ?? 0) + refund,
    );
  } else {
    // Refund resource til første egne region
    const playerSnap = await db.ref(`games/${gameId}/players/${slotId}`).once('value');
    const player = playerSnap.val() as Player | null;
    const targetRegion = player?.regionIds?.[0];
    if (targetRegion) {
      await db.ref(`games/${gameId}/regions/${targetRegion}/resources/${resource}`).transaction(
        (curr: number | null) => (curr ?? 0) + order.quantity,
      );
    }
  }

  await db.ref(orderPath).update({ status: 'cancelled', cancelledAt: now });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// acceptTrade — direkte 1-til-1-aksept (uten matchOrders)
// ---------------------------------------------------------------------------
// "side" i argumentet refererer til siden av ORDREN spilleren matcher mot.
// Hvis ordren er en "sell", aksepterer kjøperen → spilleren betaler treasury,
//   får ressursen levert. Hvis ordren er en "buy", aksepterer selgeren →
//   spilleren leverer ressursen, får treasury.

export const acceptTrade = functions.onCall<
  AcceptTradeArgs,
  Promise<CallableResult<{ filled: number; price: number }>>
>({ region: REGION, invoker: 'public', cors: true }, async (req) => {
  if (!req.auth?.uid) {
    return { ok: false, error: 'unauthenticated', melding: M.IKKE_AUTENTISERT };
  }

  const { gameId, resource, side, orderId, quantity } = req.data;
  const acceptorId = req.auth.uid;

  if (!isTradable(resource)) {
    return { ok: false, error: 'not_tradable', melding: 'Denne ressursen er ikke omsettelig.' };
  }
  if (quantity <= 0) {
    return { ok: false, error: 'invalid_quantity', melding: 'Mengden må være positiv.' };
  }

  const orderPath = `games/${gameId}/markets/orders/${resource}/${side}/${orderId}`;
  const orderSnap = await db.ref(orderPath).once('value');
  const order = orderSnap.val() as TradeOrder | null;

  if (!order) return { ok: false, error: 'order_not_found', melding: 'Ordren ble ikke funnet.' };
  if (order.status !== 'open') {
    return { ok: false, error: 'not_open', melding: 'Ordren er ikke åpen.' };
  }
  if (order.ownerId === acceptorId) {
    return { ok: false, error: 'cannot_self_match', melding: 'Du kan ikke akseptere din egen ordre.' };
  }

  const fill = Math.min(quantity, order.quantity);
  const price = order.pricePerUnit;
  const totalCost = fill * price;
  const now = Date.now();

  // Roller: hvis ordren er en sell, er acceptor kjøper. Ellers selger.
  const buyerId = side === 'sell' ? acceptorId : order.ownerId;
  const sellerId = side === 'sell' ? order.ownerId : acceptorId;

  // ---- Atomisk: trekk treasury fra kjøper, eller resource fra selger ----

  // Atomisk reservasjon av ordren — sett quantity ned først, så ingen race
  let reserved = false;
  await db.ref(orderPath).transaction((curr: TradeOrder | null) => {
    if (!curr || curr.status !== 'open' || curr.quantity < fill) return; // avbryt
    reserved = true;
    const newQty = curr.quantity - fill;
    return {
      ...curr,
      quantity: newQty,
      status: newQty === 0 ? 'filled' : 'open',
      filledAt: newQty === 0 ? now : curr.filledAt ?? null,
    };
  });
  if (!reserved) {
    return { ok: false, error: 'race', melding: 'Ordren ble allerede fylt eller endret.' };
  }

  // Trekk ressurs fra selger (hvis ikke allerede reservert i sell-order)
  if (side === 'buy') {
    // Selger må levere resource fra sine regioner
    const playerSnap = await db.ref(`games/${gameId}/players/${sellerId}`).once('value');
    const player = playerSnap.val() as Player | null;
    if (!player) {
      // Rull tilbake order
      await rollbackFill(gameId, resource, side, orderId, fill);
      return { ok: false, error: 'no_seller_player', melding: 'Selgerens spillerprofil mangler.' };
    }
    const regionSnaps = await Promise.all(
      player.regionIds.map(async rid => {
        const s = await db.ref(`games/${gameId}/regions/${rid}`).once('value');
        return { regionId: rid, region: s.val() as Region | null };
      }),
    );
    const regions = regionSnaps
      .filter(({ region }) => region !== null)
      .map(({ regionId, region }) => ({ ...(region as Region), regionId }));

    const { plan, shortfall } = planResourceDeduction(regions, resource, fill);
    if (shortfall > 0) {
      await rollbackFill(gameId, resource, side, orderId, fill);
      return { ok: false, error: 'seller_insufficient_resource', melding: 'Selgeren har ikke nok ressurs lenger.' };
    }
    const upd: Record<string, unknown> = {};
    for (const step of plan) {
      upd[`games/${gameId}/regions/${step.regionId}/resources/${resource}`] = step.remainingAfter;
    }
    await db.ref().update(upd);
  }

  // Trekk treasury fra kjøper (hvis ikke allerede reservert i buy-order)
  if (side === 'sell') {
    let trekt = false;
    await db.ref(`games/${gameId}/players/${buyerId}/treasury`).transaction((curr: number | null) => {
      const t = curr ?? 0;
      if (t < totalCost) return;
      trekt = true;
      return t - totalCost;
    });
    if (!trekt) {
      await rollbackFill(gameId, resource, side, orderId, fill);
      return { ok: false, error: 'insufficient_funds', melding: M.IKKE_NOK_PENGER };
    }
  }

  // ---- Settle: lever til motpart ----

  // Selger får penger
  await db.ref(`games/${gameId}/players/${sellerId}/treasury`).transaction(
    (curr: number | null) => (curr ?? 0) + totalCost,
  );

  // Kjøper får ressursen lagt til første egne region
  const buyerSnap = await db.ref(`games/${gameId}/players/${buyerId}/regionIds`).once('value');
  const buyerRegionIds = (buyerSnap.val() as string[]) ?? [];
  const targetRegion = buyerRegionIds[0];
  if (targetRegion) {
    await db.ref(`games/${gameId}/regions/${targetRegion}/resources/${resource}`).transaction(
      (curr: number | null) => (curr ?? 0) + fill,
    );
  }

  // Skriv prishistorikk for denne enkelt-handelen
  await appendPriceHistory(gameId, resource, price, fill);

  return { ok: true, data: { filled: fill, price } };
});

async function rollbackFill(
  gameId: string,
  resource: ResourceType,
  side: 'buy' | 'sell',
  orderId: string,
  fill: number,
): Promise<void> {
  await db.ref(`games/${gameId}/markets/orders/${resource}/${side}/${orderId}`).transaction(
    (curr: TradeOrder | null) => {
      if (!curr) return curr;
      return {
        ...curr,
        quantity: curr.quantity + fill,
        status: 'open',
        filledAt: null,
      };
    },
  );
}

async function appendPriceHistory(
  gameId: string,
  resource: ResourceType,
  avgPrice: number,
  volume: number,
): Promise<void> {
  const ts = Date.now();
  const entryRef = db.ref(`games/${gameId}/markets/priceHistory/${resource}`).push();
  await entryRef.set({ avgPrice, volume, ts });
}

// ---------------------------------------------------------------------------
// runMatchOrdersForGame — kalles fra tick.ts hvert makro-tikk
// ---------------------------------------------------------------------------

/**
 * Matcher åpne ordre per ressurs for ett spill. Settleres on-the-fly:
 * for hver match overføres treasury til selger, ressurs til kjøpers første
 * region. Skriver én priseflagg-oppføring per ressurs per tikk hvor det
 * fant sted handler.
 *
 * Antakelse: sell-ordrene har allerede fått ressursen reservert ved
 * proposeTrade (trukket fra selgers regioner). Buy-ordrene har låst
 * treasury. Match utfører kun selve overføringen + status-oppdatering.
 */
export async function runMatchOrdersForGame(gameId: string): Promise<void> {
  for (const resource of TRADABLE_RESOURCES) {
    const [buysSnap, sellsSnap] = await Promise.all([
      db.ref(`games/${gameId}/markets/orders/${resource}/buy`).once('value'),
      db.ref(`games/${gameId}/markets/orders/${resource}/sell`).once('value'),
    ]);

    const buys = Object.entries((buysSnap.val() as Record<string, TradeOrder>) ?? {}).map(
      ([id, o]) => ({ ...o, id }),
    );
    const sells = Object.entries((sellsSnap.val() as Record<string, TradeOrder>) ?? {}).map(
      ([id, o]) => ({ ...o, id }),
    );

    const matches = matchOrderBook(buys, sells);
    if (matches.length === 0) continue;

    // Bygg oppdateringer
    const updates: Record<string, unknown> = {};
    const now = Date.now();

    // Akkumuler treasury- og resource-deltaer per spiller for ett samlet skriv
    const treasuryDeltas: Record<string, number> = {};
    const resourceDeltas: Record<string, number> = {};

    // Spor gjenværende quantity per orderId
    const buyRemaining: Record<string, number> = {};
    const sellRemaining: Record<string, number> = {};
    for (const o of buys) buyRemaining[o.id] = o.quantity;
    for (const o of sells) sellRemaining[o.id] = o.quantity;

    for (const m of matches) {
      const notional = m.fillPrice * m.fillQuantity;

      // Selger får penger
      treasuryDeltas[m.sell.ownerId] = (treasuryDeltas[m.sell.ownerId] ?? 0) + notional;
      // Kjøper får ressursen
      resourceDeltas[m.buy.ownerId] = (resourceDeltas[m.buy.ownerId] ?? 0) + m.fillQuantity;

      // Refunder kjøper for prisforskjell (lagret pris > fyllpris)
      const overpaid = (m.buy.pricePerUnit - m.fillPrice) * m.fillQuantity;
      if (overpaid > 0) {
        treasuryDeltas[m.buy.ownerId] = (treasuryDeltas[m.buy.ownerId] ?? 0) + overpaid;
      }

      buyRemaining[m.buy.id] -= m.fillQuantity;
      sellRemaining[m.sell.id] -= m.fillQuantity;
    }

    // Oppdater orders status + quantity
    for (const o of buys) {
      const remain = buyRemaining[o.id];
      if (remain === o.quantity) continue; // ikke endret
      updates[`games/${gameId}/markets/orders/${resource}/buy/${o.id}/quantity`] = remain;
      if (remain === 0) {
        updates[`games/${gameId}/markets/orders/${resource}/buy/${o.id}/status`] = 'filled';
        updates[`games/${gameId}/markets/orders/${resource}/buy/${o.id}/filledAt`] = now;
      }
    }
    for (const o of sells) {
      const remain = sellRemaining[o.id];
      if (remain === o.quantity) continue;
      updates[`games/${gameId}/markets/orders/${resource}/sell/${o.id}/quantity`] = remain;
      if (remain === 0) {
        updates[`games/${gameId}/markets/orders/${resource}/sell/${o.id}/status`] = 'filled';
        updates[`games/${gameId}/markets/orders/${resource}/sell/${o.id}/filledAt`] = now;
      }
    }

    // Skriv strukturelle endringer atomisk
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }

    // Treasury-overføringer (transaction per spiller for å være sikker)
    for (const [slotId, delta] of Object.entries(treasuryDeltas)) {
      if (delta === 0) continue;
      await db.ref(`games/${gameId}/players/${slotId}/treasury`).transaction(
        (curr: number | null) => (curr ?? 0) + delta,
      );
    }

    // Resource-overføringer til kjøpernes første region
    for (const [slotId, amount] of Object.entries(resourceDeltas)) {
      if (amount === 0) continue;
      const playerSnap = await db.ref(`games/${gameId}/players/${slotId}/regionIds`).once('value');
      const regionIds = (playerSnap.val() as string[]) ?? [];
      const targetRegion = regionIds[0];
      if (targetRegion) {
        await db.ref(`games/${gameId}/regions/${targetRegion}/resources/${resource}`).transaction(
          (curr: number | null) => (curr ?? 0) + amount,
        );
      }
    }

    // Skriv prishistorikk
    const stats = aggregateTickStats(matches);
    if (stats) {
      await appendPriceHistory(gameId, resource, stats.avgPrice, stats.volume);
    }
  }
}
