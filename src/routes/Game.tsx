import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthChange } from '../firebase/auth';
import { ref, set } from 'firebase/database';
import { TopBar } from '../ui/TopBar';
import { BottomNav } from '../ui/BottomNav';
import { SchemaVersionBanner } from '../ui/SchemaVersionBanner';
import { OnboardingGuide } from '../ui/OnboardingGuide';
import { MapScreen } from '../screens/MapScreen';
import { MarketScreen } from '../screens/MarketScreen';
import { DiplomacyScreen } from '../screens/DiplomacyScreen';
import { WarScreen } from '../screens/WarScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { UnMeetingModal } from '../features/un/UnMeetingModal';
import { useGameStore } from '../game/store';
import {
  db,
  subscribeToGameMeta,
  subscribeToPlayer,
  subscribeToRegions,
  subscribeToNations,
  subscribeToDiplomacy,
  subscribeToWars,
  subscribeToUnits,
  subscribeToSchemaVersion,
} from '../firebase/db';

export function Game() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const {
    gameId,
    slotId,
    activeScreen,
    setMeta,
    updatePlayer,
    setRegions,
    setNations,
    setDiplomacy,
    setWars,
    setUnits,
    setSchemaVersionMismatch,
    schemaVersionMismatch,
  } = useGameStore();

  useEffect(() => {
    return onAuthChange(user => {
      if (!user) {
        navigate('/login', { replace: true });
      } else {
        setAuthChecked(true);
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (!authChecked || !gameId || !slotId) return;

    const unsubMeta = subscribeToGameMeta(gameId, meta => {
      if (meta) setMeta(meta);
    });
    const unsubPlayer = subscribeToPlayer(gameId, slotId, player => {
      if (player) updatePlayer(slotId, player);
    });
    const unsubRegions = subscribeToRegions(gameId, regions => {
      if (regions) setRegions(regions);
    });
    const unsubNations = subscribeToNations(gameId, nations => {
      setNations(nations ?? {});
    });
    const unsubDiplomacy = subscribeToDiplomacy(gameId, diplomacy => {
      setDiplomacy(diplomacy ?? {});
    });
    const unsubWars = subscribeToWars(gameId, wars => {
      setWars(wars ?? {});
    });
    const unsubUnits = subscribeToUnits(gameId, units => {
      setUnits(units ?? {});
    });
    const unsubSchema = subscribeToSchemaVersion(gameId, mismatch => {
      setSchemaVersionMismatch(mismatch);
    });

    return () => {
      unsubMeta();
      unsubPlayer();
      unsubRegions();
      unsubNations();
      unsubDiplomacy();
      unsubWars();
      unsubUnits();
      unsubSchema();
    };
  }, [authChecked, gameId, slotId, setMeta, updatePlayer, setRegions, setNations, setDiplomacy, setWars, setUnits, setSchemaVersionMismatch]);

  useEffect(() => {
    if (authChecked && (!gameId || !slotId)) {
      navigate('/servers', { replace: true });
    }
  }, [authChecked, gameId, slotId, navigate]);

  // Presence heartbeat — oppdater lastSeenAt hvert 30. sekund
  useEffect(() => {
    if (!gameId || !slotId) return;

    function updatePresence() {
      void set(ref(db, `games/${gameId}/players/${slotId}/lastSeenAt`), Date.now());
    }
    updatePresence();
    const id = setInterval(updatePresence, 30_000);
    return () => clearInterval(id);
  }, [gameId, slotId]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-textLo">Laster…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg text-ink overflow-hidden">
      <SchemaVersionBanner visible={schemaVersionMismatch} />

      <TopBar />

      <main className="relative flex flex-1 overflow-hidden" role="main">
        {activeScreen === 'map'       && <MapScreen />}
        {activeScreen === 'market'    && <MarketScreen />}
        {activeScreen === 'diplomacy' && <DiplomacyScreen />}
        {activeScreen === 'war'       && <WarScreen />}
        {activeScreen === 'events'    && <EventsScreen />}
        <OnboardingGuide />
      </main>

      <BottomNav />

      <UnMeetingModal />
    </div>
  );
}
