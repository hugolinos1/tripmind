# TripMind - Fichier Contexte pour Vibe Coding

## 🎯 Résumé Exécutif

TripMind est une application de planification de voyages intelligente qui utilise l'IA pour générer des itinéraires personnalisés. L'application permet aux utilisateurs de créer des voyages, d'obtenir des recommandations automatiques, et d'organiser tous les aspects de leurs déplacements.

---

## 📁 Structure du Projet

```
/home/z/my-project/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Application principale (5000+ lignes)
│   │   ├── layout.tsx            # Layout racine avec providers
│   │   ├── globals.css           # Styles globaux
│   │   └── api/                  # Routes API
│   │       ├── auth/             # Authentification
│   │       ├── trips/            # Gestion des voyages
│   │       ├── events/           # Gestion des événements
│   │       ├── days/             # Gestion des journées
│   │       ├── ai/               # Endpoints IA
│   │       ├── images/           # Recherche d'images
│   │       ├── destinations/     # Images de destinations
│   │       └── uploads/          # Fichiers uploadés
│   ├── components/
│   │   └── ui/                   # Composants shadcn/ui
│   └── lib/
│       └── db.ts                 # Client Prisma
├── prisma/
│   └── schema.prisma             # Schéma de la base de données
├── uploads/                      # Stockage des pièces jointes
├── db/                           # Base de données SQLite
├── .env                          # Variables d'environnement
├── SPECIFICATIONS.md             # Cahier des charges détaillé
└── CONTEXTE.md                   # Ce fichier
```

---

## 🔧 Stack Technique

| Composant | Technologie | Notes |
|-----------|-------------|-------|
| Framework | Next.js 16 | App Router, TypeScript |
| Base de données | SQLite | Via Prisma ORM |
| Auth | Custom sessions | Cookies HTTP-only, UUID tokens |
| UI | shadcn/ui | New York style, Tailwind CSS |
| Maps | React-Leaflet | OpenStreetMap tiles |
| IA | OpenRouter | Model: openrouter/free |
| Images | Unsplash + Lorem Picsum | Fallback system |
| Runtime | Bun | Package manager + runtime |

---

## 🗄️ Modèles de Données

### User
```typescript
{
  id: string;           // CUID
  email: string;        // Unique
  passwordHash: string; // bcrypt
  name: string | null;
  avatar: string | null;
  language: string;     // Default: "fr"
  currency: string;     // Default: "EUR"
}
```

### Trip
```typescript
{
  id: string;
  userId: string;
  title: string;
  destinations: string[];  // JSON array
  startDate: Date;
  endDate: Date;
  travelers: {
    adults: number;
    children: string[];    // Ages
    hasPets: boolean;
  };
  preferences: {
    pace: number;          // 0-100
    budget: number;        // 0-100
    interests: string[];
    accessibility: string[];
    dietary: string[];
    alreadyVisited: string[];
    mustSee: string[];
  };
  status: 'draft' | 'active' | 'completed' | 'archived';
  shareToken: string | null;
  days: Day[];
}
```

### Day
```typescript
{
  id: string;
  tripId: string;
  date: Date;
  orderIndex: number;
  notes: string | null;
  startLocation: { name, address, lat, lng };
  endLocation: { name, address, lat, lng };
  events: Event[];
}
```

### Event
```typescript
{
  id: string;
  dayId: string;
  type: 'visit' | 'meal' | 'transport' | 'accommodation' | 'activity';
  title: string;
  description: string | null;
  startTime: string | null;      // HH:mm
  durationMinutes: number | null;
  location: { name, address, lat, lng };
  photos: string[];              // URLs
  practicalInfo: {
    openingHours: string;
    priceRange: string;
    tips: string[];
    bestTimeToVisit: string;
  };
  estimatedBudget: number | null;
  isAiEnriched: boolean;
  attachments: Attachment[];
  orderIndex: number;
}
```

### Attachment
```typescript
{
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: 'billet' | 'voucher' | 'reservation' | 'itineraire' | 'contrat' | 'autre';
  uploadedAt: string;
}
```

---

## 🎨 Palette de Couleurs

