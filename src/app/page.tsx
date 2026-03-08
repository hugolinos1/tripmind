'use client';

// Tripmind - AI-Powered Travel Planning Application
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plane,
  MapPin,
  Calendar,
  Users,
  Sparkles,
  Compass,
  Star,
  Clock,
  Euro,
  Heart,
  Camera,
  Utensils,
  ShoppingBag,
  Mountain,
  Music,
  Palette,
  Baby,
  Accessibility,
  Leaf,
  Plus,
  Trash2,
  Edit,
  Share2,
  Download,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader2,
  X,
  Check,
  Sun,
  Sunrise,
  Moon,
  Coffee,
  Wine,
  Bus,
  Home,
  Eye,
  ExternalLink,
  MoreVertical,
  Map,
  Navigation,
  Info,
  AlertTriangle,
  Lightbulb,
  Phone,
  RefreshCw,
  MessageSquare,
  Shield,
  Gem,
  Smartphone,
  Paperclip,
  FileText,
  Image as ImageIcon,
  File,
  Upload,
} from 'lucide-react';

// Types
interface Trip {
  id: string;
  title: string;
  destinations: string;
  startDate: string;
  endDate: string;
  travelers: string;
  preferences: string;
  status: string;
  shareToken: string | null;
  createdAt: string;
  days: Day[];
}

interface Day {
  id: string;
  date: string;
  orderIndex: number;
  notes: string | null;
  startLocationName: string | null;
  startLocationAddress: string | null;
  startLat: number | null;
  startLng: number | null;
  endLocationName: string | null;
  endLocationAddress: string | null;
  endLat: number | null;
  endLng: number | null;
  events: Event[];
}

interface Event {
  id: string;
  type: string;
  title: string;
  description: string | null;
  startTime: string | null;
  durationMinutes: number | null;
  locationName: string | null;
  locationAddress: string | null;
  lat: number | null;
  lng: number | null;
  photos: string;
  practicalInfo: string;
  estimatedBudget: number | null;
  isAiEnriched: boolean;
  sourceUrl: string | null;
  orderIndex: number;
  attachments?: string; // JSON array of attachments
}

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  category: string;
  categoryName: string;
  path: string;
  uploadedAt: string;
}

interface TripFormData {
  title: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  travelers: {
    adults: number;
    children: number[];
    hasPets: boolean;
  };
  preferences: {
    pace: number;
    budget: number;
    interests: string[];
    accessibility: boolean;
    dietary: string[];
    alreadyVisited: string[];
    mustSee: string[];
  };
}

// Dynamic import for Leaflet map (SSR safe)
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

