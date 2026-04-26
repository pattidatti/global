import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './routes/Login';

// Lazy-loadede ruter — Login lastes alltid statisk fordi det er entry-point.
const ServerList = lazy(() => import('./routes/ServerList').then(m => ({ default: m.ServerList })));
const Game       = lazy(() => import('./routes/Game').then(m => ({ default: m.Game })));
const PickRegion = lazy(() => import('./routes/PickRegion').then(m => ({ default: m.PickRegion })));
const Teacher    = lazy(() => import('./routes/Teacher').then(m => ({ default: m.Teacher })));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-textLo text-sm" role="status" aria-live="polite">
        Laster…
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/">
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login"   element={<Login />} />
          <Route path="/servers" element={<ServerList />} />
          <Route path="/teacher" element={<Teacher />} />
          <Route path="/pick"    element={<PickRegion />} />
          <Route path="/game"    element={<Game />} />
          <Route path="*"        element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