```css
/* Couleurs principales */
--primary: #f59e0b;        /* Amber - Accent principal */
--secondary: #ef4444;      /* Rouge - Accent secondaire */

/* Types d'événements */
--visit: #f59e0b;          /* Amber */
--meal: #f43f5e;           /* Rose */
--transport: #0ea5e9;      /* Sky */
--accommodation: #10b981;  /* Emerald */
--activity: #a855f7;       /* Purple */

/* Backgrounds */
--bg-dark: #0f172a;        /* Slate 900 */
--bg-card: rgba(255, 255, 255, 0.05);
--glass: rgba(0, 0, 0, 0.4);
--glass-light: rgba(255, 255, 255, 0.05);
```

---

## 🔌 Endpoints API

### Authentification
```
POST /api/auth/signup     # Inscription
POST /api/auth/signin     # Connexion
POST /api/auth/signout    # Déconnexion
GET  /api/auth/me         # Utilisateur courant
PATCH /api/auth/profile   # Mise à jour profil
```

### Voyages
```
GET    /api/trips              # Liste des voyages
POST   /api/trips              # Créer un voyage
GET    /api/trips/[id]         # Détails d'un voyage
PUT    /api/trips/[id]         # Modifier un voyage
DELETE /api/trips/[id]         # Supprimer (soft)
PUT    /api/trips/[id]/preferences  # Modifier préférences
POST   /api/trips/[id]/share   # Générer lien de partage
DELETE /api/trips/[id]/share   # Révoquer partage
GET    /api/trips/[id]/export  # Export HTML
```

### Événements
```
POST   /api/events             # Créer événement
PUT    /api/events/[id]        # Modifier événement
DELETE /api/events/[id]        # Supprimer événement
GET    /api/events/[id]/attachment   # Liste pièces jointes
POST   /api/events/[id]/attachment   # Upload pièce jointe
DELETE /api/events/[id]/attachment   # Supprimer pièce jointe
```

### IA
```
POST /api/ai/recommend          # Générer itinéraire
POST /api/ai/enrich             # Enrichir événement
POST /api/ai/transport          # Infos transport
GET  /api/ai/trip-info          # Infos destination complète
GET  /api/ai/trip-info-section  # Section spécifique
```

### Images
```
GET /api/images/search          # Rechercher images
GET /api/destinations/image     # Image destination
```

---

## 🤖 Intégration IA

### OpenRouter Configuration
```typescript
const OPENROUTER_CONFIG = {
  url: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'openrouter/free',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://tripmind.app',
    'X-Title': 'Tripmind - Travel Planning'
  },
  defaultParams: {
    temperature: 0.7,
    max_tokens: 2000
  }
};
```

### Sections "À Savoir"
```typescript
const TRIP_INFO_SECTIONS = [
  'vocabulary',      // Vocabulaire local
  'gastronomy',      // Gastronomie
  'customs',         // Coutumes
  'currency',        // Monnaie et budget
  'prices',          // Ordres de prix
  'prohibitions',    // Interdits et arnaques
  'mustSee',         // Incontournables
  'transportation',  // Transports
  'weather',         // Météo
  'emergency'        // Urgences
];
```

### Fallback Data
Tous les endpoints IA ont des données de fallback génériques si l'API n'est pas disponible.

---

## 🗺️ Intégration Cartes

### React-Leaflet Setup
```typescript
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

// Tiles avec thème sombre
const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

// Marqueurs par type
const MARKER_COLORS = {
  visit: '#f59e0b',
  meal: '#f43f5e',
  transport: '#0ea5e9',
  accommodation: '#10b981',
  activity: '#a855f7'
};
```

