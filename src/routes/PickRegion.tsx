import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../firebase/config';
import { useGameStore } from '../game/store';
import { getEmpireColor } from '../game/empire-colors';
import { subscribeToPlayer, subscribeToRegions } from '../firebase/db';
import { PickMapView } from '../map/PickMapView';
import { MapErrorBoundary } from '../ui/MapErrorBoundary';

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// Pigment names — give players a memorable label for their empire color
const PIGMENT_NAMES = [
  'Sinober', 'Indigo', 'Okerpil', 'Smaragd', 'Purpur', 'Karmin',
  'Ultramarin', 'Safran', 'Krapp', 'Verdigris', 'Sepia', 'Sienne',
  'Klorofyll', 'Vermillion', 'Lapis', 'Rosenkvarts', 'Asurit', 'Topas',
  'Malakitt', 'Korall',
];

function pigmentName(idx: number): string {
  return PIGMENT_NAMES[idx % PIGMENT_NAMES.length];
}

async function loadJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

interface PickStartRegionResult {
  ok: boolean;
  data?: { availableColorIndices: number[] };
  error?: string;
  melding?: string;
}

interface PickStartRegionRequest {
  gameId: string;
  regionId: string;
  prevRegionId?: string;
}

interface ConfirmColorResult {
  ok: boolean;
  error?: string;
  melding?: string;
}

