import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { zoomClassName } from './styles';

interface ZoomControllerProps {
  onZoomChange?: (zoom: number, className: string) => void;
}

export function ZoomController({ onZoomChange }: ZoomControllerProps) {
  const map = useMap();

  useEffect(() => {
    const handleZoom = () => {
      const z = map.getZoom();
      const cls = zoomClassName(z);
      onZoomChange?.(z, cls);
    };

    map.on('zoomend', handleZoom);
    handleZoom();
    return () => { map.off('zoomend', handleZoom); };
  }, [map, onZoomChange]);

  return null;
}