### Géocodage (Nominatim)
```typescript
const geocode = async (query: string) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`,
    {
      headers: {
        'User-Agent': 'TripMind/1.0',
        'Accept': 'application/json'
      }
    }
  );
  return response.json();
};
```

---

## 🔐 Authentification

### Cookie Configuration
```typescript
const COOKIE_OPTIONS = {
  name: 'auth_token',
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 // 30 jours
  }
};
```

### Session Flow
1. Login/Signup → Generate UUID token
2. Store session in DB with expiration (30 days)
3. Set HTTP-only cookie
4. On each request → Validate session token
5. Auto-cleanup expired sessions

---

## 📱 Responsive Design

### Breakpoints
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

### Mobile-First Patterns
- Sidebar collapses to bottom navigation
- Horizontal scroll for day selector
- Full-screen modals on mobile
- Touch-friendly 44px targets

---

## 🎯 Comportements Clés

### Création de Voyage
1. Wizard 3 étapes
2. Auto-génération des jours
3. Option de génération IA

### Génération IA
1. Progress overlay avec étapes
2. Retry automatique (3 max)
3. Fallback si échec
4. Géocodage automatique

### Propagation des Lieux
- Modifier endLocation → propage au startLocation du jour suivant
- Modifier startLocation → propage au endLocation du jour précédent

### Enrichissement Événement
1. Appel IA pour détails
2. Géocodage si non présent
3. Recherche d'images
4. Mise à jour atomique

---

## 🖼️ Gestion des Images

### Sources (par priorité)
1. Unsplash API (images réelles)
2. Lorem Picsum (fallback aléatoire)

### Cache Strategy
- Browser cache pour les URLs
- Seed-based URLs pour cohérence

### Formats
```typescript
// Destination hero
width: 800, height: 400

// Event thumbnail  
width: 400, height: 300

// Avatar
width: 100, height: 100
```

---

## 📎 Upload de Fichiers

### Configuration
```typescript
const UPLOAD_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'application/pdf',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/html'
  ],
  categories: ['billet', 'voucher', 'reservation', 'itineraire', 'contrat', 'autre']
};
```

### Stockage
- Files saved to `/uploads/` directory
- Unique filename: `{eventId}_{timestamp}_{randomId}.{ext}`
- Metadata stored in Event.attachments JSON

---

## 🧪 Points d'Attention pour Reconstruction

### 1. Authentication
- Toujours utiliser des cookies HTTP-only
- Ne jamais stocker le token dans localStorage
- Valider la session sur chaque requête API

### 2. Géocodage
- Rate limiting Nominatim (1 req/sec)
- Toujours inclure User-Agent header
- Gérer les échecs de géocodage gracieusement

### 3. IA
- Parser le JSON avec gestion d'erreurs
- Implémenter les fallbacks pour chaque section
- Timeout approprié pour les longues requêtes

### 4. Maps
- Charger React-Leaflet dynamiquement (SSR issues)
- Utiliser des icônes custom pour les marqueurs
- Gérer le cas où lat/lng est null

### 5. State Management
- Utiliser des fonctions de mise à jour pour l'état imbriqué
- Implémenter le polling pour les opérations longues
- Optimistic updates pour les interactions rapides

### 6. Responsive
- Tester sur mobile en priorité
- Horizontal scroll avec snap pour les jours
- Modals en plein écran sur mobile

---

## 📦 Dépendances Principales

```json
{
  "dependencies": {
    "next": "^16.x",
    "react": "^19.x",
    "typescript": "^5.x",
    "prisma": "latest",
    "@prisma/client": "latest",
    "bcryptjs": "^2.x",
    "uuid": "^9.x",
    "leaflet": "^1.x",
    "react-leaflet": "^4.x",
    "lucide-react": "latest",
    "tailwindcss": "^4.x",
    "@radix-ui/react-*": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest"
  }
}
```

---

## 🚀 Commandes de Développement

```bash
# Installation
bun install

# Base de données
bun run db:push

# Développement
bun run dev

# Build
bun run build

# Lint
bun run lint
```

---

## 🌍 Variables d'Environnement

```env
# Required
DATABASE_URL=file:/path/to/database.db
OPENROUTER_API_KEY=sk-or-v1-xxx

# Optional
NEXT_PUBLIC_URL=https://your-domain.com
```

---

## 📝 Notes de Reconstruction

1. **Commencer par**: Schéma Prisma → Routes API → UI
2. **Ordre des composants**: Landing → Auth → Dashboard → Wizard → Editor
3. **Tester chaque section** indépendamment avant intégration
4. **Valider** que les types TypeScript correspondent aux données Prisma
5. **Implémenter les fallbacks** IA dès le début

---

*Document mis à jour pour TripMind v1.0*
*Optimisé pour les outils de Vibe Coding*