export function PickRegion() {
  const navigate = useNavigate();
  const { gameId, slotId } = useGameStore();

  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection>(EMPTY_GEOJSON);
  const [geojsonLoading, setGeojsonLoading] = useState(true);
  const [takenRegionIds, setTakenRegionIds] = useState<Set<string>>(new Set());

  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [colorChoices, setColorChoices] = useState<number[]>([]);
  const [chosenColorIdx, setChosenColorIdx] = useState<number | null>(null);
  const [step, setStep] = useState<'pick-region' | 'pick-color' | 'confirming'>('pick-region');
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId || !slotId) return;
    return subscribeToPlayer(gameId, slotId, player => {
      if (player?.regionIds && player.regionIds.length > 0) {
        navigate('/game', { replace: true });
      }
    });
  }, [gameId, slotId, navigate]);

  useEffect(() => {
    loadJson<GeoJSON.FeatureCollection>('/geo/regions.geojson', EMPTY_GEOJSON).then(data => {
      setGeojson(data);
      setGeojsonLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!gameId) return;
    return subscribeToRegions(gameId, regions => {
      const taken = new Set(
        Object.entries(regions ?? {})
          .filter(([, r]) => r.ownerId != null)
          .map(([id]) => id),
      );
      setTakenRegionIds(taken);
    });
  }, [gameId]);

  async function handleRegionClick(regionId: string) {
    if (!gameId || !slotId || step !== 'pick-region' || picking) return;
    setPicking(true);
    setSelectedRegionId(regionId);
    setError(null);

    try {
      const functions = getFunctions(firebaseApp, 'europe-west1');
      const pickStartRegion = httpsCallable<PickStartRegionRequest, PickStartRegionResult>(
        functions, 'pickStartRegion',
      );
      const result = await pickStartRegion({ gameId, regionId, prevRegionId: selectedRegionId ?? undefined });
      const data = result.data;
      if (!data.ok || !data.data?.availableColorIndices) {
        setError(data.melding ?? 'Regionen er ikke tilgjengelig.');
        setSelectedRegionId(null);
        return;
      }
      setColorChoices(data.data.availableColorIndices);
      setStep('pick-color');
    } finally {
      setPicking(false);
    }
  }

  async function handleColorConfirm() {
    if (chosenColorIdx === null || !gameId || !slotId || !selectedRegionId) return;
    setStep('confirming');
    const functions = getFunctions(firebaseApp, 'europe-west1');
    const confirmColor = httpsCallable<
      { gameId: string; regionId: string; empireColorIdx: number },
      ConfirmColorResult
    >(functions, 'confirmEmpireColor');
    const result = await confirmColor({ gameId, regionId: selectedRegionId, empireColorIdx: chosenColorIdx });
    if (!result.data.ok) {
      setError(result.data.melding ?? 'Farge-valg mislyktes. Prøv igjen.');
      setStep('pick-color');
      return;
    }
    navigate('/game');
  }

  if (!gameId || !slotId) {
    return (
      <div className="h-screen bg-bg flex items-center justify-center">
        <p className="text-danger font-serif italic">Ikke innlogget. Gå tilbake til forsiden.</p>
      </div>
    );
  }

  return (
    <main className="h-screen bg-bg flex flex-col" aria-label="Velg startregion">
      <header className="shrink-0 px-5 py-3 border-b border-panelEdge/40 parchment shadow-paper">
        <h1
          className="font-serif text-accent text-2xl tracking-wide"
          style={{ fontVariant: 'small-caps' }}
        >
          Velg din startregion
        </h1>
        <p className="text-inkLo text-sm font-serif italic mt-0.5 flex items-center gap-2">
          {geojsonLoading
            ? 'Laster kart …'
            : picking
            ? (
              <>
                <span
                  className="inline-block w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0"
                  aria-hidden="true"
                />
                Reserverer region, vent litt …
              </>
            )
            : 'Klikk på en tilgjengelig region for å plante imperiets fane der.'}
        </p>
      </header>

      <div className="flex-1 relative overflow-hidden">
        <MapErrorBoundary label="Regionvalg-kartet">
          <PickMapView
            geojson={geojson}
            takenRegionIds={takenRegionIds}
            selectedRegionId={selectedRegionId}
            onRegionClick={handleRegionClick}
          />
        </MapErrorBoundary>

        {(step === 'pick-color' || step === 'confirming') && (
          <div
            className="absolute bottom-3 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-2xl z-[1000] parchment border border-panelEdge/70 rounded-paper shadow-paperLg p-5"
            role="dialog"
            aria-label="Velg imperiumfarge"
          >
            <h2 className="font-serif text-ink text-xl mb-3">Velg imperiumfarge</h2>
            <div className="flex gap-4 mb-4 flex-wrap justify-center sm:justify-start">
              {colorChoices.map(idx => {
                const selected = chosenColorIdx === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setChosenColorIdx(idx)}
                    className="flex flex-col items-center gap-1.5 group focus:outline-none"
                    aria-label={`Pigment ${pigmentName(idx)}`}
                    aria-pressed={selected}
                  >
                    <span
                      className={[
                        'w-12 h-12 rounded-full transition-all shadow-paper',
                        selected
                          ? 'ring-4 ring-accent ring-offset-2 ring-offset-panel scale-110'
                          : 'ring-2 ring-panelEdge/40 group-hover:ring-accent/60 group-hover:scale-105',
                      ].join(' ')}
                      style={{ backgroundColor: getEmpireColor(idx) }}
                      aria-hidden="true"
                    />
                    <span className="font-serif text-xs text-inkLo tracking-wide">
                      {pigmentName(idx)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 pt-3 border-t border-panelEdge/30">
              <button
                onClick={handleColorConfirm}
                disabled={chosenColorIdx === null || step === 'confirming'}
                className="bg-accent text-panel font-serif text-base px-6 py-2 rounded-paper shadow-paper disabled:opacity-40 hover:brightness-110 transition-all"
              >
                {step === 'confirming' ? 'Starter imperiet …' : 'Plant fanen'}
              </button>
              {step !== 'confirming' && (
                <button
                  onClick={() => {
                    setStep('pick-region');
                    setSelectedRegionId(null);
                    setChosenColorIdx(null);
                  }}
                  className="text-inkLo text-sm font-serif italic hover:text-accent transition-colors"
                >
                  Velg annen region
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="shrink-0 px-4 py-2 parchment border-t border-panelEdge/30">
          <p className="text-danger text-sm" role="alert">{error}</p>
        </div>
      )}
    </main>
  );
}