// Day Map Component
function DayMap({ 
  events, 
  destination,
  startLocation,
  endLocation,
}: { 
  events: Event[]; 
  destination: string;
  startLocation?: { name: string | null; lat: number | null; lng: number | null };
  endLocation?: { name: string | null; lat: number | null; lng: number | null };
}) {
  const [isClient, setIsClient] = useState(false);
  const [leaflet, setLeaflet] = useState<typeof import('leaflet') | null>(null);

  useEffect(() => {
    setIsClient(true);
    // Dynamically import Leaflet on client side
    import('leaflet').then((module) => {
      setLeaflet(module);
    });
  }, []);

  // Filter events with coordinates
  const eventsWithCoords = events.filter((e) => e.lat !== null && e.lng !== null);
  
  // Check if we have start/end locations
  const hasStartLocation = startLocation?.lat && startLocation?.lng;
  const hasEndLocation = endLocation?.lat && endLocation?.lng;
  
  // Calculate center based on events or default
  const getMapCenter = (): [number, number] => {
    const allPoints: [number, number][] = [];
    
    eventsWithCoords.forEach((e) => {
      if (e.lat && e.lng) allPoints.push([e.lat, e.lng]);
    });
    
    if (hasStartLocation) allPoints.push([startLocation!.lat!, startLocation!.lng!]);
    if (hasEndLocation) allPoints.push([endLocation!.lat!, endLocation!.lng!]);
    
    if (allPoints.length > 0) {
      const avgLat = allPoints.reduce((sum, p) => sum + p[0], 0) / allPoints.length;
      const avgLng = allPoints.reduce((sum, p) => sum + p[1], 0) / allPoints.length;
      return [avgLat, avgLng];
    }
    // Default center (Paris)
    return [48.8566, 2.3522];
  };

  const getMarkerColor = (type: string): string => {
    switch (type) {
      case 'visit': return '#f59e0b';
      case 'meal': return '#f43f5e';
      case 'transport': return '#0ea5e9';
      case 'accommodation': return '#10b981';
      case 'activity': return '#a855f7';
      default: return '#6b7280';
    }
  };

  const createCustomIcon = (color: string, isSpecial?: 'start' | 'end') => {
    if (!leaflet) return undefined;
    
    const iconHtml = isSpecial 
      ? `<div class="custom-marker ${isSpecial}" style="background: ${color};">
          <div class="custom-marker-inner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              ${isSpecial === 'start' 
                ? '<circle cx="12" cy="12" r="10"></circle><polyline points="12 8 12 12 14 14"></polyline>'
                : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
              }
            </svg>
          </div>
        </div>`
      : `<div class="custom-marker" style="background: ${color};">
        <div class="custom-marker-inner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      </div>`;
    
    return leaflet.divIcon({
      className: 'custom-marker-wrapper',
      html: iconHtml,
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36],
    });
  };

  if (!isClient || !leaflet) {
    return (
      <div className="h-64 rounded-xl bg-white/5 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  const hasAnyLocation = eventsWithCoords.length > 0 || hasStartLocation || hasEndLocation;

  if (!hasAnyLocation) {
    return (
      <div className="h-64 rounded-xl bg-white/5 flex flex-col items-center justify-center gap-3">
        <MapPin className="w-10 h-10 text-white/30" />
        <p className="text-sm text-white/50 text-center">
          Aucun lieu géolocalisé pour ce jour.
          <br />
          <span className="text-xs">Enrichissez les événements avec l'IA pour afficher les lieux sur la carte.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="h-64 rounded-xl overflow-hidden border border-white/10">
      <MapContainer
        center={getMapCenter()}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Start Location Marker */}
        {hasStartLocation && (
          <Marker
            position={[startLocation!.lat!, startLocation!.lng!]}
            icon={createCustomIcon('#22c55e', 'start')}
          >
            <Popup>
              <div className="p-1">
                <p className="font-semibold text-sm text-green-600">📍 Départ</p>
                {startLocation!.name && (
                  <p className="text-xs text-gray-600 mt-1">{startLocation!.name}</p>
                )}
              </div>
            </Popup>
          </Marker>
        )}
        {/* End Location Marker */}
        {hasEndLocation && (
          <Marker
            position={[endLocation!.lat!, endLocation!.lng!]}
            icon={createCustomIcon('#ef4444', 'end')}
          >
            <Popup>
              <div className="p-1">
                <p className="font-semibold text-sm text-red-600">🏁 Arrivée</p>
                {endLocation!.name && (
                  <p className="text-xs text-gray-600 mt-1">{endLocation!.name}</p>
                )}
              </div>
            </Popup>
          </Marker>
        )}
        {/* Event Markers */}
        {eventsWithCoords.map((event) => (
          <Marker
            key={event.id}
            position={[event.lat!, event.lng!]}
            icon={createCustomIcon(getMarkerColor(event.type))}
          >
            <Popup>
              <div className="p-1">
                <p className="font-semibold text-sm">{event.title}</p>
                {event.locationName && (
                  <p className="text-xs text-white/70 mt-1">{event.locationName}</p>
                )}
                {event.startTime && (
                  <p className="text-xs text-white/50 mt-1">🕐 {event.startTime}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

// Transport utilities
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  // Haversine formula for distance in km
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface TransportInfo {
  distance: number; // in km
  duration: number; // in minutes
  mode: 'walking' | 'biking' | 'public' | 'taxi' | 'car';
  modeLabel: string;
  modeIcon: string;
  color: string;
}

interface DetailedTransportInfo {
  recommendedMode: string;
  summary: string;
  routes: Array<{
    type: string;
    line: string;
    lineColor: string;
    direction: string;
    fromStop: string;
    toStop: string;
    stopsCount?: number;
    duration: string;
    walkingToStation?: string;
    walkingFromStation?: string;
  }>;
  totalDuration: string;
  totalCost?: string;
  tips?: string[];
  alternatives?: Array<{
    mode: string;
    duration: string;
    cost: string;
  }>;
}

function getTransportRecommendation(
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null
): TransportInfo | null {
  // Check for null, undefined, or invalid coordinates (0,0 is in the ocean near Africa)
  const isValidCoord = (lat: number | null, lng: number | null) => {
    if (lat === null || lng === null || lat === undefined || lng === undefined) return false;
    if (lat === 0 && lng === 0) return false; // Null Island - invalid
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false; // Out of valid range
    return true;
  };
  
  // If any coordinates are invalid, return a default transport
  if (!isValidCoord(lat1, lng1) || !isValidCoord(lat2, lng2)) {
    return {
      distance: 2, // Default 2km
      duration: 15, // Default 15 min
      mode: 'public',
      modeLabel: 'Transport',
      modeIcon: '🚌',
      color: 'bg-sky-500/30 text-sky-300',
    };
  }

  const distance = calculateDistance(lat1 as number, lng1 as number, lat2 as number, lng2 as number);
  
  // Sanity check: if distance is unreasonably large (> 1000km for a single trip segment), something is wrong
  if (distance > 1000) {
    console.warn('Unreasonable distance calculated:', distance, 'km. Coords:', { lat1, lng1, lat2, lng2 });
    return {
      distance: 2,
      duration: 15,
      mode: 'public',
      modeLabel: 'Transport',
      modeIcon: '🚌',
      color: 'bg-sky-500/30 text-sky-300',
    };
  }

  // Determine best transport mode based on distance
  if (distance < 0.5) {
    // Under 500m: walking
    return {
      distance,
      duration: Math.round(distance * 12), // ~5 km/h = 12 min/km
      mode: 'walking',
      modeLabel: 'À pied',
      modeIcon: '🚶',
      color: 'bg-emerald-500/30 text-emerald-300',
    };
  } else if (distance < 2) {
    // 500m - 2km: biking or walking
    return {
      distance,
      duration: Math.round(distance * 6), // ~10 km/h = 6 min/km
      mode: 'biking',
      modeLabel: 'Vélo / Trottinette',
      modeIcon: '🚲',
      color: 'bg-teal-500/30 text-teal-300',
    };
  } else if (distance < 5) {
    // 2-5km: public transport or taxi
    return {
      distance,
      duration: Math.round(distance * 5), // ~12 km/h average with stops
      mode: 'public',
      modeLabel: 'Transport en commun',
      modeIcon: '🚌',
      color: 'bg-sky-500/30 text-sky-300',
    };
  } else if (distance < 20) {
    // 5-20km: taxi or car
    return {
      distance,
      duration: Math.round(distance * 3), // ~20 km/h in city traffic
      mode: 'taxi',
      modeLabel: 'Taxi / VTC',
      modeIcon: '🚕',
      color: 'bg-amber-500/30 text-amber-300',
    };
  } else {
    // 20km+: car
    return {
      distance,
      duration: Math.round(distance * 1.5), // ~40 km/h average
      mode: 'car',
      modeLabel: 'Voiture',
      modeIcon: '🚗',
      color: 'bg-rose-500/30 text-rose-300',
    };
  }
}

// Transport Card Component
function TransportCard({ 
  transport, 
  showAlternatives = false,
  origin,
  destination,
  city,
}: { 
  transport: TransportInfo; 
  showAlternatives?: boolean;
  origin?: { name: string; lat: number | null; lng: number | null };
  destination?: { name: string; lat: number | null; lng: number | null };
  city?: string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailedInfo, setDetailedInfo] = useState<DetailedTransportInfo | null>(null);

  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `~${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `~${hours}h${mins > 0 ? mins : ''}`;
  };

  // Alternative transport options
  const getAlternatives = (distance: number): { mode: string; icon: string; duration: number }[] => {
    const alternatives = [];
    
    alternatives.push({
      mode: 'Marche',
      icon: '🚶',
      duration: Math.round(distance * 12),
    });
    
    if (distance < 10) {
      alternatives.push({
        mode: 'Vélo',
        icon: '🚲',
        duration: Math.round(distance * 6),
      });
    }
    
    if (distance > 1) {
      alternatives.push({
        mode: 'Transport',
        icon: '🚌',
        duration: Math.round(distance * 4),
      });
    }
    
    if (distance > 2) {
      alternatives.push({
        mode: 'Taxi',
        icon: '🚕',
        duration: Math.round(distance * 2),
      });
    }
    
    return alternatives;
  };

  const fetchDetailedTransport = async () => {
    if (!origin || !destination || !city) return;
    
    setIsLoadingDetails(true);
    try {
      const response = await fetch('/api/ai/transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, city }),
      });
      const data = await response.json();
      if (data.success) {
        setDetailedInfo(data.transport);
        setShowDetails(true);
      }
    } catch (error) {
      console.error('Error fetching transport details:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const alternatives = getAlternatives(transport.distance);

  return (
    <div className="space-y-2">
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg ${transport.color} text-sm`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{transport.modeIcon}</span>
          <span className="font-medium">{transport.modeLabel}</span>
          <Badge variant="outline" className="text-xs border-white/20 text-white/60">Recommandé</Badge>
        </div>
        <div className="flex items-center gap-4 text-white/80">
          <span>{formatDistance(transport.distance)}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(transport.duration)}
          </span>
        </div>
      </div>
      
      {showAlternatives && (
        <div className="flex flex-wrap gap-2 pl-2">
          {alternatives.filter(a => a.mode !== transport.modeLabel).map((alt) => (
            <div
              key={alt.mode}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 text-white/60 text-xs"
            >
              <span>{alt.icon}</span>
              <span>{alt.mode}</span>
              <span className="text-white/40">{formatDuration(alt.duration)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Details Button */}
      {origin && destination && city && (
        <div className="pl-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-sky-400 hover:text-sky-300 hover:bg-white/10 text-xs h-7 px-2"
            onClick={() => {
              if (detailedInfo) {
                setShowDetails(!showDetails);
              } else {
                fetchDetailedTransport();
              }
            }}
            disabled={isLoadingDetails}
          >
            {isLoadingDetails ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Recherche...
              </>
            ) : showDetails ? (
              <>
                <ChevronLeft className="w-3 h-3 mr-1" />
                Masquer les détails
              </>
            ) : (
              <>
                <Navigation className="w-3 h-3 mr-1" />
                Détails du trajet
              </>
            )}
          </Button>
        </div>
      )}

      {/* Detailed Transport Info */}
      {showDetails && detailedInfo && (
        <div className="mt-3 p-4 bg-white/5 rounded-lg border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/80">{detailedInfo.summary}</p>
            <div className="text-right">
              <p className="text-sm font-medium text-white">{detailedInfo.totalDuration}</p>
              {detailedInfo.totalCost && (
                <p className="text-xs text-white/50">{detailedInfo.totalCost}</p>
              )}
            </div>
          </div>

          {/* Route Steps */}
          <div className="space-y-3">
            {detailedInfo.routes.map((route, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: route.lineColor || '#6b7280' }}
                >
                  {route.line}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white capitalize">{route.type}</span>
                    {route.direction && (
                      <span className="text-xs text-white/50">→ {route.direction}</span>
                    )}
                  </div>
                  <p className="text-xs text-white/60 mt-0.5">
                    {route.fromStop} → {route.toStop}
                    {route.stopsCount && ` (${route.stopsCount} arrêts)`}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                    {route.walkingToStation && (
                      <span>🚶 {route.walkingToStation} vers la station</span>
                    )}
                    <span>⏱ {route.duration}</span>
                    {route.walkingFromStation && (
                      <span>🚶 {route.walkingFromStation} vers destination</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tips */}
          {detailedInfo.tips && detailedInfo.tips.length > 0 && (
            <div className="pt-3 border-t border-white/10">
              <p className="text-xs text-white/50 mb-2">💡 Conseils</p>
              <ul className="text-xs text-white/70 space-y-1">
                {detailedInfo.tips.map((tip, idx) => (
                  <li key={idx}>• {tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Alternatives */}
          {detailedInfo.alternatives && detailedInfo.alternatives.length > 0 && (
            <div className="pt-3 border-t border-white/10">
              <p className="text-xs text-white/50 mb-2">Autres options</p>
              <div className="flex flex-wrap gap-2">
                {detailedInfo.alternatives.map((alt, idx) => (
                  <div key={idx} className="px-2 py-1 rounded bg-white/5 text-xs text-white/60">
                    {alt.mode} • {alt.duration} • {alt.cost}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Destination Image Component with AI generation
function DestinationImage({ destination, className }: { destination: string; className?: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(() => {
    // Check cache on initial render
    if (!destination) return null;
    const cacheKey = `dest_img_${destination.toLowerCase()}`;
    return sessionStorage.getItem(cacheKey);
  });
  const [loading, setLoading] = useState(() => {
    // Not loading if we have a cached image or no destination
    if (!destination) return false;
    const cacheKey = `dest_img_${destination.toLowerCase()}`;
    return !sessionStorage.getItem(cacheKey);
  });

  useEffect(() => {
    if (!destination || imageUrl) return;

    let isMounted = true;
    const cacheKey = `dest_img_${destination.toLowerCase()}`;

    // Fetch from API
    fetch(`/api/destinations/image?destination=${encodeURIComponent(destination)}`)
      .then(async res => {
        if (!res.ok) {
          // Try to parse as JSON, but handle HTML error pages
          const text = await res.text();
          try {
            return JSON.parse(text);
          } catch {
            return { error: 'Failed to load image' };
          }
        }
        return res.json();
      })
      .then(data => {
        if (isMounted && data.imageUrl) {
          setImageUrl(data.imageUrl);
          // Cache in session storage
          sessionStorage.setItem(cacheKey, data.imageUrl);
        }
      })
      .catch(err => {
        console.error('Failed to load destination image:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [destination, imageUrl]);

  if (loading) {
    return (
      <div className={`${className} bg-gradient-to-br from-amber-500/30 to-orange-600/30 animate-pulse`} />
    );
  }

  if (!imageUrl) {
    return (
      <div className={`${className} bg-gradient-to-br from-amber-500/30 to-orange-600/30 flex items-center justify-center`}>
        <Compass className="w-12 h-12 text-white/30" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={destination}
      className={className}
      onError={(e) => {
        // Fallback on error
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

// Landing Page Component
function LandingPage({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/background.jpg)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="h-14 sm:h-16 px-4 sm:px-6 flex justify-between items-center max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2 sm:gap-3">
            <img 
              src="/logo.png" 
              alt="Tripmind" 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg shadow-md"
            />
            <span className="text-lg sm:text-xl font-bold text-white">Tripmind</span>
          </div>
          {/* Desktop Navigation */}
          <div className="hidden sm:flex gap-3">
            <Button variant="ghost" onClick={onSignIn} className="text-white/90 hover:text-white hover:bg-white/10 h-9 px-4">
              Connexion
            </Button>
            <Button
              onClick={onSignUp}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white h-9 px-5"
            >
              Créer un compte
            </Button>
          </div>
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="sm:hidden text-white p-2 h-9 w-9"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <MoreVertical className="w-5 h-5" />}
          </Button>
        </div>
        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden absolute top-14 left-0 right-0 glass border-t border-white/10 p-4 flex flex-col gap-3">
            <Button 
              variant="ghost" 
              onClick={() => { setMobileMenuOpen(false); onSignIn(); }} 
              className="text-white/90 hover:text-white hover:bg-white/10 justify-start h-10"
            >
              Connexion
            </Button>
            <Button
              onClick={() => { setMobileMenuOpen(false); onSignUp(); }}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white h-10"
            >
              Créer un compte
            </Button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 sm:pt-32 pb-12 sm:pb-16 px-4 sm:px-6 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto text-center w-full">
          <Badge className="mb-3 sm:mb-4 bg-amber-500/20 text-amber-300 border-amber-500/30 backdrop-blur-sm text-[10px] sm:text-xs px-2 sm:px-3">
            ✨ Propulsé par l'IA
          </Badge>
          <h1 className="text-2xl sm:text-4xl lg:text-6xl font-bold text-white mb-3 sm:mb-5 leading-tight">
            Créez le voyage
            <br />
            <span className="gradient-text">
              de vos rêves
            </span>
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-white/80 mb-5 sm:mb-8 max-w-xl mx-auto px-1">
            Planifiez vos voyages avec l'aide de l'intelligence artificielle. 
            Itinéraires personnalisés et recommandations intelligentes.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center px-2">
            <Button
              size="default"
              onClick={onSignUp}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm sm:text-base px-5 sm:px-6 py-4 sm:py-5 shadow-lg shadow-amber-500/30"
            >
              Commencer gratuitement
              <ChevronRight className="ml-1.5 w-4 h-4" />
            </Button>
            <Button
              size="default"
              variant="outline"
              onClick={onSignIn}
              className="text-sm sm:text-base px-5 sm:px-6 py-4 sm:py-5 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
            >
              J'ai déjà un compte
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-12 sm:py-16 px-4 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/60 to-black/80" />
        <div className="max-w-7xl mx-auto relative">
          <h2 className="text-xl sm:text-2xl font-bold text-center text-white mb-6 sm:mb-10">
            Tout ce dont vous avez besoin
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            <Card className="glass-light border-white/10">
              <CardHeader className="p-3 sm:p-5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-2 sm:mb-3 shadow-lg shadow-amber-500/30">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <CardTitle className="text-white text-base sm:text-lg">Recommandations IA</CardTitle>
                <CardDescription className="text-white/60 text-xs sm:text-sm">
                  Itinéraires personnalisés basés sur vos préférences
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-light border-white/10">
              <CardHeader className="p-3 sm:p-5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center mb-2 sm:mb-3 shadow-lg shadow-rose-500/30">
                  <Edit className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <CardTitle className="text-white text-base sm:text-lg">Édition complète</CardTitle>
                <CardDescription className="text-white/60 text-xs sm:text-sm">
                  Modifiez chaque détail de votre voyage
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="glass-light border-white/10 sm:col-span-2 lg:col-span-1">
              <CardHeader className="p-3 sm:p-5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mb-2 sm:mb-3 shadow-lg shadow-emerald-500/30">
                  <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <CardTitle className="text-white text-base sm:text-lg">Partage facile</CardTitle>
                <CardDescription className="text-white/60 text-xs sm:text-sm">
                  Partagez vos carnets et exportez-les en PDF
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-6 sm:py-8 px-4 sm:px-6 bg-black/60 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-white/50 text-xs sm:text-sm">© 2024 Tripmind. Créé avec ❤️ pour les voyageurs.</p>
        </div>
      </footer>
    </div>
  );
}

// Auth Modal Component
function AuthModal({
  isOpen,
  mode,
  onClose,
  onSwitchMode,
}: {
  isOpen: boolean;
  mode: 'signin' | 'signup';
  onClose: () => void;
  onSwitchMode: () => void;
}) {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const result = await signIn(email, password);
        if (result.success) {
          onClose();
        } else {
          setError(result.error || 'Erreur de connexion');
        }
      } else {
        const result = await signUp(email, password, name);
        if (result.success) {
          onClose();
        } else {
          setError(result.error || 'Erreur lors de l\'inscription');
        }
      }
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'signin' ? 'Connexion' : 'Créer un compte'}</DialogTitle>
          <DialogDescription>
            {mode === 'signin'
              ? 'Connectez-vous pour accéder à vos carnets de voyage'
              : 'Créez votre compte pour commencer à planifier vos voyages'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="name">Nom (optionnel)</Label>
              <Input
                id="name"
                type="text"
                placeholder="Votre nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              {error}
            </div>
          )}
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'signin' ? 'Connexion...' : 'Inscription...'}
              </>
            ) : mode === 'signin' ? (
              'Se connecter'
            ) : (
              'Créer mon compte'
            )}
          </Button>
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === 'signin' ? (
              <>
                Pas encore de compte ?{' '}
                <button type="button" onClick={onSwitchMode} className="text-amber-600 hover:underline">
                  Créer un compte
                </button>
              </>
            ) : (
              <>
                Déjà un compte ?{' '}
                <button type="button" onClick={onSwitchMode} className="text-amber-600 hover:underline">
                  Se connecter
                </button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Dashboard Component
function Dashboard({
  trips,
  isLoading,
  onCreateTrip,
  onSelectTrip,
  onDeleteTrip,
}: {
  trips: Trip[];
  isLoading: boolean;
  onCreateTrip: () => void;
  onSelectTrip: (trip: Trip) => void;
  onDeleteTrip: (tripId: string) => void;
}) {
  const { user, signOut } = useAuth();

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getDaysCount = (trip: Trip) => {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const getDestinations = (trip: Trip) => {
    try {
      const dests = JSON.parse(trip.destinations);
      return Array.isArray(dests) ? dests.join(', ') : dests;
    } catch {
      return trip.destinations;
    }
  };

  // Get destination name (first destination)
  const getDestinationName = (trip: Trip): string => {
    return getDestinations(trip).split(',')[0].trim();
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/background.jpg)' }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/85" />
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="h-14 sm:h-16 px-4 sm:px-6 flex justify-between items-center max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2 sm:gap-3">
            <img 
              src="/logo.png" 
              alt="Tripmind" 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg shadow-md"
            />
            <span className="text-lg sm:text-xl font-bold text-white">Tripmind</span>
          </div>
          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm text-white/70">
              Bonjour, {user?.name || user?.email}
            </span>
            <Button variant="ghost" onClick={signOut} className="text-white/80 hover:text-white hover:bg-white/10 h-9 px-4">
              Déconnexion
            </Button>
          </div>
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="sm:hidden text-white p-2 h-9 w-9"
            onClick={() => signOut()}
          >
            <ExternalLink className="w-5 h-5" />
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative pt-20 sm:pt-24 pb-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Mes voyages</h1>
              <p className="text-white/60 mt-1 text-sm sm:text-base">
                Planifiez et organisez vos aventures
              </p>
            </div>
            <Button
              onClick={onCreateTrip}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau voyage
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : trips.length === 0 ? (
            <Card className="glass-light border-white/10">
              <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                  <Plane className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2 text-center">
                  Aucun voyage pour le moment
                </h3>
                <p className="text-white/50 text-center max-w-md mb-6 text-sm sm:text-base">
                  Commencez par créer votre premier carnet de voyage et laissez l'IA vous guider.
                </p>
                <Button
                  onClick={onCreateTrip}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Créer mon premier voyage
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {trips.map((trip) => (
                <Card
                  key={trip.id}
                  className="glass-light border-white/10 hover:border-white/20 transition-all cursor-pointer group overflow-hidden relative"
                  onClick={() => onSelectTrip(trip)}
                >
                  {/* Background Image */}
                  <div className="absolute inset-0 z-0">
                    <DestinationImage
                      destination={getDestinationName(trip)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/40" />
                  </div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <Badge
                          variant={trip.status === 'draft' ? 'secondary' : 'default'}
                          className={
                            trip.status === 'draft'
                              ? 'bg-white/20 text-white/90 backdrop-blur-sm'
                              : 'bg-emerald-500/30 text-emerald-200 border-emerald-500/30 backdrop-blur-sm'
                          }
                        >
                          {trip.status === 'draft' ? 'Brouillon' : 'Actif'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 hover:bg-white/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTrip(trip.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <CardTitle className="text-lg text-white mt-2">{trip.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1 text-white/80">
                        <MapPin className="w-3 h-3" />
                        {getDestinations(trip)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-3 text-sm text-white/70">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(trip.startDate)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {getDaysCount(trip)} jour(s)
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {trip.days?.reduce((acc, d) => acc + (d.events?.length || 0), 0)} activité(s)
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0">
                      <Button
                        variant="ghost"
                        className="w-full text-amber-400 hover:text-amber-300 hover:bg-white/20"
                      >
                        Voir le carnet
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardFooter>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Trip Creation Wizard
function TripWizard({
  isOpen,
  onClose,
  onComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (trip: Trip) => void;
}) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<TripFormData>({
    title: '',
    destinations: [],
    startDate: '',
    endDate: '',
    travelers: {
      adults: 1,
      children: [],
      hasPets: false,
    },
    preferences: {
      pace: 50,
      budget: 50,
      interests: [],
      accessibility: false,
      dietary: [],
      alreadyVisited: [],
      mustSee: [],
    },
  });

  const [destinationInput, setDestinationInput] = useState('');
  const [childAgeInput, setChildAgeInput] = useState('');

  const interestOptions = [
    { id: 'culture', label: 'Culture', icon: Palette },
    { id: 'nature', label: 'Nature', icon: Mountain },
    { id: 'gastronomy', label: 'Gastronomie', icon: Utensils },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
    { id: 'sports', label: 'Sport', icon: Mountain },
    { id: 'nightlife', label: 'Vie nocturne', icon: Music },
    { id: 'wellness', label: 'Bien-être', icon: Heart },
    { id: 'adventure', label: 'Aventure', icon: Compass },
    { id: 'family', label: 'Familial', icon: Baby },
  ];

  const dietaryOptions = [
    { id: 'vegetarian', label: 'Végétarien' },
    { id: 'vegan', label: 'Vegan' },
    { id: 'halal', label: 'Halal' },
    { id: 'kosher', label: 'Casher' },
    { id: 'gluten-free', label: 'Sans gluten' },
  ];

  const addDestination = () => {
    if (destinationInput.trim() && !formData.destinations.includes(destinationInput.trim())) {
      setFormData({
        ...formData,
        destinations: [...formData.destinations, destinationInput.trim()],
      });
      setDestinationInput('');
    }
  };

  const removeDestination = (dest: string) => {
    setFormData({
      ...formData,
      destinations: formData.destinations.filter((d) => d !== dest),
    });
  };

  const addChild = () => {
    const age = parseInt(childAgeInput);
    if (!isNaN(age) && age >= 0 && age <= 17) {
      setFormData({
        ...formData,
        travelers: {
          ...formData.travelers,
          children: [...formData.travelers.children, age],
        },
      });
      setChildAgeInput('');
    }
  };

  const removeChild = (index: number) => {
    setFormData({
      ...formData,
      travelers: {
        ...formData.travelers,
        children: formData.travelers.children.filter((_, i) => i !== index),
      },
    });
  };

  const toggleInterest = (interestId: string) => {
    const interests = formData.preferences.interests.includes(interestId)
      ? formData.preferences.interests.filter((i) => i !== interestId)
      : [...formData.preferences.interests, interestId];
    setFormData({
      ...formData,
      preferences: {
        ...formData.preferences,
        interests,
      },
    });
  };

  const toggleDietary = (dietaryId: string) => {
    const dietary = formData.preferences.dietary.includes(dietaryId)
      ? formData.preferences.dietary.filter((d) => d !== dietaryId)
      : [...formData.preferences.dietary, dietaryId];
    setFormData({
      ...formData,
      preferences: {
        ...formData.preferences,
        dietary,
      },
    });
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Create trip
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title || `Voyage à ${formData.destinations[0] || 'Destination'}`,
          destinations: formData.destinations,
          startDate: formData.startDate,
          endDate: formData.endDate,
          travelers: formData.travelers,
          preferences: formData.preferences,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        onComplete(data.trip);
      }
    } catch (error) {
      console.error('Error creating trip:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.destinations.length > 0 && formData.startDate && formData.endDate;
      case 2:
        return true;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const getStep1Validation = () => {
    return {
      hasDestinations: formData.destinations.length > 0,
      hasStartDate: !!formData.startDate,
      hasEndDate: !!formData.endDate,
    };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg sm:text-xl">Créer un nouveau voyage</DialogTitle>
          <DialogDescription className="text-sm">
            Étape {step} sur 3 -{' '}
            {step === 1 ? 'Essentiel' : step === 2 ? 'Profil de voyage' : 'Contraintes'}
          </DialogDescription>
        </DialogHeader>

        <Progress value={(step / 3) * 100} className="h-2" />

        <ScrollArea className="flex-1 pr-2 sm:pr-4 -mr-2 sm:-mr-4">
          {/* Step 1: Essential */}
          {step === 1 && (() => {
            const validation = getStep1Validation();
            return (
            <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  Destination(s)
                  {!validation.hasDestinations && <span className="text-red-500 text-xs">(requis)</span>}
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paris, Tokyo..."
                    value={destinationInput}
                    onChange={(e) => setDestinationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addDestination();
                      }
                    }}
                    className={!validation.hasDestinations ? 'border-red-300 focus:border-red-500' : ''}
                  />
                  <Button type="button" onClick={addDestination} variant="secondary" className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.destinations.map((dest) => (
                    <Badge key={dest} variant="secondary" className="gap-1">
                      <MapPin className="w-3 h-3" />
                      <span className="max-w-[100px] truncate">{dest}</span>
                      <button onClick={() => removeDestination(dest)} className="ml-1 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    Date de début
                    {!validation.hasStartDate && <span className="text-red-500 text-xs">(requis)</span>}
                  </Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className={!validation.hasStartDate ? 'border-red-300 focus:border-red-500' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    Date de fin
                    {!validation.hasEndDate && <span className="text-red-500 text-xs">(requis)</span>}
                  </Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    min={formData.startDate}
                    className={!validation.hasEndDate ? 'border-red-300 focus:border-red-500' : ''}
                  />
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <Label className="text-sm">Voyageurs</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm text-slate-500">Adultes</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            travelers: {
                              ...formData.travelers,
                              adults: Math.max(1, formData.travelers.adults - 1),
                            },
                          })
                        }
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-medium">{formData.travelers.adults}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            travelers: {
                              ...formData.travelers,
                              adults: formData.travelers.adults + 1,
                            },
                          })
                        }
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-500">Enfants (âge)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Âge"
                        min="0"
                        max="17"
                        value={childAgeInput}
                        onChange={(e) => setChildAgeInput(e.target.value)}
                        className="w-20"
                      />
                      <Button type="button" onClick={addChild} variant="secondary" size="sm">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {formData.travelers.children.map((age, index) => (
                        <Badge key={index} variant="outline" className="gap-1">
                          {age} ans
                          <button onClick={() => removeChild(index)} className="hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pets"
                    checked={formData.travelers.hasPets}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        travelers: { ...formData.travelers, hasPets: checked as boolean },
                      })
                    }
                  />
                  <Label htmlFor="pets" className="text-sm font-normal">
                    Je voyage avec un animal de compagnie
                  </Label>
                </div>
              </div>
            </div>
            );
          })()}

          {/* Step 2: Profile */}
          {step === 2 && (
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <Label>Rythme de voyage</Label>
                <div className="space-y-2">
                  <Slider
                    value={[formData.preferences.pace]}
                    onValueChange={([value]) =>
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, pace: value },
                      })
                    }
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Reposé</span>
                    <span>Équilibré</span>
                    <span>Intense</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Budget</Label>
                <div className="space-y-2">
                  <Slider
                    value={[formData.preferences.budget]}
                    onValueChange={([value]) =>
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, budget: value },
                      })
                    }
                    max={100}
                    step={1}
                  />
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Économique</span>
                    <span>Confort</span>
                    <span>Luxe</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Centres d'intérêt</Label>
                <div className="grid grid-cols-3 gap-2">
                  {interestOptions.map((interest) => {
                    const Icon = interest.icon;
                    return (
                      <Button
                        key={interest.id}
                        type="button"
                        variant={
                          formData.preferences.interests.includes(interest.id) ? 'default' : 'outline'
                        }
                        className={`justify-start ${
                          formData.preferences.interests.includes(interest.id)
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : ''
                        }`}
                        onClick={() => toggleInterest(interest.id)}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {interest.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Constraints */}
          {step === 3 && (
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="accessibility"
                    checked={formData.preferences.accessibility}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, accessibility: checked as boolean },
                      })
                    }
                  />
                  <Label htmlFor="accessibility" className="flex items-center gap-2">
                    <Accessibility className="w-4 h-4" />
                    Accessibilité PMR requise
                  </Label>
                </div>
              </div>

              <div className="space-y-4">
                <Label>Régimes alimentaires</Label>
                <div className="flex flex-wrap gap-2">
                  {dietaryOptions.map((diet) => (
                    <Button
                      key={diet.id}
                      type="button"
                      size="sm"
                      variant={formData.preferences.dietary.includes(diet.id) ? 'default' : 'outline'}
                      className={
                        formData.preferences.dietary.includes(diet.id)
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : ''
                      }
                      onClick={() => toggleDietary(diet.id)}
                    >
                      {diet.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lieux déjà visités (à éviter)</Label>
                <Textarea
                  placeholder="Listez les lieux que vous avez déjà visités et que vous préférez éviter..."
                  value={formData.preferences.alreadyVisited.join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      preferences: {
                        ...formData.preferences,
                        alreadyVisited: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <Label>Incontournables à voir absolument</Label>
                </div>
                <Textarea
                  placeholder="Listez les lieux que vous voulez absolument visiter (séparés par des virgules)..."
                  value={formData.preferences.mustSee.join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      preferences: {
                        ...formData.preferences,
                        mustSee: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      },
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Titre du voyage (optionnel)</Label>
                <Input
                  id="title"
                  placeholder="Mon voyage à Paris"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
            </div>
          )}
        </ScrollArea>

        <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 pt-3 sm:pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            disabled={isLoading}
            className="order-2 sm:order-1"
          >
            {step > 1 ? (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Précédent
              </>
            ) : (
              'Annuler'
            )}
          </Button>
          <Button
            onClick={() => (step < 3 ? setStep(step + 1) : handleSubmit())}
            disabled={!canProceed() || isLoading}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 order-1 sm:order-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Création...
              </>
            ) : step < 3 ? (
              <>
                Suivant
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Créer
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// AI Generation Status Types
interface GenerationStatus {
  step: 'idle' | 'connecting' | 'analyzing' | 'generating' | 'enriching' | 'finalizing' | 'success' | 'error';
  message: string;
  retryCount: number;
  maxRetries: number;
  progress: number; // 0-100
}

// AI Generation Overlay Component
function AIGenerationOverlay({ 
  status, 
  onCancel 
}: { 
  status: GenerationStatus; 
  onCancel: () => void;
}) {
  const stepIcons = {
    idle: <Sparkles className="w-8 h-8" />,
    connecting: <Loader2 className="w-8 h-8 animate-spin" />,
    analyzing: <Compass className="w-8 h-8 animate-pulse" />,
    generating: <Sparkles className="w-8 h-8 animate-bounce" />,
    enriching: <Star className="w-8 h-8 animate-pulse" />,
    finalizing: <Check className="w-8 h-8" />,
    success: <Check className="w-8 h-8" />,
    error: <X className="w-8 h-8" />,
  };

  const stepColors = {
    idle: 'from-slate-400 to-slate-500',
    connecting: 'from-amber-400 to-orange-500',
    analyzing: 'from-amber-400 to-orange-500',
    generating: 'from-amber-400 to-orange-500',
    enriching: 'from-amber-400 to-orange-500',
    finalizing: 'from-emerald-400 to-teal-500',
    success: 'from-emerald-400 to-teal-500',
    error: 'from-rose-400 to-red-500',
  };

  const steps = [
    { id: 'connecting', label: 'Connexion' },
    { id: 'analyzing', label: 'Analyse' },
    { id: 'generating', label: 'Génération' },
    { id: 'enriching', label: 'Enrichissement' },
    { id: 'finalizing', label: 'Finalisation' },
  ];

  const getCurrentStepIndex = () => {
    const stepOrder = ['connecting', 'analyzing', 'generating', 'enriching', 'finalizing'];
    return stepOrder.indexOf(status.step);
  };

  const isStepComplete = (stepId: string) => {
    const stepOrder = ['connecting', 'analyzing', 'generating', 'enriching', 'finalizing'];
    const currentIndex = getCurrentStepIndex();
    const stepIndex = stepOrder.indexOf(stepId);
    return stepIndex < currentIndex || status.step === 'success';
  };

  const isStepActive = (stepId: string) => {
    return status.step === stepId;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <Card className="glass-light border-white/20 overflow-hidden">
          {/* Header with animated gradient */}
          <div className={`h-2 bg-gradient-to-r ${stepColors[status.step]}`} />
          
          <CardContent className="p-8">
            {/* Main Icon */}
            <div className="flex justify-center mb-6">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${stepColors[status.step]} flex items-center justify-center shadow-lg`}>
                <div className="text-white">
                  {stepIcons[status.step]}
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-white text-center mb-2">
              {status.step === 'success' ? 'Génération terminée !' : 
               status.step === 'error' ? 'Une erreur est survenue' :
               'Création de votre itinéraire'}
            </h2>

            {/* Message */}
            <p className="text-white/70 text-center mb-6">
              {status.message}
            </p>

            {/* Progress Bar */}
            {status.step !== 'idle' && status.step !== 'error' && (
              <div className="mb-6">
                <div className="flex justify-between text-xs text-white/50 mb-2">
                  <span>Progression</span>
                  <span>{Math.round(status.progress)}%</span>
                </div>
                <Progress 
                  value={status.progress} 
                  className="h-2 bg-white/10"
                />
              </div>
            )}

            {/* Step Indicators */}
            {status.step !== 'idle' && status.step !== 'error' && status.step !== 'success' && (
              <div className="flex justify-between mb-6">
                {steps.map((step, index) => (
                  <div 
                    key={step.id}
                    className="flex flex-col items-center"
                  >
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all
                      ${isStepComplete(step.id) 
                        ? 'bg-emerald-500 text-white' 
                        : isStepActive(step.id)
                          ? 'bg-amber-500 text-white animate-pulse'
                          : 'bg-white/10 text-white/50'
                      }
                    `}>
                      {isStepComplete(step.id) ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className={`
                      text-xs mt-1 transition-all
                      ${isStepActive(step.id) ? 'text-amber-400' : 'text-white/40'}
                    `}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Retry Indicator */}
            {status.retryCount > 0 && status.step !== 'success' && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Tentative {status.retryCount}/{status.maxRetries}
                </Badge>
              </div>
            )}

            {/* Error Actions */}
            {status.step === 'error' && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-white/50 text-center">
                  Le service IA est temporairement indisponible. Veuillez réessayer dans quelques instants.
                </p>
                <Button
                  onClick={onCancel}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4 mr-2" />
                  Fermer
                </Button>
              </div>
            )}

            {/* Cancel Button */}
            {status.step !== 'error' && status.step !== 'success' && (
              <Button
                onClick={onCancel}
                variant="ghost"
                className="w-full text-white/50 hover:text-white hover:bg-white/10"
              >
                Annuler
              </Button>
            )}

            {/* Success Animation */}
            {status.step === 'success' && (
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-5 h-5" />
                  <span>Votre itinéraire est prêt !</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Decorative Elements */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
}

// Trip Info Section Component - "À savoir"
function TripInfoSection({ 
  destinations, 
  tripInfo, 
  loadingSections,
  onRefreshSection,
  onLoadAll
}: { 
  destinations: string; 
  tripInfo: any;
  loadingSections: Record<string, boolean>;
  onRefreshSection: (section: string) => Promise<void>;
  onLoadAll: () => Promise<void>;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ vocabulary: true });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Check if any section is loading
  const isLoading = Object.values(loadingSections).some(v => v);
  
  // Check if no data at all
  const hasNoData = !tripInfo || Object.keys(tripInfo).length === 0;

  if (hasNoData && !isLoading) {
    return (
      <Card className="glass-light border-white/10">
        <CardContent className="py-12 text-center">
          <Info className="w-12 h-12 mx-auto text-white/30 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Aucune information disponible</h3>
          <p className="text-white/60 mb-4">
            Cliquez sur le bouton ci-dessous pour générer les informations pratiques pour votre voyage.
          </p>
          <Button onClick={onLoadAll}>
            <Sparkles className="w-4 h-4 mr-2" />
            Générer toutes les informations
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Section configuration
  const sections = [
    { id: 'vocabulary', title: 'Vocabulaire essentiel', icon: MessageSquare, color: 'indigo', show: tripInfo?.vocabulary },
    { id: 'gastronomy', title: 'Gastronomie locale', icon: Utensils, color: 'orange', show: tripInfo?.gastronomy },
    { id: 'customs', title: 'Coutumes et culture', icon: Users, color: 'amber', show: tripInfo?.customs },
    { id: 'currency', title: 'Monnaie et budget', icon: Euro, color: 'emerald', show: tripInfo?.currency },
    { id: 'prices', title: 'Ordre de prix', icon: ShoppingBag, color: 'amber', show: tripInfo?.prices },
    { id: 'prohibitions', title: 'Interdits et arnaques', icon: AlertTriangle, color: 'rose', show: tripInfo?.prohibitions },
    { id: 'mustSee', title: 'Incontournables', icon: Star, color: 'amber', show: tripInfo?.mustSee },
    { id: 'transportation', title: 'Transports', icon: Plane, color: 'sky', show: tripInfo?.transportation },
    { id: 'practicalTips', title: 'Conseils pratiques', icon: Lightbulb, color: 'amber', show: tripInfo?.practicalTips },
    { id: 'weather', title: 'Météo et climat', icon: Sun, color: 'amber', show: tripInfo?.weather },
    { id: 'emergency', title: 'Urgences', icon: Phone, color: 'rose', show: tripInfo?.emergency },
  ];

  // Helper to check if array/object has content
  const hasContent = (data: any) => {
    if (!data) return false;
    if (Array.isArray(data)) return data.length > 0;
    if (typeof data === 'object') return Object.keys(data).length > 0;
    return !!data;
  };

  // Helper to check if specialty is an object or string
  const getSpecialtyName = (s: any) => typeof s === 'string' ? s : s?.name || '';
  const getSpecialtyDesc = (s: any) => typeof s === 'object' ? s?.description : '';
  const getSpecialtyWhere = (s: any) => typeof s === 'object' ? s?.whereToTry : '';
  
  // Helper for drinks
  const getDrinkName = (d: any) => typeof d === 'string' ? d : d?.name || '';
  const getDrinkDesc = (d: any) => typeof d === 'object' ? d?.description : '';
  
  // Helper for mustSee
  const getMustSeeName = (m: any) => typeof m === 'string' ? m : m?.name || '';
  const getMustSeeWhy = (m: any) => typeof m === 'object' ? m?.why : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">À savoir avant de partir</h2>
          <p className="text-white/60 text-sm">Guide pratique pour {destinations}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onLoadAll} disabled={isLoading} className="border-white/20 text-white hover:bg-white/10">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      {/* Section loader skeleton */}
      {isLoading && !tripInfo && (
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="glass-light border-white/10">
              <CardHeader>
                <Skeleton className="h-6 w-48 bg-white/10" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full bg-white/10" />
                <Skeleton className="h-4 w-3/4 bg-white/10" />
                <Skeleton className="h-4 w-1/2 bg-white/10" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* VOCABULARY - Full Width */}
      {(hasContent(tripInfo?.vocabulary) || loadingSections.vocabulary) && (
        <Card className="glass-light border-white/10 border-indigo-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center justify-between">
              <span 
                className="flex items-center gap-2 cursor-pointer" 
                onClick={() => toggleSection('vocabulary')}
              >
                <MessageSquare className="w-5 h-5 text-indigo-400" />
                Vocabulaire essentiel
                <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${expandedSections.vocabulary ? 'rotate-180' : ''}`} />
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onRefreshSection('vocabulary')} 
                disabled={loadingSections.vocabulary}
                className="h-7 px-2 text-white/50 hover:text-white"
              >
                {loadingSections.vocabulary ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </Button>
            </CardTitle>
          </CardHeader>
          {loadingSections.vocabulary && !tripInfo?.vocabulary ? (
            <CardContent><Skeleton className="h-20 w-full bg-white/10" /></CardContent>
          ) : expandedSections.vocabulary && tripInfo?.vocabulary && (
            <CardContent className="space-y-4">
              {/* Basic expressions */}
              {tripInfo.vocabulary.basics?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Expressions de base</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {tripInfo.vocabulary.basics.map((item: any, i: number) => (
                      <div key={i} className="bg-white/5 rounded-lg p-2">
                        <p className="text-sm font-medium text-white">{item.phrase}</p>
                        <p className="text-xs text-white/50">{item.translation}</p>
                        {item.pronunciation && (
                          <p className="text-xs text-indigo-400/70 italic">[{item.pronunciation}]</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Polite expressions */}
              {tripInfo.vocabulary.politeExpressions?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Politesse</p>
                  <div className="flex flex-wrap gap-2">
                    {tripInfo.vocabulary.politeExpressions.map((item: any, i: number) => (
                      <Badge key={i} variant="outline" className="border-indigo-500/30 text-indigo-300">
                        {item.phrase} → {item.translation}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* Food terms */}
              {tripInfo.vocabulary.foodTerms?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Termes culinaires</p>
                  <div className="flex flex-wrap gap-2">
                    {tripInfo.vocabulary.foodTerms.map((item: any, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-white/10 text-white/80">
                        {item.term} = {item.translation}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* Useful phrases */}
              {tripInfo.vocabulary.usefulPhrases?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Phrases utiles</p>
                  <div className="space-y-1">
                    {tripInfo.vocabulary.usefulPhrases.map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-white">{item.phrase}</span>
                        <span className="text-white/40">→</span>
                        <span className="text-white/60">{item.translation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* GASTRONOMY - Enhanced */}
      {(hasContent(tripInfo?.gastronomy) || loadingSections.gastronomy) && (
        <Card className="glass-light border-white/10 border-orange-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-orange-400" />
                Gastronomie locale
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onRefreshSection('gastronomy')} 
                disabled={loadingSections.gastronomy}
                className="h-7 px-2 text-white/50 hover:text-white"
              >
                {loadingSections.gastronomy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              </Button>
            </CardTitle>
          </CardHeader>
          {loadingSections.gastronomy && !tripInfo?.gastronomy ? (
            <CardContent><Skeleton className="h-32 w-full bg-white/10" /></CardContent>
          ) : tripInfo?.gastronomy && (
          <CardContent className="space-y-4">
            {/* Specialties with descriptions */}
            {tripInfo.gastronomy.specialties?.length > 0 && (
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Spécialités à goûter</p>
                <div className="space-y-3">
                  {tripInfo.gastronomy.specialties.map((s: any, i: number) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3">
                      <p className="text-sm font-medium text-orange-300">{getSpecialtyName(s)}</p>
                      {getSpecialtyDesc(s) && (
                        <p className="text-xs text-white/60 mt-1">{getSpecialtyDesc(s)}</p>
                      )}
                      {getSpecialtyWhere(s) && (
                        <p className="text-xs text-white/40 mt-1 italic">📍 {getSpecialtyWhere(s)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Drinks */}
            {tripInfo.gastronomy.drinks?.length > 0 && (
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Boissons typiques</p>
                <div className="grid grid-cols-2 gap-2">
                  {tripInfo.gastronomy.drinks.map((d: any, i: number) => (
                    <div key={i} className="bg-white/5 rounded-lg p-2">
                      <p className="text-sm text-white">{getDrinkName(d)}</p>
                      {getDrinkDesc(d) && (
                        <p className="text-xs text-white/50">{getDrinkDesc(d)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Street Food */}
            {tripInfo.gastronomy.streetFood?.length > 0 && (
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Street food</p>
                <div className="flex flex-wrap gap-2">
                  {tripInfo.gastronomy.streetFood.map((item: string, i: number) => (
                    <Badge key={i} variant="outline" className="border-orange-500/30 text-orange-300">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {/* Meal times */}
            {tripInfo.gastronomy.mealTimes && (
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Horaires des repas</p>
                <p className="text-sm text-white/80">{tripInfo.gastronomy.mealTimes}</p>
              </div>
            )}
            {/* Food etiquette */}
            {tripInfo.gastronomy.foodEtiquette?.length > 0 && (
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Étiquette à table</p>
                <ul className="space-y-1">
                  {tripInfo.gastronomy.foodEtiquette.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                      <span className="text-orange-400">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
          )}
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        {/* Customs & Culture - Enhanced */}
        {(hasContent(tripInfo?.customs) || loadingSections.customs) && (
          <Card className="glass-light border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  Coutumes et culture
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onRefreshSection('customs')} 
                  disabled={loadingSections.customs}
                  className="h-7 px-2 text-white/50 hover:text-white"
                >
                  {loadingSections.customs ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </Button>
              </CardTitle>
            </CardHeader>
            {loadingSections.customs && !tripInfo?.customs ? (
              <CardContent><Skeleton className="h-24 w-full bg-white/10" /></CardContent>
            ) : tripInfo?.customs && (
            <CardContent className="space-y-3">
              {tripInfo.customs.greetings && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Salutations</p>
                  <p className="text-sm text-white/80">{tripInfo.customs.greetings}</p>
                </div>
              )}
              {tripInfo.customs.tipping && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Pourboires</p>
                  <p className="text-sm text-white/80">{tripInfo.customs.tipping}</p>
                </div>
              )}
              {tripInfo.customs.dress && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Tenues</p>
                  <p className="text-sm text-white/80">{tripInfo.customs.dress}</p>
                </div>
              )}
              {tripInfo.customs.behavior && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Comportement</p>
                  <p className="text-sm text-white/80">{tripInfo.customs.behavior}</p>
                </div>
              )}
              {tripInfo.customs.culturalNuances?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Nuances culturelles</p>
                  <ul className="space-y-1">
                    {tripInfo.customs.culturalNuances.map((item: string, i: number) => (
                      <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                        <span className="text-amber-400">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
            )}
          </Card>
        )}

        {/* Currency & Budget - Enhanced */}
        {(hasContent(tripInfo?.currency) || loadingSections.currency) && (
          <Card className="glass-light border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Euro className="w-5 h-5 text-emerald-400" />
                Monnaie et budget
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tripInfo.currency.name && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Monnaie</p>
                  <p className="text-sm text-white/80 font-medium">{tripInfo.currency.name}</p>
                </div>
              )}
              {tripInfo.currency.exchangeRate && (
                <div className="bg-emerald-500/10 rounded-lg p-2">
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Taux de change</p>
                  <p className="text-sm text-emerald-300 font-mono">{tripInfo.currency.exchangeRate}</p>
                </div>
              )}
              {tripInfo.currency.paymentMethods?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Moyens de paiement</p>
                  <div className="flex flex-wrap gap-2">
                    {tripInfo.currency.paymentMethods.map((p: string, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-white/10 text-white/80">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {tripInfo.currency.budget && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Budget quotidien</p>
                  <p className="text-sm text-white/80">{tripInfo.currency.budget}</p>
                </div>
              )}
              {tripInfo.currency.tippingGuide && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Guide des pourboires</p>
                  <p className="text-sm text-white/70">{tripInfo.currency.tippingGuide}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* PRICES - Enhanced */}
      {hasContent(tripInfo.prices) && (
        <Card className="glass-light border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              Ordre de prix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {tripInfo.prices.coffee && (
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <span className="text-2xl">☕</span>
                  <p className="text-xs text-white/50 mt-1">Café</p>
                  <p className="text-sm font-medium text-white">{tripInfo.prices.coffee}</p>
                </div>
              )}
              {tripInfo.prices.meal && (
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <span className="text-2xl">🍽️</span>
                  <p className="text-xs text-white/50 mt-1">Repas simple</p>
                  <p className="text-sm font-medium text-white">{tripInfo.prices.meal}</p>
                </div>
              )}
              {tripInfo.prices.restaurant && (
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <span className="text-2xl">🥂</span>
                  <p className="text-xs text-white/50 mt-1">Restaurant</p>
                  <p className="text-sm font-medium text-white">{tripInfo.prices.restaurant}</p>
                </div>
              )}
              {tripInfo.prices.transport && (
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <span className="text-2xl">🚌</span>
                  <p className="text-xs text-white/50 mt-1">Transport</p>
                  <p className="text-sm font-medium text-white">{tripInfo.prices.transport}</p>
                </div>
              )}
              {tripInfo.prices.taxi && (
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <span className="text-2xl">🚕</span>
                  <p className="text-xs text-white/50 mt-1">Taxi</p>
                  <p className="text-sm font-medium text-white">{tripInfo.prices.taxi}</p>
                </div>
              )}
              {tripInfo.prices.hotel && (
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <span className="text-2xl">🏨</span>
                  <p className="text-xs text-white/50 mt-1">Hôtel/nuit</p>
                  <p className="text-sm font-medium text-white">{tripInfo.prices.hotel}</p>
                </div>
              )}
              {tripInfo.prices.museum && (
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <span className="text-2xl">🏛️</span>
                  <p className="text-xs text-white/50 mt-1">Musée</p>
                  <p className="text-sm font-medium text-white">{tripInfo.prices.museum}</p>
                </div>
              )}
              {tripInfo.prices.grocery && (
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <span className="text-2xl">🛒</span>
                  <p className="text-xs text-white/50 mt-1">Courses</p>
                  <p className="text-sm font-medium text-white">{tripInfo.prices.grocery}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SCAMS - Important */}
      {tripInfo.scams?.length > 0 && (
        <Card className="glass-light border-white/10 border-yellow-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-yellow-400" />
              Arnaques à éviter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {tripInfo.scams.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80 bg-yellow-500/5 rounded-lg p-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Prohibitions */}
      {tripInfo.prohibitions?.length > 0 && (
        <Card className="glass-light border-white/10 border-rose-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              À éviter et interdits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {tripInfo.prohibitions.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                  <X className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* MUST SEE & HIDDEN GEMS */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        {tripInfo.mustSee?.length > 0 && (
          <Card className="glass-light border-white/10 border-amber-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-400" />
                Incontournables
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {tripInfo.mustSee.map((item: any, i: number) => (
                  <li key={i} className="bg-white/5 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-300">{getMustSeeName(item)}</p>
                    {getMustSeeWhy(item) && (
                      <p className="text-xs text-white/60 mt-1">{getMustSeeWhy(item)}</p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {tripInfo.hiddenGems?.length > 0 && (
          <Card className="glass-light border-white/10 border-purple-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Gem className="w-5 h-5 text-purple-400" />
                Pépites cachées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {tripInfo.hiddenGems.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                    <Sparkles className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* TRANSPORTATION */}
      {hasContent(tripInfo.transportation) && (
        <Card className="glass-light border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Plane className="w-5 h-5 text-sky-400" />
              Transports
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tripInfo.transportation.fromAirport && (
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Depuis l'aéroport</p>
                <p className="text-sm text-white/80">{tripInfo.transportation.fromAirport}</p>
              </div>
            )}
            {tripInfo.transportation.localTransport && (
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Transport local</p>
                <p className="text-sm text-white/80">{tripInfo.transportation.localTransport}</p>
              </div>
            )}
            {tripInfo.transportation.tips?.length > 0 && (
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Conseils transport</p>
                <ul className="space-y-1">
                  {tripInfo.transportation.tips.map((tip: string, i: number) => (
                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                      <span className="text-sky-400">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Practical Tips */}
      {tripInfo.practicalTips?.length > 0 && (
        <Card className="glass-light border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              Conseils pratiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid sm:grid-cols-2 gap-2">
              {tripInfo.practicalTips.map((tip: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80 bg-white/5 rounded-lg p-2">
                  <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Weather & Emergency */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        {hasContent(tripInfo.weather) && (
          <Card className="glass-light border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Sun className="w-5 h-5 text-amber-400" />
                Météo et climat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tripInfo.weather.bestPeriod && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Meilleure période</p>
                  <p className="text-sm text-white/80">{tripInfo.weather.bestPeriod}</p>
                </div>
              )}
              {tripInfo.weather.climateInfo && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Info climat</p>
                  <p className="text-sm text-white/70">{tripInfo.weather.climateInfo}</p>
                </div>
              )}
              {tripInfo.weather.whatToPack?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-2">À emporter</p>
                  <div className="flex flex-wrap gap-2">
                    {tripInfo.weather.whatToPack.map((item: string, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-white/10 text-white/80">{item}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {hasContent(tripInfo.emergency) && (
          <Card className="glass-light border-white/10 border-rose-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Phone className="w-5 h-5 text-rose-400" />
                Urgences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {tripInfo.emergency.police && (
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <span className="text-lg">🚔</span>
                    <p className="text-xs text-white/50">Police</p>
                    <p className="text-sm font-medium text-white">{tripInfo.emergency.police}</p>
                  </div>
                )}
                {tripInfo.emergency.ambulance && (
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <span className="text-lg">🚑</span>
                    <p className="text-xs text-white/50">Ambulance</p>
                    <p className="text-sm font-medium text-white">{tripInfo.emergency.ambulance}</p>
                  </div>
                )}
              </div>
              {tripInfo.emergency.embassy && (
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-xs text-white/50 mb-1">🇫🇷 Ambassade de France</p>
                  <p className="text-sm text-white/80">{tripInfo.emergency.embassy}</p>
                </div>
              )}
              {tripInfo.emergency.usefulApps?.length > 0 && (
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Applications utiles</p>
                  <div className="space-y-1">
                    {tripInfo.emergency.usefulApps.map((app: string, i: number) => (
                      <p key={i} className="text-xs text-white/60 flex items-center gap-2">
                        <Smartphone className="w-3 h-3" />
                        {app}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Trip Editor Component
function TripEditor({
  trip,
  onBack,
  onTripUpdate,
}: {
  trip: Trip;
  onBack: () => void;
  onTripUpdate: (trip: Trip) => void;
}) {
  const { toast } = useToast();
  const [selectedDay, setSelectedDay] = useState(0);
  const [activeTab, setActiveTab] = useState<'days' | 'info'>('days');
  const [tripInfo, setTripInfo] = useState<any>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [loadingSections, setLoadingSections] = useState<Record<string, boolean>>({});
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
    step: 'idle',
    message: '',
    retryCount: 0,
    maxRetries: 3,
    progress: 0,
  });
  const [enrichingEventId, setEnrichingEventId] = useState<string | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [attachmentsEventId, setAttachmentsEventId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [newEventData, setNewEventData] = useState({
    type: 'visit',
    title: '',
    description: '',
    startTime: '',
    locationName: '',
  });

  // All sections that can be loaded
  const INFO_SECTIONS = ['vocabulary', 'gastronomy', 'customs', 'currency', 'prices', 'prohibitions', 'mustSee', 'transportation', 'weather', 'emergency'];

  // Parse current preferences and travelers from trip
  const getCurrentPreferences = () => {
    try {
      const prefs = JSON.parse(trip.preferences);
      return {
        pace: prefs.pace ?? 50,
        budget: prefs.budget ?? 50,
        interests: prefs.interests ?? [],
        accessibility: prefs.accessibility ?? false,
        dietary: prefs.dietary ?? [],
        alreadyVisited: prefs.alreadyVisited ?? [],
        mustSee: prefs.mustSee ?? [],
      };
    } catch {
      return {
        pace: 50,
        budget: 50,
        interests: [],
        accessibility: false,
        dietary: [],
        alreadyVisited: [],
        mustSee: [],
      };
    }
  };

  const getCurrentTravelers = () => {
    try {
      return JSON.parse(trip.travelers);
    } catch {
      return { adults: 1, children: [], hasPets: false };
    }
  };

  const [editedPreferences, setEditedPreferences] = useState(getCurrentPreferences());
  const [editedTravelers, setEditedTravelers] = useState(getCurrentTravelers());
  const [editedDates, setEditedDates] = useState({
    startDate: trip.startDate.split('T')[0],
    endDate: trip.endDate.split('T')[0],
  });
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [startLocationInput, setStartLocationInput] = useState('');
  const [endLocationInput, setEndLocationInput] = useState('');
  const [isSavingStartLocation, setIsSavingStartLocation] = useState(false);
  const [isSavingEndLocation, setIsSavingEndLocation] = useState(false);

  // Auto-geocode locations without coordinates
  useEffect(() => {
    const geocodeMissingCoordinates = async () => {
      const updatedTrip = { ...trip };
      let hasChanges = false;

      for (let i = 0; i < updatedTrip.days.length; i++) {
        const day = updatedTrip.days[i];

        // Geocode start location if it has a name but no coordinates
        if (day.startLocationName && (!day.startLat || !day.startLng)) {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(day.startLocationName)}&limit=1`,
              { headers: { 'User-Agent': 'Tripmind/1.0' } }
            );
            const data = await response.json();
            if (data && data[0]) {
              updatedTrip.days[i] = {
                ...updatedTrip.days[i],
                startLat: parseFloat(data[0].lat),
                startLng: parseFloat(data[0].lon),
              };
              hasChanges = true;

              // Update in database
              await fetch(`/api/days/${day.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  startLat: parseFloat(data[0].lat),
                  startLng: parseFloat(data[0].lon),
                }),
              });
            }
          } catch (e) {
            console.error('Failed to geocode start location:', day.startLocationName);
          }
          // Small delay to respect Nominatim rate limits
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Geocode end location if it has a name but no coordinates
        if (day.endLocationName && (!day.endLat || !day.endLng)) {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(day.endLocationName)}&limit=1`,
              { headers: { 'User-Agent': 'Tripmind/1.0' } }
            );
            const data = await response.json();
            if (data && data[0]) {
              updatedTrip.days[i] = {
                ...updatedTrip.days[i],
                endLat: parseFloat(data[0].lat),
                endLng: parseFloat(data[0].lon),
              };
              hasChanges = true;

              // Update in database
              await fetch(`/api/days/${day.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  endLat: parseFloat(data[0].lat),
                  endLng: parseFloat(data[0].lon),
                }),
              });
            }
          } catch (e) {
            console.error('Failed to geocode end location:', day.endLocationName);
          }
          // Small delay to respect Nominatim rate limits
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      if (hasChanges) {
        onTripUpdate(updatedTrip);
      }
    };

    // Only run once when component mounts
    const hasMissingCoordinates = trip.days.some(
      day => (day.startLocationName && (!day.startLat || !day.startLng)) ||
             (day.endLocationName && (!day.endLat || !day.endLng))
    );

    if (hasMissingCoordinates) {
      geocodeMissingCoordinates();
    }
  }, [trip.days.length]); // Run when days are loaded

  // Get previous day's end location for auto-fill suggestion
  const getPreviousDayEndLocation = () => {
    if (selectedDay > 0 && trip.days[selectedDay - 1]) {
      const prevDay = trip.days[selectedDay - 1];
      if (prevDay.endLocationName) {
        return {
          name: prevDay.endLocationName,
          address: prevDay.endLocationAddress,
          lat: prevDay.endLat,
          lng: prevDay.endLng,
        };
      }
    }
    return null;
  };

  // Geocode location using Nominatim
  const geocodeLocation = async (query: string) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await response.json();
      if (data && data[0]) {
        return {
          name: data[0].display_name.split(',')[0],
          address: data[0].display_name,
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
      return { name: query };
    } catch {
      return { name: query };
    }
  };

  // Update day location
  const updateDayLocation = async (type: 'start' | 'end', locationData: {
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  }) => {
    if (type === 'start') {
      setIsSavingStartLocation(true);
    } else {
      setIsSavingEndLocation(true);
    }

    try {
      const day = trip.days[selectedDay];
      if (!day) return;

      const response = await fetch(`/api/days/${day.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [type === 'start' ? 'startLocationName' : 'endLocationName']: locationData.name,
          [type === 'start' ? 'startLocationAddress' : 'endLocationAddress']: locationData.address || null,
          [type === 'start' ? 'startLat' : 'endLat']: locationData.lat || null,
          [type === 'start' ? 'startLng' : 'endLng']: locationData.lng || null,
          propagateToEnd: type === 'end',
          propagateToStart: type === 'start',
        }),
      });

      if (response.ok) {
        // Update the trip in state
        const updatedTrip = { ...trip };
        const dayIndex = updatedTrip.days.findIndex(d => d.id === day.id);
        
        if (type === 'start') {
          updatedTrip.days[dayIndex] = {
            ...updatedTrip.days[dayIndex],
            startLocationName: locationData.name,
            startLocationAddress: locationData.address || null,
            startLat: locationData.lat || null,
            startLng: locationData.lng || null,
          };
          // Update previous day's end location
          if (dayIndex > 0) {
            updatedTrip.days[dayIndex - 1] = {
              ...updatedTrip.days[dayIndex - 1],
              endLocationName: locationData.name,
              endLocationAddress: locationData.address || null,
              endLat: locationData.lat || null,
              endLng: locationData.lng || null,
            };
          }
          // Clear the input after successful save
          setStartLocationInput('');
        } else {
          updatedTrip.days[dayIndex] = {
            ...updatedTrip.days[dayIndex],
            endLocationName: locationData.name,
            endLocationAddress: locationData.address || null,
            endLat: locationData.lat || null,
            endLng: locationData.lng || null,
          };
          // Update next day's start location
          if (dayIndex < updatedTrip.days.length - 1) {
            updatedTrip.days[dayIndex + 1] = {
              ...updatedTrip.days[dayIndex + 1],
              startLocationName: locationData.name,
              startLocationAddress: locationData.address || null,
              startLat: locationData.lat || null,
              startLng: locationData.lng || null,
            };
          }
          // Clear the input after successful save
          setEndLocationInput('');
        }
        
        onTripUpdate(updatedTrip);
      }
    } catch (error) {
      console.error('Error updating location:', error);
    } finally {
      if (type === 'start') {
        setIsSavingStartLocation(false);
      } else {
        setIsSavingEndLocation(false);
      }
    }
  };

  // Handle saving start location
  const handleSaveStartLocation = async () => {
    if (!startLocationInput.trim()) return;
    const geoData = await geocodeLocation(startLocationInput);
    await updateDayLocation('start', geoData);
  };

  // Handle saving end location
  const handleSaveEndLocation = async () => {
    if (!endLocationInput.trim()) return;
    const geoData = await geocodeLocation(endLocationInput);
    await updateDayLocation('end', geoData);
  };

  // Use previous day's end location as start location
  const handleUsePreviousEndLocation = () => {
    const prevLocation = getPreviousDayEndLocation();
    if (prevLocation) {
      updateDayLocation('start', prevLocation);
    }
  };

  const handleShare = async () => {
    try {
      const response = await fetch(`/api/trips/${trip.id}/share`, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok) {
        setShareUrl(data.shareUrl);
        setShowShareModal(true);
      }
    } catch (error) {
      console.error('Error sharing trip:', error);
    }
  };

  const handleExport = () => {
    window.open(`/api/trips/${trip.id}/export`, '_blank');
  };

  const copyShareUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
    }
  };

  const savePreferences = async () => {
    setIsSavingPreferences(true);
    try {
      const response = await fetch(`/api/trips/${trip.id}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: editedPreferences,
          travelers: editedTravelers,
          startDate: editedDates.startDate,
          endDate: editedDates.endDate,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        onTripUpdate(data.trip);
        setShowPreferencesModal(false);
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setIsSavingPreferences(false);
    }
  };

  // Fetch a single section
  const fetchSection = async (section: string) => {
    setLoadingSections(prev => ({ ...prev, [section]: true }));
    
    try {
      const destinations = getDestinations();
      const response = await fetch(`/api/ai/trip-info-section?destinations=${encodeURIComponent(destinations)}&section=${section}`);
      
      if (!response.ok) {
        throw new Error('Erreur lors du chargement');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setTripInfo((prev: any) => ({
          ...prev,
          [section]: data.data
        }));
        if (data.warning) {
          toast({
            title: "Information limitée",
            description: data.warning,
            variant: "default",
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching section ${section}:`, error);
      toast({
        title: "Erreur",
        description: `Impossible de charger: ${section}`,
        variant: "destructive",
      });
    } finally {
      setLoadingSections(prev => ({ ...prev, [section]: false }));
    }
  };

  // Load all sections
  const loadAllSections = async () => {
    setTripInfo({});
    setIsLoadingInfo(true);
    
    // Load sections sequentially to avoid rate limiting
    for (const section of INFO_SECTIONS) {
      await fetchSection(section);
    }
    
    setIsLoadingInfo(false);
  };

  // Legacy: Fetch trip practical info (for backward compatibility)
  const fetchTripInfo = async (forceRefresh = false) => {
    if (tripInfo && !forceRefresh) return;
    
    if (forceRefresh) {
      setTripInfo(null);
    }
    
    setIsLoadingInfo(true);
    try {
      const destinations = getDestinations();
      const response = await fetch(`/api/ai/trip-info?destinations=${encodeURIComponent(destinations)}`);
      
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des informations');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setTripInfo(data.info);
        if (data.warning) {
          toast({
            title: "Informations limitées",
            description: data.warning,
            variant: "default",
          });
        }
      }
    } catch (error) {
      console.error('Error fetching trip info:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les informations pratiques",
        variant: "destructive",
      });
    } finally {
      setIsLoadingInfo(false);
    }
  };

  // Load trip info when switching to info tab
  useEffect(() => {
    if (activeTab === 'info' && !tripInfo && !isLoadingInfo) {
      loadAllSections();
    }
  }, [activeTab]);

  const interestOptions = [
    { id: 'culture', label: 'Culture', icon: Palette },
    { id: 'nature', label: 'Nature', icon: Mountain },
    { id: 'gastronomy', label: 'Gastronomie', icon: Utensils },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
    { id: 'sports', label: 'Sport', icon: Mountain },
    { id: 'nightlife', label: 'Vie nocturne', icon: Music },
    { id: 'wellness', label: 'Bien-être', icon: Heart },
    { id: 'adventure', label: 'Aventure', icon: Compass },
    { id: 'family', label: 'Familial', icon: Baby },
  ];

  const dietaryOptions = [
    { id: 'vegetarian', label: 'Végétarien' },
    { id: 'vegan', label: 'Vegan' },
    { id: 'halal', label: 'Halal' },
    { id: 'kosher', label: 'Casher' },
    { id: 'gluten-free', label: 'Sans gluten' },
  ];

  const toggleInterest = (interestId: string) => {
    const interests = editedPreferences.interests.includes(interestId)
      ? editedPreferences.interests.filter((i: string) => i !== interestId)
      : [...editedPreferences.interests, interestId];
    setEditedPreferences({
      ...editedPreferences,
      interests,
    });
  };

  const toggleDietary = (dietaryId: string) => {
    const dietary = editedPreferences.dietary.includes(dietaryId)
      ? editedPreferences.dietary.filter((d: string) => d !== dietaryId)
      : [...editedPreferences.dietary, dietaryId];
    setEditedPreferences({
      ...editedPreferences,
      dietary,
    });
  };

  const getDestinations = () => {
    try {
      const dests = JSON.parse(trip.destinations);
      return Array.isArray(dests) ? dests.join(', ') : dests;
    } catch {
      return trip.destinations;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'visit':
        return <MapPin className="w-4 h-4" />;
      case 'meal':
        return <Utensils className="w-4 h-4" />;
      case 'transport':
        return <Bus className="w-4 h-4" />;
      case 'accommodation':
        return <Home className="w-4 h-4" />;
      case 'activity':
        return <Star className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'visit':
        return 'bg-amber-500/30 text-amber-300';
      case 'meal':
        return 'bg-rose-500/30 text-rose-300';
      case 'transport':
        return 'bg-sky-500/30 text-sky-300';
      case 'accommodation':
        return 'bg-emerald-500/30 text-emerald-300';
      case 'activity':
        return 'bg-purple-500/30 text-purple-300';
      default:
        return 'bg-white/20 text-white/70';
    }
  };

  const generateAIRecommendations = async (retryCount = 0) => {
    const maxRetries = 3;
    setIsLoadingAI(true);
    
    // Show initial status
    setGenerationStatus({
      step: 'connecting',
      message: retryCount > 0 
        ? `Nouvelle tentative de connexion... (${retryCount}/${maxRetries})`
        : 'Connexion au service IA...',
      retryCount,
      maxRetries,
      progress: 5,
    });

    // Create abort controller for timeout - 5 minutes to allow for slow AI + geocoding
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

    // Progress interval reference for cleanup
    let progressInterval: NodeJS.Timeout | null = null;

    // Helper function to check if generation succeeded (fetch trip data)
    const checkForGeneratedData = async (): Promise<boolean> => {
      try {
        const tripResponse = await fetch(`/api/trips/${trip.id}`);
        if (tripResponse.ok) {
          const tripData = await tripResponse.json();
          if (tripData.trip) {
            // Check if any day has events
            const hasEvents = tripData.trip.days?.some((d: Day) => d.events && d.events.length > 0);
            if (hasEvents) {
              onTripUpdate(tripData.trip);
              return true;
            }
          }
        }
      } catch (e) {
        console.error('Failed to check for generated data:', e);
      }
      return false;
    };

    try {
      // Simulate progress steps (slower progression)
      progressInterval = setInterval(() => {
        setGenerationStatus(prev => {
          if (prev.step === 'error' || prev.step === 'success') return prev;
          // Slower progress - only increment by 1 every second, max 85%
          const newProgress = Math.min(prev.progress + 1, 85);
          let newStep = prev.step;
          let newMessage = prev.message;
          
          if (newProgress > 15 && newProgress <= 35) {
            newStep = 'analyzing';
            newMessage = 'Analyse de vos préférences et centres d\'intérêt...';
          } else if (newProgress > 35 && newProgress <= 55) {
            newStep = 'generating';
            newMessage = 'Génération des recommandations personnalisées...';
          } else if (newProgress > 55 && newProgress <= 75) {
            newStep = 'enriching';
            newMessage = 'Enrichissement des événements avec des détails...';
          } else if (newProgress > 75) {
            newStep = 'finalizing';
            newMessage = 'Finalisation de votre itinéraire...';
          }
          
          return { ...prev, progress: newProgress, step: newStep, message: newMessage };
        });
      }, 1000);

      const response = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id }),
        signal: controller.signal,
      });

      // Clear timeout and progress interval
      clearTimeout(timeoutId);
      if (progressInterval) clearInterval(progressInterval);
      
      // Try to parse the response
      let data;
      const responseText = await response.text();
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', responseText.substring(0, 200));
        
        // Check if response was HTML error page
        if (responseText.startsWith('<') || responseText.startsWith('<!')) {
          if (response.status === 502 || response.status === 503 || response.status === 504) {
            if (retryCount < maxRetries) {
              setGenerationStatus(prev => ({
                ...prev,
                step: 'connecting',
                message: `Le serveur ne répond pas. Nouvelle tentative dans ${2 * (retryCount + 1)} secondes...`,
                retryCount: retryCount + 1,
              }));
              await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
              return generateAIRecommendations(retryCount + 1);
            }
          }
          // Before showing error, check if data was saved
          const hasData = await checkForGeneratedData();
          if (hasData) {
            setGenerationStatus({
              step: 'success',
              message: 'Votre itinéraire personnalisé est prêt !',
              retryCount,
              maxRetries,
              progress: 100,
            });
            setTimeout(() => {
              setGenerationStatus(prev => ({ ...prev, step: 'idle' }));
              setIsLoadingAI(false);
            }, 2000);
            return;
          }
          throw new Error('Le service AI est temporairement indisponible. Veuillez réessayer dans quelques instants.');
        }
        throw new Error('Erreur lors de l\'analyse de la réponse du serveur');
      }
      
      // Check if response indicates an error
      if (!response.ok || data.error) {
        const errorMsg = data.error || 'Erreur lors de la génération des recommandations';
        
        // Check for retryable errors
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          if (retryCount < maxRetries) {
            setGenerationStatus(prev => ({
              ...prev,
              step: 'connecting',
              message: `Le serveur ne répond pas. Nouvelle tentative dans ${2 * (retryCount + 1)} secondes...`,
              retryCount: retryCount + 1,
            }));
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
            return generateAIRecommendations(retryCount + 1);
          }
        }
        
        // Before showing error, check if data was saved
        const hasData = await checkForGeneratedData();
        if (hasData) {
          setGenerationStatus({
            step: 'success',
            message: 'Votre itinéraire personnalisé est prêt !',
            retryCount,
            maxRetries,
            progress: 100,
          });
          setTimeout(() => {
            setGenerationStatus(prev => ({ ...prev, step: 'idle' }));
            setIsLoadingAI(false);
          }, 2000);
          return;
        }
        
        throw new Error(errorMsg);
      }
      
      // Success! Even if data.trip doesn't exist, the generation worked
      const successMessage = data.warning 
        ? `Itinéraire généré (${data.warning})`
        : 'Votre itinéraire personnalisé est prêt !';
      
      setGenerationStatus({
        step: 'success',
        message: successMessage,
        retryCount,
        maxRetries,
        progress: 100,
      });
      
      // Update trip data if available
      if (data.trip) {
        onTripUpdate(data.trip);
      } else {
        // If no trip data returned, fetch from server
        console.log('Generation succeeded but no trip data returned, refreshing...');
        await checkForGeneratedData();
      }
      
      // Auto-hide after 2 seconds
      setTimeout(() => {
        setGenerationStatus(prev => ({ ...prev, step: 'idle' }));
        setIsLoadingAI(false);
      }, 2000);
      
    } catch (error) {
      // Clear timeout and progress interval
      clearTimeout(timeoutId);
      if (progressInterval) clearInterval(progressInterval);
      
      console.error('Error generating recommendations:', error);
      
      // Before showing any error, ALWAYS check if data was saved
      const hasData = await checkForGeneratedData();
      if (hasData) {
        setGenerationStatus({
          step: 'success',
          message: 'Votre itinéraire personnalisé est prêt !',
          retryCount,
          maxRetries,
          progress: 100,
        });
        setTimeout(() => {
          setGenerationStatus(prev => ({ ...prev, step: 'idle' }));
          setIsLoadingAI(false);
        }, 2000);
        return;
      }
      
      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        setGenerationStatus({
          step: 'error',
          message: 'La requête a pris trop de temps. Veuillez réessayer.',
          retryCount,
          maxRetries,
          progress: 0,
        });
        setIsLoadingAI(false);
        return;
      }
      
      // Check if we should retry for network errors
      if (error instanceof TypeError && error.message.includes('fetch') && retryCount < maxRetries) {
        setGenerationStatus(prev => ({
          ...prev,
          step: 'connecting',
          message: `Problème de connexion. Nouvelle tentative dans ${2 * (retryCount + 1)} secondes...`,
          retryCount: retryCount + 1,
        }));
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return generateAIRecommendations(retryCount + 1);
      }
      
      // Show error state
      setGenerationStatus({
        step: 'error',
        message: error instanceof Error ? error.message : 'Erreur lors de la génération des recommandations',
        retryCount,
        maxRetries,
        progress: 0,
      });
      setIsLoadingAI(false);
    }
  };

  const cancelGeneration = () => {
    setGenerationStatus({
      step: 'idle',
      message: '',
      retryCount: 0,
      maxRetries: 3,
      progress: 0,
    });
    setIsLoadingAI(false);
  };

  const enrichEvent = async (eventId: string) => {
    setEnrichingEventId(eventId);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      const response = await fetch('/api/ai/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(errorData.error || 'Erreur lors de l\'enrichissement');
      }

      const data = await response.json();
      if (data.success) {
        // Update the event in the trip
        const updatedTrip = { ...trip };
        for (const day of updatedTrip.days) {
          if (!day.events) day.events = [];
          const eventIndex = day.events.findIndex((e) => e.id === eventId);
          if (eventIndex !== -1) {
            day.events[eventIndex] = data.event;
            break;
          }
        }
        onTripUpdate(updatedTrip);
        
        // Show warning if AI was not used
        if (data.warning) {
          toast({
            title: "Enrichissement limité",
            description: data.warning,
            variant: "default",
          });
        } else {
          toast({
            title: "Événement enrichi",
            description: "Les informations ont été enrichies avec succès par l'IA.",
          });
        }
      }
    } catch (error) {
      console.error('Error enriching event:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        toast({
          title: "Timeout",
          description: "La requête a pris trop de temps. Veuillez réessayer.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : 'Erreur lors de l\'enrichissement',
          variant: "destructive",
        });
      }
    } finally {
      setEnrichingEventId(null);
    }
  };

  // Attachment management
  const openAttachmentsModal = async (eventId: string) => {
    setAttachmentsEventId(eventId);
    setShowAttachmentsModal(true);
    
    // Load existing attachments
    try {
      const response = await fetch(`/api/events/${eventId}/attachment`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAttachments(data.attachments);
        }
      }
    } catch (error) {
      console.error('Error loading attachments:', error);
    }
  };

  const uploadAttachment = async (file: File, category: string) => {
    if (!attachmentsEventId) return;
    
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      
      const response = await fetch(`/api/events/${attachmentsEventId}/attachment`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors du téléchargement');
      }
      
      const data = await response.json();
      if (data.success) {
        setAttachments(prev => [...prev, data.attachment]);
        
        // Update the event in the trip
        const updatedTrip = { ...trip };
        for (const day of updatedTrip.days) {
          if (!day.events) day.events = [];
          const eventIndex = day.events.findIndex((e) => e.id === attachmentsEventId);
          if (eventIndex !== -1) {
            day.events[eventIndex] = data.event;
            break;
          }
        }
        onTripUpdate(updatedTrip);
        
        toast({
          title: "Fichier ajouté",
          description: `${file.name} a été ajouté avec succès.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : 'Erreur lors du téléchargement',
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!attachmentsEventId) return;
    
    try {
      const response = await fetch(`/api/events/${attachmentsEventId}/attachment?attachmentId=${attachmentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }
      
      const data = await response.json();
      if (data.success) {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId));
        
        // Update the event in the trip
        const updatedTrip = { ...trip };
        for (const day of updatedTrip.days) {
          if (!day.events) day.events = [];
          const eventIndex = day.events.findIndex((e) => e.id === attachmentsEventId);
          if (eventIndex !== -1) {
            day.events[eventIndex] = data.event;
            break;
          }
        }
        onTripUpdate(updatedTrip);
        
        toast({
          title: "Fichier supprimé",
          description: "La pièce jointe a été supprimée.",
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : 'Erreur lors de la suppression',
        variant: "destructive",
      });
    }
  };

  const getAttachmentCount = (event: Event): number => {
    try {
      const atts = JSON.parse(event.attachments || '[]');
      return Array.isArray(atts) ? atts.length : 0;
    } catch {
      return 0;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    if (type === 'application/pdf') return FileText;
    return File;
  };

  const addEvent = async () => {
    if (!newEventData.title) return;

    const day = trip.days[selectedDay];
    if (!day) return;

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayId: day.id,
          ...newEventData,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        const updatedTrip = { ...trip };
        if (!updatedTrip.days[selectedDay].events) {
          updatedTrip.days[selectedDay].events = [];
        }
        updatedTrip.days[selectedDay].events.push(data.event);
        onTripUpdate(updatedTrip);
        setShowAddEvent(false);
        setNewEventData({
          type: 'visit',
          title: '',
          description: '',
          startTime: '',
          locationName: '',
        });
      }
    } catch (error) {
      console.error('Error adding event:', error);
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        const updatedTrip = { ...trip };
        for (const day of updatedTrip.days) {
          if (day.events) {
            day.events = day.events.filter((e) => e.id !== eventId);
          }
        }
        onTripUpdate(updatedTrip);
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const getPracticalInfo = (event: Event) => {
    try {
      return JSON.parse(event.practicalInfo);
    } catch {
      return {};
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/background.jpg)' }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-black/85 via-black/75 to-black/90" />
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <img 
                src="/logo.png" 
                alt="Tripmind" 
                className="w-8 h-8 rounded-lg shadow-md"
              />
              <Separator orientation="vertical" className="h-6 bg-white/20" />
              <Button variant="ghost" onClick={onBack} className="text-white/80 hover:text-white hover:bg-white/10">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <Separator orientation="vertical" className="h-6 bg-white/20" />
              <div>
                <h1 className="font-semibold text-white">{trip.title}</h1>
                <p className="text-sm text-white/60">{getDestinations()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditedPreferences(getCurrentPreferences());
                  setEditedTravelers(getCurrentTravelers());
                  setEditedDates({
                    startDate: trip.startDate.split('T')[0],
                    endDate: trip.endDate.split('T')[0],
                  });
                  setShowPreferencesModal(true);
                }}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <Edit className="w-4 h-4 mr-2" />
                Préférences
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare} className="border-white/20 text-white hover:bg-white/10">
                <Share2 className="w-4 h-4 mr-2" />
                Partager
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} className="border-white/20 text-white hover:bg-white/10">
                <Download className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* AI Recommendations Banner */}
          {trip.days?.every((d) => !d.events || d.events.length === 0) && (
            <Card className="mb-6 glass-light border-white/10">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      Générer des recommandations IA
                    </h3>
                    <p className="text-sm text-white/60">
                      Laissez l'IA créer un itinéraire personnalisé pour vous
                    </p>
                  </div>
                </div>
                <Button
                  onClick={generateAIRecommendations}
                  disabled={isLoadingAI}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30"
                >
                  {isLoadingAI ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Générer
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={activeTab === 'days' ? 'default' : 'outline'}
              onClick={() => setActiveTab('days')}
              className={activeTab === 'days' 
                ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                : 'border-white/20 text-white hover:bg-white/10'
              }
            >
              <Calendar className="w-4 h-4 mr-2" />
              Itinéraire
            </Button>
            <Button
              variant={activeTab === 'info' ? 'default' : 'outline'}
              onClick={() => setActiveTab('info')}
              className={activeTab === 'info' 
                ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                : 'border-white/20 text-white hover:bg-white/10'
              }
            >
              <Info className="w-4 h-4 mr-2" />
              À savoir
            </Button>
          </div>

          {/* Tab Content */}
          {activeTab === 'info' ? (
            /* À Savoir Tab */
            <TripInfoSection 
              destinations={getDestinations()}
              tripInfo={tripInfo}
              loadingSections={loadingSections}
              onRefreshSection={fetchSection}
              onLoadAll={loadAllSections}
            />
          ) : (
          <div className="grid lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Days Sidebar - Desktop */}
            <div className="hidden lg:block lg:col-span-1">
              <Card className="glass-light border-white/10 sticky top-24">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white">Jours</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[60vh]">
                    {trip.days.map((day, index) => (
                      <button
                        key={day.id}
                        onClick={() => setSelectedDay(index)}
                        className={`w-full text-left px-4 py-3 border-b border-white/10 last:border-0 transition-colors ${
                          selectedDay === index
                            ? 'bg-amber-500/20'
                            : 'hover:bg-white/10'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-white capitalize">
                              Jour {index + 1}
                            </p>
                            <p className="text-sm text-white/50 capitalize">{formatDate(day.date)}</p>
                          </div>
                          <Badge variant="secondary" className="bg-white/10 text-white/70">{day.events?.length || 0}</Badge>
                        </div>
                      </button>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Events Timeline */}
            <div className="lg:col-span-3">
              {/* Mobile Day Selector */}
              <div className="lg:hidden mb-4 overflow-x-auto -mx-4 px-4">
                <div className="flex gap-2 pb-2" style={{ minWidth: 'max-content' }}>
                  {trip.days.map((day, index) => (
                    <button
                      key={day.id}
                      onClick={() => setSelectedDay(index)}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg transition-colors ${
                        selectedDay === index
                          ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50'
                          : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-center">
                        <p className="font-medium text-sm">J{index + 1}</p>
                        <p className="text-xs opacity-70">{day.events?.length || 0}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {trip.days?.[selectedDay] && (
                <Card className="glass-light border-white/10">
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <CardTitle className="capitalize text-white text-lg sm:text-xl">
                          Jour {selectedDay + 1} - {formatDate(trip.days[selectedDay].date)}
                        </CardTitle>
                        <CardDescription className="text-white/50 text-sm">
                          {trip.days[selectedDay].events?.length || 0} activité(s) planifiée(s)
                        </CardDescription>
                      </div>
                      <Button onClick={() => setShowAddEvent(true)} size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 w-full sm:w-auto">
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    {/* Day Locations */}
                    <div className="mb-4 sm:mb-6">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Start Location */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-white/80 flex items-center gap-2">
                              <Sunrise className="w-4 h-4 text-amber-400" />
                              Lieu de départ
                            </Label>
                            {getPreviousDayEndLocation() && !trip.days[selectedDay].startLocationName && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-amber-400 hover:text-amber-300 h-6 px-2"
                                onClick={handleUsePreviousEndLocation}
                              >
                                Utiliser l'arrivée J{selectedDay}
                              </Button>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Ex: Gare du Nord, Paris"
                              value={startLocationInput || trip.days[selectedDay].startLocationName || ''}
                              onChange={(e) => setStartLocationInput(e.target.value)}
                              className="bg-white/5 border-white/10 text-white"
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveStartLocation()}
                            />
                            {startLocationInput !== trip.days[selectedDay].startLocationName && startLocationInput && (
                              <Button
                                size="sm"
                                onClick={handleSaveStartLocation}
                                disabled={isSavingStartLocation}
                                className="bg-amber-500 hover:bg-amber-600"
                              >
                                {isSavingStartLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* End Location */}
                        <div className="space-y-2">
                          <Label className="text-white/80 flex items-center gap-2">
                            <Moon className="w-4 h-4 text-orange-400" />
                            Lieu d'arrivée
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Ex: Hôtel Le Marais, Paris"
                              value={endLocationInput || trip.days[selectedDay].endLocationName || ''}
                              onChange={(e) => setEndLocationInput(e.target.value)}
                              className="bg-white/5 border-white/10 text-white"
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEndLocation()}
                            />
                            {endLocationInput !== trip.days[selectedDay].endLocationName && endLocationInput && (
                              <Button
                                size="sm"
                                onClick={handleSaveEndLocation}
                                disabled={isSavingEndLocation}
                                className="bg-amber-500 hover:bg-amber-600"
                              >
                                {isSavingEndLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      {trip.days[selectedDay].startLocationName && trip.days[selectedDay].endLocationName && (
                        <p className="text-xs text-white/50 mt-2 text-center">
                          ✓ Le lieu de départ de demain sera automatiquement "{trip.days[selectedDay].endLocationName}"
                        </p>
                      )}
                    </div>

                    <Separator className="mb-6 bg-white/10" />

                    {/* Day Map */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Map className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-medium text-white/80">Carte du jour</h3>
                      </div>
                      <DayMap 
                        events={trip.days[selectedDay].events || []} 
                        destination={getDestinations()} 
                        startLocation={{
                          name: trip.days[selectedDay].startLocationName,
                          lat: trip.days[selectedDay].startLat,
                          lng: trip.days[selectedDay].startLng,
                        }}
                        endLocation={{
                          name: trip.days[selectedDay].endLocationName,
                          lat: trip.days[selectedDay].endLat,
                          lng: trip.days[selectedDay].endLng,
                        }}
                      />
                    </div>
                    
                    <Separator className="mb-6 bg-white/10" />
                    
                    {!trip.days[selectedDay].events || trip.days[selectedDay].events.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-white/10 mx-auto flex items-center justify-center mb-4">
                          <Calendar className="w-8 h-8 text-white/40" />
                        </div>
                        <p className="text-white/50">
                          Aucune activité pour ce jour
                        </p>
                        <div className="flex gap-2 justify-center mt-4">
                          <Button onClick={() => setShowAddEvent(true)} variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                            <Plus className="w-4 h-4 mr-2" />
                            Ajouter manuellement
                          </Button>
                          {trip.days?.every((d) => !d.events || d.events.length === 0) && (
                            <Button
                              onClick={generateAIRecommendations}
                              disabled={isLoadingAI}
                              size="sm"
                              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30"
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              Générer avec l'IA
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Transport from day start location to first event */}
                        {(() => {
                          const currentDay = trip.days[selectedDay];
                          const sortedEvents = [...(currentDay.events || [])].sort((a, b) => 
                            (a.startTime || '').localeCompare(b.startTime || '')
                          );
                          const firstEvent = sortedEvents[0];
                          
                          // Show transport if there's a start location name or first event
                          if ((currentDay.startLocationName || currentDay.startLat) && firstEvent) {
                            const startTransport = getTransportRecommendation(
                              currentDay.startLat,
                              currentDay.startLng,
                              firstEvent.lat,
                              firstEvent.lng
                            );
                            if (startTransport) {
                              return (
                                <div className="pl-8 pb-2">
                                  <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
                                    <Home className="w-3 h-3" />
                                    <span>Depuis {currentDay.startLocationName || 'Point de départ'}</span>
                                  </div>
                                  <TransportCard 
                                    transport={startTransport} 
                                    showAlternatives={false}
                                    origin={{
                                      name: currentDay.startLocationName || 'Point de départ',
                                      lat: currentDay.startLat,
                                      lng: currentDay.startLng,
                                    }}
                                    destination={{
                                      name: firstEvent.locationName || firstEvent.title,
                                      lat: firstEvent.lat,
                                      lng: firstEvent.lng,
                                    }}
                                    city={getDestinations()}
                                  />
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}
                        
                        {trip.days[selectedDay].events
                          ?.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
                          .map((event, index, sortedEvents) => {
                            const practicalInfo = getPracticalInfo(event);
                            const eventsList = trip.days[selectedDay].events || [];
                            const nextEvent = sortedEvents[index + 1];
                            const transportInfo = nextEvent
                              ? getTransportRecommendation(
                                  event.lat,
                                  event.lng,
                                  nextEvent.lat,
                                  nextEvent.lng
                                )
                              : null;
                            const isLastEvent = index === sortedEvents.length - 1;
                            return (
                              <div
                                key={event.id}
                              >
                                <div className="relative pl-8 pb-4">
                                  {/* Timeline line */}
                                  {index < eventsList.length - 1 && (
                                    <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-white/20" />
                                  )}

                                  {/* Timeline dot */}
                                  <div
                                    className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center ${getEventTypeColor(
                                      event.type
                                    )}`}
                                  >
                                    {getEventTypeIcon(event.type)}
                                  </div>

                                  {/* Event Card */}
                                  <Card className="glass-light border-white/10 overflow-hidden">
                                  {/* Event Image */}
                                  {(() => {
                                    let photos: string[] = [];
                                    try {
                                      photos = JSON.parse(event.photos || '[]');
                                    } catch { /* ignore */ }
                                    const hasImage = photos[0];
                                    const typeEmoji = event.type === 'visit' ? '🏛️' : 
                                                     event.type === 'meal' ? '🍽️' : 
                                                     event.type === 'transport' ? '🚌' : 
                                                     event.type === 'accommodation' ? '🏨' : '⭐';
                                    return (
                                      <div className="relative h-32 w-full bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                                        {hasImage ? (
                                          <img
                                            src={photos[0]}
                                            alt={event.title}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-4xl">
                                            {typeEmoji}
                                          </div>
                                        )}
                                        {hasImage && <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />}
                                      </div>
                                    );
                                  })()}
                                  <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          {event.startTime && (
                                            <span className="text-sm font-medium text-white/60">
                                              {event.startTime}
                                            </span>
                                          )}
                                          {event.durationMinutes && (
                                            <span className="text-xs text-white/40">
                                              ({event.durationMinutes} min)
                                            </span>
                                          )}
                                        </div>
                                        <CardTitle className="text-base text-white">{event.title}</CardTitle>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {/* Attachment count indicator */}
                                        {(() => {
                                          const count = getAttachmentCount(event);
                                          return count > 0 && (
                                            <Badge
                                              variant="outline"
                                              className="text-xs bg-sky-500/20 text-sky-300 border-sky-500/30 cursor-pointer hover:bg-sky-500/30"
                                              onClick={() => openAttachmentsModal(event.id)}
                                            >
                                              <Paperclip className="w-3 h-3 mr-1" />
                                              {count}
                                            </Badge>
                                          );
                                        })()}
                                        {event.isAiEnriched && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30"
                                          >
                                            <Sparkles className="w-3 h-3 mr-1" />
                                            IA
                                          </Badge>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => openAttachmentsModal(event.id)}
                                          className="text-sky-400 hover:text-sky-300 hover:bg-white/10"
                                          title="Ajouter une pièce jointe"
                                        >
                                          <Paperclip className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteEvent(event.id)}
                                          className="text-rose-400 hover:text-rose-300 hover:bg-white/10"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardHeader>
                                  <CardContent className="pb-3">
                                    {event.description && (
                                      <p className="text-sm text-white/60 mb-2">
                                        {event.description}
                                      </p>
                                    )}
                                    {event.locationName && (
                                      <div className="flex items-center gap-1 text-sm text-white/50 mb-2">
                                        <MapPin className="w-3 h-3" />
                                        {event.locationName}
                                      </div>
                                    )}
                                    {event.estimatedBudget && (
                                      <div className="flex items-center gap-1 text-sm text-white/50 mb-2">
                                        <Euro className="w-3 h-3" />
                                        ~{event.estimatedBudget}€
                                      </div>
                                    )}

                                    {/* Practical Info */}
                                    {(practicalInfo.tips || practicalInfo.openingHours) && (
                                      <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                                        {practicalInfo.openingHours && (
                                          <div className="flex items-center gap-2 text-sm mb-1">
                                            <Clock className="w-3 h-3 text-white/40" />
                                            <span className="text-white/70">
                                              {practicalInfo.openingHours}
                                            </span>
                                          </div>
                                        )}
                                        {practicalInfo.tips && practicalInfo.tips.length > 0 && (
                                          <div className="text-sm text-white/70">
                                            💡 {practicalInfo.tips[0]}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Enrich Button - Always visible to allow re-enrichment */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="mt-2 text-amber-400 hover:text-amber-300 hover:bg-white/10"
                                      onClick={() => enrichEvent(event.id)}
                                      disabled={enrichingEventId === event.id}
                                    >
                                      {enrichingEventId === event.id ? (
                                        <>
                                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                          Enrichissement...
                                        </>
                                      ) : event.isAiEnriched ? (
                                        <>
                                          <Sparkles className="w-4 h-4 mr-2" />
                                          Raffraîchir avec l'IA
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="w-4 h-4 mr-2" />
                                          Enrichir avec l'IA
                                        </>
                                      )}
                                    </Button>

                                    {event.sourceUrl && (
                                      <a
                                        href={event.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 hover:underline mt-2"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        Site officiel
                                      </a>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>
                              
                              {/* Transport info between events */}
                              {transportInfo && nextEvent && (
                                <div className="pl-8 py-2">
                                  <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
                                    <Navigation className="w-3 h-3" />
                                    <span>Vers {nextEvent.title}</span>
                                  </div>
                                  <TransportCard 
                                    transport={transportInfo} 
                                    showAlternatives={true}
                                    origin={{
                                      name: event.locationName || event.title,
                                      lat: event.lat,
                                      lng: event.lng,
                                    }}
                                    destination={{
                                      name: nextEvent.locationName || nextEvent.title,
                                      lat: nextEvent.lat,
                                      lng: nextEvent.lng,
                                    }}
                                    city={getDestinations()}
                                  />
                                </div>
                              )}
                              
                              {/* Transport from last event to end location (accommodation) */}
                              {isLastEvent && (() => {
                                const currentDay = trip.days[selectedDay];
                                
                                // Show transport if there's an end location name or coordinates
                                if (currentDay.endLocationName || currentDay.endLat) {
                                  const endTransport = getTransportRecommendation(
                                    event.lat,
                                    event.lng,
                                    currentDay.endLat,
                                    currentDay.endLng
                                  );
                                  if (endTransport) {
                                    return (
                                      <div className="pl-8 py-2 mt-2">
                                        <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
                                          <Navigation className="w-3 h-3" />
                                          <span>Vers {currentDay.endLocationName || 'Hébergement du soir'}</span>
                                        </div>
                                        <TransportCard 
                                          transport={endTransport} 
                                          showAlternatives={true}
                                          origin={{
                                            name: event.locationName || event.title,
                                            lat: event.lat,
                                            lng: event.lng,
                                          }}
                                          destination={{
                                            name: currentDay.endLocationName || 'Hébergement du soir',
                                            lat: currentDay.endLat,
                                            lng: currentDay.endLng,
                                          }}
                                          city={getDestinations()}
                                        />
                                      </div>
                                    );
                                  }
                                }
                                return null;
                              })()}
                            </div>
                          );
                          })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          )}
        </div>
      </main>

      {/* Add Event Dialog */}
      <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une activité</DialogTitle>
            <DialogDescription>
              Jour {selectedDay + 1} - {trip.days[selectedDay] && formatDate(trip.days[selectedDay].date)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex flex-wrap gap-2">
                {['visit', 'meal', 'transport', 'accommodation', 'activity'].map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={newEventData.type === type ? 'default' : 'outline'}
                    className={newEventData.type === type ? 'bg-amber-500 hover:bg-amber-600' : ''}
                    onClick={() => setNewEventData({ ...newEventData, type })}
                  >
                    {getEventTypeIcon(type)}
                    <span className="ml-2 capitalize">{type === 'visit' ? 'Visite' : type === 'meal' ? 'Repas' : type === 'transport' ? 'Transport' : type === 'accommodation' ? 'Logement' : 'Activité'}</span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input
                placeholder="Ex: Visite de la Tour Eiffel"
                value={newEventData.title}
                onChange={(e) => setNewEventData({ ...newEventData, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Heure (optionnel)</Label>
                <Input
                  type="time"
                  value={newEventData.startTime}
                  onChange={(e) => setNewEventData({ ...newEventData, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Lieu (optionnel)</Label>
                <Input
                  placeholder="Nom du lieu"
                  value={newEventData.locationName}
                  onChange={(e) => setNewEventData({ ...newEventData, locationName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (optionnel)</Label>
              <Textarea
                placeholder="Notes personnelles..."
                value={newEventData.description}
                onChange={(e) => setNewEventData({ ...newEventData, description: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowAddEvent(false)}>
              Annuler
            </Button>
            <Button
              onClick={addEvent}
              disabled={!newEventData.title}
              className="bg-gradient-to-r from-amber-500 to-orange-500"
            >
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partager ce voyage</DialogTitle>
            <DialogDescription>
              Partagez ce carnet de voyage avec vos proches en lecture seule
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input value={shareUrl || ''} readOnly className="flex-1" />
              <Button onClick={copyShareUrl} variant="secondary">
                Copier
              </Button>
            </div>
            <p className="text-sm text-slate-500">
              Toute personne avec ce lien pourra consulter votre carnet de voyage.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preferences Modal */}
      <Dialog open={showPreferencesModal} onOpenChange={setShowPreferencesModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier les préférences</DialogTitle>
            <DialogDescription>
              Ajustez vos préférences de voyage pour personnaliser les recommandations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Dates */}
            <div className="space-y-4">
              <h3 className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Dates du voyage
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Date de début</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={editedDates.startDate}
                    onChange={(e) => setEditedDates({ ...editedDates, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Date de fin</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={editedDates.endDate}
                    min={editedDates.startDate}
                    onChange={(e) => setEditedDates({ ...editedDates, endDate: e.target.value })}
                  />
                </div>
              </div>
              {editedDates.startDate && editedDates.endDate && (
                <p className="text-sm text-slate-500">
                  Durée: {Math.ceil((new Date(editedDates.endDate).getTime() - new Date(editedDates.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} jour(s)
                </p>
              )}
            </div>

            <Separator />

            {/* Travelers */}
            <div className="space-y-4">
              <h3 className="font-medium text-slate-700 dark:text-slate-300">Voyageurs</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adultes</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditedTravelers({ ...editedTravelers, adults: Math.max(1, editedTravelers.adults - 1) })}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center">{editedTravelers.adults}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditedTravelers({ ...editedTravelers, adults: editedTravelers.adults + 1 })}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Animaux</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasPets"
                      checked={editedTravelers.hasPets}
                      onCheckedChange={(checked) => setEditedTravelers({ ...editedTravelers, hasPets: checked as boolean })}
                    />
                    <label htmlFor="hasPets" className="text-sm">Voyage avec animaux</label>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Pace */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-slate-700 dark:text-slate-300">Rythme de voyage</h3>
                <span className="text-sm text-slate-500">
                  {editedPreferences.pace < 33 ? 'Détendu' : editedPreferences.pace < 66 ? 'Modéré' : 'Intense'}
                </span>
              </div>
              <Slider
                value={[editedPreferences.pace]}
                onValueChange={([value]) => setEditedPreferences({ ...editedPreferences, pace: value })}
                max={100}
                step={1}
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Slow travel</span>
                <span>Maximum d'activités</span>
              </div>
            </div>

            <Separator />

            {/* Budget */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-slate-700 dark:text-slate-300">Budget</h3>
                <span className="text-sm text-slate-500">
                  {editedPreferences.budget < 33 ? 'Économique' : editedPreferences.budget < 66 ? 'Confort' : 'Luxe'}
                </span>
              </div>
              <Slider
                value={[editedPreferences.budget]}
                onValueChange={([value]) => setEditedPreferences({ ...editedPreferences, budget: value })}
                max={100}
                step={1}
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Petit budget</span>
                <span>Sans limite</span>
              </div>
            </div>

            <Separator />

            {/* Interests */}
            <div className="space-y-4">
              <h3 className="font-medium text-slate-700 dark:text-slate-300">Centres d'intérêt</h3>
              <div className="grid grid-cols-3 gap-2">
                {interestOptions.map((interest) => {
                  const Icon = interest.icon;
                  const isSelected = editedPreferences.interests.includes(interest.id);
                  return (
                    <Button
                      key={interest.id}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={isSelected ? 'bg-amber-500 hover:bg-amber-600' : ''}
                      onClick={() => toggleInterest(interest.id)}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {interest.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Dietary */}
            <div className="space-y-4">
              <h3 className="font-medium text-slate-700 dark:text-slate-300">Régimes alimentaires</h3>
              <div className="flex flex-wrap gap-2">
                {dietaryOptions.map((diet) => {
                  const isSelected = editedPreferences.dietary.includes(diet.id);
                  return (
                    <Button
                      key={diet.id}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={isSelected ? 'bg-amber-500 hover:bg-amber-600' : ''}
                      onClick={() => toggleDietary(diet.id)}
                    >
                      {diet.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Accessibility */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="accessibility"
                  checked={editedPreferences.accessibility}
                  onCheckedChange={(checked) => setEditedPreferences({ ...editedPreferences, accessibility: checked as boolean })}
                />
                <label htmlFor="accessibility" className="flex items-center gap-2">
                  <Accessibility className="w-4 h-4" />
                  <span>Accessibilité PMR requise</span>
                </label>
              </div>
            </div>

            <Separator />

            {/* Must See */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                <h3 className="font-medium text-slate-700 dark:text-slate-300">Incontournables</h3>
              </div>
              <p className="text-sm text-slate-500">
                Lieux à voir absolument pendant votre voyage (séparés par des virgules)
              </p>
              <Textarea
                placeholder="Ex: Tour Eiffel, Musée du Louvre, Cathédrale Notre-Dame..."
                value={Array.isArray(editedPreferences.mustSee) ? editedPreferences.mustSee.join(', ') : ''}
                onChange={(e) => setEditedPreferences({ 
                  ...editedPreferences, 
                  mustSee: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                })}
                className="min-h-[80px]"
              />
              {editedPreferences.mustSee && editedPreferences.mustSee.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editedPreferences.mustSee.map((place, index) => (
                    <Badge key={index} variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      {place}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Already Visited */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-500" />
                <h3 className="font-medium text-slate-700 dark:text-slate-300">Lieux déjà visités</h3>
              </div>
              <p className="text-sm text-slate-500">
                Lieux que vous avez déjà visités et à éviter dans les recommandations (séparés par des virgules)
              </p>
              <Textarea
                placeholder="Ex: Musée d'Orsay, Montmartre..."
                value={Array.isArray(editedPreferences.alreadyVisited) ? editedPreferences.alreadyVisited.join(', ') : ''}
                onChange={(e) => setEditedPreferences({ 
                  ...editedPreferences, 
                  alreadyVisited: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                })}
                className="min-h-[80px]"
              />
              {editedPreferences.alreadyVisited && editedPreferences.alreadyVisited.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editedPreferences.alreadyVisited.map((place, index) => (
                    <Badge key={index} variant="outline" className="text-slate-600">
                      {place}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowPreferencesModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={savePreferences}
              disabled={isSavingPreferences}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              {isSavingPreferences ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attachments Modal */}
      <Dialog open={showAttachmentsModal} onOpenChange={(open) => {
        setShowAttachmentsModal(open);
        if (!open) {
          setAttachments([]);
          setAttachmentsEventId(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-sky-400" />
              Pièces jointes
            </DialogTitle>
            <DialogDescription>
              Ajoutez vos billets, vouchers, réservations et autres documents
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Upload section */}
            <div className="space-y-4">
              <h3 className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Ajouter un fichier
              </h3>
              
              {/* Category selection */}
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'billet', label: 'Billet', icon: '🎫' },
                    { id: 'voucher', label: 'Voucher / Bon', icon: '🎫' },
                    { id: 'reservation', label: 'Réservation', icon: '📋' },
                    { id: 'itineraire', label: 'Itinéraire', icon: '🗺️' },
                    { id: 'contrat', label: 'Contrat / Assurance', icon: '📄' },
                    { id: 'autre', label: 'Autre document', icon: '📎' },
                  ].map((cat) => (
                    <Badge
                      key={cat.id}
                      variant="outline"
                      className="cursor-pointer hover:bg-white/10"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            uploadAttachment(file, cat.id);
                          }
                        };
                        input.click();
                      }}
                    >
                      {cat.icon} {cat.label}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {uploadingFile && (
                <div className="flex items-center gap-2 text-sm text-sky-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Téléchargement en cours...
                </div>
              )}
            </div>

            <Separator />

            {/* Existing attachments */}
            <div className="space-y-4">
              <h3 className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documents attachés ({attachments.length})
              </h3>
              
              {attachments.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Paperclip className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>Aucune pièce jointe</p>
                  <p className="text-sm">Cliquez sur une catégorie ci-dessus pour ajouter un fichier</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {attachments.map((attachment) => {
                    const FileIcon = getFileIcon(attachment.type);
                    return (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                            <FileIcon className="w-5 h-5 text-white/60" />
                          </div>
                          <div>
                            <p className="font-medium text-white text-sm truncate max-w-[200px]">
                              {attachment.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-white/50">
                              <span>{attachment.categoryName}</span>
                              <span>•</span>
                              <span>{formatFileSize(attachment.size)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(attachment.path, '_blank')}
                            className="text-sky-400 hover:text-sky-300 hover:bg-white/10"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAttachment(attachment.id)}
                            className="text-rose-400 hover:text-rose-300 hover:bg-white/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => {
              setShowAttachmentsModal(false);
              setAttachments([]);
              setAttachmentsEventId(null);
            }}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generation Overlay */}
      {generationStatus.step !== 'idle' && (
        <AIGenerationOverlay 
          status={generationStatus} 
          onCancel={cancelGeneration} 
        />
      )}
    </div>
  );
}

// Main App Component
function AppContent() {
  const { user, isLoading: authLoading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  // Fetch trips when user is authenticated
  useEffect(() => {
    if (user) {
      fetchTrips();
    } else {
      setTrips([]);
      setTripsLoading(false);
    }
  }, [user]);

  const fetchTrips = async () => {
    setTripsLoading(true);
    try {
      const response = await fetch('/api/trips');
      const data = await response.json();
      if (response.ok) {
        setTrips(data.trips || []);
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setTripsLoading(false);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setTrips(trips.filter((t) => t.id !== tripId));
      }
    } catch (error) {
      console.error('Error deleting trip:', error);
    }
  };

  const handleTripCreated = (trip: Trip) => {
    setShowWizard(false);
    setTrips([trip, ...trips]);
    setSelectedTrip(trip);
  };

  const handleTripUpdate = (updatedTrip: Trip) => {
    setTrips(trips.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
    setSelectedTrip(updatedTrip);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // Not authenticated: show landing page
  if (!user) {
    return (
      <>
        <LandingPage
          onSignIn={() => {
            setAuthMode('signin');
            setShowAuth(true);
          }}
          onSignUp={() => {
            setAuthMode('signup');
            setShowAuth(true);
          }}
        />
        <AuthModal
          isOpen={showAuth}
          mode={authMode}
          onClose={() => setShowAuth(false)}
          onSwitchMode={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
        />
      </>
    );
  }

  // Trip selected: show editor
  if (selectedTrip) {
    return (
      <TripEditor
        trip={selectedTrip}
        onBack={() => setSelectedTrip(null)}
        onTripUpdate={handleTripUpdate}
      />
    );
  }

  // Authenticated: show dashboard
  return (
    <>
      <Dashboard
        trips={trips}
        isLoading={tripsLoading}
        onCreateTrip={() => setShowWizard(true)}
        onSelectTrip={setSelectedTrip}
        onDeleteTrip={handleDeleteTrip}
      />
      <TripWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleTripCreated}
      />
    </>
  );
}

// Main Page Export
export default function Page() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster />
    </AuthProvider>
  );
}
