'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

import 'leaflet/dist/leaflet.css';

interface Event {
  id: string;
  title: string;
  locationName: string | null;
  lat: number | null;
  lng: number | null;
}

interface TripMapProps {
  events: Event[];
  selectedEventId?: string | null;
  onEventClick?: (eventId: string) => void;
}

export default function TripMap({ events, selectedEventId, onEventClick }: TripMapProps) {
  const [mounted, setMounted] = useState(false);
  const [L, setL] = useState<typeof import('leaflet') | null>(null);

  useEffect(() => {
    setMounted(true);
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  // Filter events with valid coordinates
  const eventsWithCoords = events.filter((e) => e.lat !== null && e.lng !== null);

  // Calculate center
  const center: [number, number] =
    eventsWithCoords.length > 0
      ? [eventsWithCoords[0].lat!, eventsWithCoords[0].lng!]
      : [48.8566, 2.3522]; // Default to Paris

  if (!mounted || !L) {
    return (
      <div className="h-full min-h-[300px] bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
        <span className="text-slate-500">Chargement de la carte...</span>
      </div>
    );
  }

  // Custom marker icon
  const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const selectedIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: '100%', minHeight: '300px', width: '100%', borderRadius: '0.5rem' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {eventsWithCoords.map((event) => (
        <Marker
          key={event.id}
          position={[event.lat!, event.lng!]}
          icon={selectedEventId === event.id ? selectedIcon : defaultIcon}
          eventHandlers={{
            click: () => onEventClick?.(event.id),
          }}
        >
          <Popup>
            <div className="font-medium">{event.title}</div>
            {event.locationName && (
              <div className="text-sm text-slate-500">{event.locationName}</div>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
