# TripMind - Cahier des Charges Détaillé

## 📋 Document d'Architecture et Spécifications Techniques

**Version:** 1.0  
**Date:** 2024  
**Application:** TripMind - Planificateur de Voyage Intelligent

---

## 1. VUE D'ENSEMBLE DU PROJET

### 1.1 Description
TripMind est une application web de planification de voyages alimentée par l'IA qui permet aux utilisateurs de créer des itinéraires personnalisés, d'obtenir des recommandations intelligentes et d'organiser tous les aspects de leurs voyages.

### 1.2 Objectifs Principaux
- Permettre la création de voyages personnalisés avec destinations multiples
- Générer automatiquement des itinéraires journaliers via IA
- Enrichir les événements avec des informations pratiques
- Fournir un guide complet pour chaque destination (vocabulaire, gastronomie, coutumes, etc.)
- Permettre l'attachement de documents (billets, vouchers, réservations)
- Offrir une interface de partage de voyages

### 1.3 Stack Technologique

| Catégorie | Technologie | Version |
|-----------|-------------|---------|
| Framework | Next.js | 16.x (App Router) |
| Langage | TypeScript | 5.x |
| Base de données | SQLite | Via Prisma ORM |
| ORM | Prisma | Latest |
| UI Components | shadcn/ui | New York style |
| Styling | Tailwind CSS | 4.x |
| Icons | Lucide React | Latest |
| Maps | React-Leaflet | Latest |
| Cartes | OpenStreetMap | Via Nominatim |
| IA | OpenRouter API | Model: openrouter/free |
| Images | Unsplash + Lorem Picsum | Fallback system |
| Runtime | Bun | Latest |

---

## 2. STRUCTURE DE LA BASE DE DONNÉES

### 2.1 Modèle User (Utilisateur)

```prisma
model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String?
  name         String?
  avatar       String?
  language     String     @default("fr")
  currency     String     @default("EUR")
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  
  sessions     Session[]
  trips        Trip[]
  
  @@map("users")
}
```

**Champs:**
- `id`: Identifiant unique CUID
- `email`: Email unique de l'utilisateur
- `passwordHash`: Hash bcrypt du mot de passe (nullable pour OAuth futur)
- `name`: Nom d'affichage
- `avatar`: URL de l'avatar
- `language`: Langue préférée (défaut: "fr")
- `currency`: Devise préférée (défaut: "EUR")

### 2.2 Modèle Session

```prisma
model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("sessions")
}
```

**Champs:**
- `token`: UUID unique pour l'identification de session
- `expiresAt`: Date d'expiration (30 jours après création)

### 2.3 Modèle Trip (Voyage)

```prisma
model Trip {
  id           String    @id @default(cuid())
  userId       String
  title        String
  destinations String    // JSON array: ["Paris", "Lyon"]
  startDate    DateTime
  endDate      DateTime
  travelers    String    // JSON: {adults: number, children: string[], hasPets: boolean}
  preferences  String    // JSON: voir structure ci-dessous
  status       String    @default("draft")
  shareToken   String?   @unique
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  days         Day[]
  
  @@map("trips")
}
```

**Structure JSON `travelers`:**
```typescript
{
  adults: number,           // Nombre d'adultes
  children: string[],       // Âges des enfants: ["5", "8", "12"]
  hasPets: boolean          // Animaux de compagnie
}
```

**Structure JSON `preferences`:**
```typescript
{
  pace: number,             // 0-100: relaxed → intense
  budget: number,           // 0-100: economic → luxury
  interests: string[],      // ["culture", "nature", "gastronomy", ...]
  accessibility: string[],  // ["wheelchair", "reduced-mobility", ...]
  dietary: string[],        // ["vegetarian", "vegan", "halal", ...]
  alreadyVisited: string[], // Lieux déjà visités
  mustSee: string[]         // Lieux à voir absolument
}
```

**Valeurs `status`:**
- `draft`: En cours de création
- `active`: Voyage actif
- `completed`: Voyage terminé
- `archived`: Voyage archivé

### 2.4 Modèle Day (Journée)

```prisma
model Day {
  id                  String   @id @default(cuid())
  tripId              String
  date                DateTime
  orderIndex          Int
  notes               String?
  
  // Lieu de départ
  startLocationName    String?
  startLocationAddress String?
  startLat            Float?
  startLng            Float?
  
  // Lieu d'arrivée
  endLocationName      String?
  endLocationAddress   String?
  endLat              Float?
  endLng              Float?
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  trip                Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  events              Event[]
  
  @@index([tripId])
  @@index([tripId, orderIndex])
  @@map("days")
}
```

### 2.5 Modèle Event (Événement)

```prisma
model Event {
  id               String   @id @default(cuid())
  dayId            String
  type             String   // visit, meal, transport, accommodation, activity
  title            String
  description      String?
  startTime        String?  // Format HH:mm
  durationMinutes  Int?
  
  // Localisation
  locationName     String?
  locationAddress  String?
  lat              Float?
  lng              Float?
  
  // Médias et infos
  photos           String   @default("[]")  // JSON array of URLs
  practicalInfo    String   // JSON: {openingHours, priceRange, tips[], bestTimeToVisit}
  estimatedBudget  Float?
  isAiEnriched     Boolean  @default(false)
  sourceUrl        String?
  attachments      String   @default("[]")  // JSON array
  orderIndex       Int      @default(0)
  
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  day              Day      @relation(fields: [dayId], references: [id], onDelete: Cascade)
  enrichments      Enrichment[]
  
  @@index([dayId])
  @@index([dayId, orderIndex])
  @@map("events")
}
```

**Types d'événements et couleurs:**
| Type | Couleur | Icône |
|------|---------|-------|
| visit | Amber (#f59e0b) | MapPin |
| meal | Rose (#f43f5e) | Utensils |
| transport | Sky (#0ea5e9) | Bus |
| accommodation | Emerald (#10b981) | Home |
| activity | Purple (#a855f7) | Star |

**Structure JSON `practicalInfo`:**
```typescript
{
  openingHours: string,      // "9h-18h"
  priceRange: string,        // "10-20€"
  tips: string[],            // ["Arriver tôt le matin", ...]
  bestTimeToVisit: string    // "Matin pour éviter la foule"
}
```

**Structure JSON `attachments`:**
```typescript
[{
  id: string,
  filename: string,
  originalName: string,
  mimeType: string,
  size: number,
  category: "billet" | "voucher" | "reservation" | "itineraire" | "contrat" | "autre",
  uploadedAt: string
}]
```

### 2.6 Modèle Enrichment

```prisma
model Enrichment {
  id          String   @id @default(cuid())
  eventId     String
  rawResponse String   // JSON: réponse complète de l'IA
  tokensUsed  Int?
  createdAt   DateTime @default(now())
  
  event       Event    @relation(fields: [eventId], references: [id], onDelete: Cascade)
  
  @@map("enrichments")
}
```

---

## 3. API ENDPOINTS

### 3.1 Authentication

#### POST `/api/auth/signup`
**Description:** Inscription d'un nouvel utilisateur

**Request Body:**
```typescript
{
  email: string,      // Email valide, unique
  password: string,   // Min 6 caractères
  name?: string       // Nom optionnel
}
```

**Response:**
```typescript
{
  success: true,
  user: {
    id: string,
    email: string,
    name: string | null,
    avatar: string | null
  }
}
```

**Comportement:**
- Vérifie unicité de l'email
- Hash le mot de passe avec bcrypt (10 rounds)
- Crée une session automatiquement
- Définit un cookie HTTP-only `auth_token`

#### POST `/api/auth/signin`
**Description:** Connexion utilisateur

**Request Body:**
```typescript
{
  email: string,
  password: string
}
```

**Response:** Identique à signup

**Comportement:**
- Vérifie credentials
- Crée nouvelle session avec UUID token
- Cookie expire après 30 jours

#### POST `/api/auth/signout`
**Description:** Déconnexion

**Comportement:**
- Supprime la session de la DB
- Supprime le cookie

#### GET `/api/auth/me`
**Description:** Informations utilisateur courant

**Response:**
```typescript
{
  id: string,
  email: string,
  name: string | null,
  avatar: string | null,
  language: string,
  currency: string
}
```

#### PATCH `/api/auth/profile`
**Description:** Mise à jour du profil

**Request Body:**
```typescript
{
  name?: string,
  language?: string,
  currency?: string,
  avatar?: string
}
```

### 3.2 Trips

#### GET `/api/trips`
**Description:** Liste des voyages de l'utilisateur

**Response:**
```typescript
{
  trips: [{
    id: string,
    title: string,
    destinations: string[],  // JSON parsé
    startDate: string,
    endDate: string,
    status: string,
    days: [{
      id: string,
      date: string,
      orderIndex: number,
      events: [{
        id: string,
        type: string,
        title: string,
        // ... autres champs
      }]
    }]
  }]
}
```

**Requêtes DB:**
- Inclut les days ordonnés par orderIndex
- Inclut les events ordonnés par orderIndex
- Exclut les trips avec deletedAt non null

#### POST `/api/trips`
**Description:** Création d'un nouveau voyage

**Request Body:**
```typescript
{
  title: string,
  destinations: string[],   // ["Paris", "Lyon"]
  startDate: string,        // ISO date
  endDate: string,
  travelers: {
    adults: number,
    children: string[],
    hasPets: boolean
  },
  preferences: {
    pace: number,
    budget: number,
    interests: string[],
    accessibility: string[],
    dietary: string[],
    alreadyVisited: string[],
    mustSee: string[]
  }
}
```

**Comportement:**
- Crée le Trip
- Génère automatiquement les Day records entre startDate et endDate
- Attribue orderIndex séquentiel aux jours

#### GET `/api/trips/[id]`
**Description:** Détails d'un voyage

**Query Params:**
- `shareToken`: Optionnel, pour accès public

**Comportement:**
- Si shareToken fourni et valide, accès sans authentification
- Sinon, vérifie propriété de l'utilisateur

#### PUT `/api/trips/[id]`
**Description:** Mise à jour d'un voyage

**Request Body:** Champs partiels du Trip

#### DELETE `/api/trips/[id]`
**Description:** Suppression (soft delete)

**Comportement:**
- Set deletedAt = now()
- Ne supprime pas physiquement

#### PUT `/api/trips/[id]/preferences`
**Description:** Mise à jour des préférences

**Request Body:**
```typescript
{
  preferences?: {...},
  travelers?: {...},
  startDate?: string,
  endDate?: string
}
```

#### POST `/api/trips/[id]/share`
**Description:** Génère un token de partage

**Response:**
```typescript
{
  shareUrl: string,  // URL complète de partage
  shareToken: string
}
```

#### DELETE `/api/trips/[id]/share`
**Description:** Révoque le partage

#### GET `/api/trips/[id]/export`
**Description:** Export HTML imprimable

**Response:** HTML document complet avec styles inline

### 3.3 Events

#### POST `/api/events`
**Description:** Création d'un événement

**Request Body:**
```typescript
{
  dayId: string,
  type: "visit" | "meal" | "transport" | "accommodation" | "activity",
  title: string,
  description?: string,
  startTime?: string,        // HH:mm
  durationMinutes?: number,
  locationName?: string,
  locationAddress?: string,
  estimatedBudget?: number
}
```

#### PUT `/api/events/[id]`
**Description:** Mise à jour d'un événement

#### DELETE `/api/events/[id]`
**Description:** Suppression d'un événement

#### GET `/api/events/[id]/attachment`
**Description:** Liste des pièces jointes

#### POST `/api/events/[id]/attachment`
**Description:** Upload d'une pièce jointe

**Request:** FormData avec:
- `file`: File (max 10MB)
- `category`: "billet" | "voucher" | "reservation" | "itineraire" | "contrat" | "autre"

**Types MIME acceptés:**
- PDF: application/pdf
- Images: image/jpeg, image/png, image/gif, image/webp
- Documents: application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
- Excel: application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- Texte: text/plain, text/html

#### DELETE `/api/events/[id]/attachment`
**Description:** Suppression d'une pièce jointe

**Query Params:**
- `filename`: Nom du fichier à supprimer

### 3.4 Days

#### PUT `/api/days/[id]`
**Description:** Mise à jour d'une journée

**Request Body:**
```typescript
{
  notes?: string,
  startLocationName?: string,
  startLocationAddress?: string,
  startLat?: number,
  startLng?: number,
  endLocationName?: string,
  endLocationAddress?: string,
  endLat?: number,
  endLng?: number
}
```

**Propagation automatique:**
- Si endLocation modifié → propage au startLocation du jour suivant
- Si startLocation modifié → propage au endLocation du jour précédent

### 3.5 AI Endpoints

#### POST `/api/ai/recommend`
**Description:** Génération d'itinéraire IA

**Request Body:**
```typescript
{
  tripId: string
}
```

**Processus:**
1. Récupère les informations du voyage
2. Prépare le prompt avec destinations, dates, préférences
3. Appelle OpenRouter API
4. Parse la réponse JSON
5. Géocode les lieux via Nominatim
6. Crée les événements en base

**Prompt système:**
```
Tu es un expert en planification de voyage. Génère un itinéraire détaillé jour par jour.
Format JSON requis avec événements incluant: titre, description, heure, durée, localisation.
```

**Fallback:** Si IA indisponible, génère des événements génériques.

#### POST `/api/ai/enrich`
**Description:** Enrichissement d'un événement

**Request Body:**
```typescript
{
  eventId: string
}
```

**Response:**
```typescript
{
  success: true,
  event: {
    // Event enrichi avec description, practicalInfo, photos
  }
}
```

#### GET `/api/ai/trip-info`
**Description:** Informations complètes sur une destination

**Query Params:**
- `destinations`: string (comma-separated)

**Response:**
```typescript
{
  vocabulary: {
    basics: [{phrase, translation, pronunciation}],
    politeExpressions: [{phrase, translation}],
    foodTerms: [{term, translation}],
    usefulPhrases: [{phrase, translation, context}]
  },
  gastronomy: {
    specialties: [{name, description, whereToTry}],
    mealTimes: string,
    drinks: [{name, description, alcoholic}],
    streetFood: string[],
    foodEtiquette: string[]
  },
  customs: {
    greetings: string,
    tipping: string,
    dress: string,
    behavior: string,
    culturalNuances: string[]
  },
  currency: {
    name: string,
    exchangeRate: string,
    paymentMethods: string[],
    budget: {backpacker, midRange, luxury},
    tippingGuide: string
  },
  prices: {
    coffee, meal, restaurant, transport, taxi, hotel, museum, grocery
  },
  prohibitions: string[],
  scams: string[],
  mustSee: [{name, why, duration, bestTime}],
  hiddenGems: [{name, why, howToGet}],
  transportation: {
    fromAirport: {options: [{type, price, duration, details}]},
    localTransport: {types, passes, apps},
    tips: string[]
  },
  weather: {
    bestPeriod: string,
    seasons: {spring, summer, autumn, winter},
    whatToPack: string[],
    climateInfo: string
  },
  emergency: {
    numbers: {police, ambulance, fire, general},
    embassy: {address, phone, hours},
    usefulApps: string[],
    healthTips: string[]
  }
}
```

#### GET `/api/ai/trip-info-section`
**Description:** Section spécifique d'informations

**Query Params:**
- `destinations`: string
- `section`: "vocabulary" | "gastronomy" | "customs" | "currency" | "prices" | "prohibitions" | "mustSee" | "transportation" | "weather" | "emergency"

### 3.6 Images

#### GET `/api/images/search`
**Description:** Recherche d'images

**Query Params:**
- `query`: string

**Sources:**
1. Unsplash API (prioritaire)
2. Lorem Picsum (fallback)

#### GET `/api/destinations/image`
**Description:** Image d'une destination

**Query Params:**
- `destination`: string

**Cache:** Images mises en cache côté client

---

## 4. COMPOSANTS UI

### 4.1 Page Structure

```
App
├── LandingPage (non-auth)
│   ├── Hero Section
│   ├── Features Grid
│   └── CTA Section
│
├── AuthModal
│   ├── Sign In Form
│   └── Sign Up Form
│
├── Dashboard (auth)
│   ├── Header avec profil
│   ├── Trip Cards Grid
│   └── Create Trip Button
│
├── TripWizard
│   ├── Step 1: Essential
│   │   ├── Destinations (multi-select)
│   │   ├── Date Range Picker
│   │   └── Travelers Selector
│   ├── Step 2: Profile
│   │   ├── Pace Slider
│   │   ├── Budget Slider
│   │   └── Interests Checkboxes
│   └── Step 3: Constraints
│       ├── Accessibility Options
│       ├── Dietary Restrictions
│       └── Must-See Input
│
├── TripEditor
│   ├── Trip Header
│   ├── Tab Selector (Days | À Savoir)
│   ├── Day Selector (horizontal scroll)
│   ├── Event Cards (draggable)
│   ├── Map View
│   └── AI Generation Overlay
│
├── TripInfoSection
│   ├── Vocabulary Card
│   ├── Gastronomy Card
│   ├── Customs Card
│   ├── Currency Card
│   ├── Prices Card
│   ├── Prohibitions Card
│   ├── Must-See Card
│   ├── Transportation Card
│   ├── Weather Card
│   └── Emergency Card
│
├── EventModal
│   ├── Basic Info Form
│   ├── Location Picker
│   ├── Time Selector
│   └── Attachments Section
│
└── AttachmentsModal
    ├── File Upload
    ├── Category Selector
    └── Attachments List
```

### 4.2 Composants Détaillés

#### LandingPage
**Props:** `onSignIn, onSignUp`

**Structure:**
```tsx
<div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
  {/* Navigation */}
  <nav className="flex justify-between items-center p-6">
    <Logo />
    <Button onClick={onSignIn}>Se connecter</Button>
  </nav>
  
  {/* Hero */}
  <section className="container mx-auto px-6 py-20">
    <h1>Planifiez vos voyages avec l'IA</h1>
    <Button onClick={onSignUp}>Commencer gratuitement</Button>
  </section>
  
  {/* Features */}
  <section className="grid md:grid-cols-3 gap-8">
    {/* Feature cards */}
  </section>
</div>
```

#### TripWizard
**Props:** `onTripCreated, onCancel`

**State:**
```typescript
{
  step: 1 | 2 | 3,
  data: {
    title: string,
    destinations: string[],
    startDate: Date,
    endDate: Date,
    travelers: {adults: number, children: string[], hasPets: boolean},
    preferences: {...}
  }
}
```

**Validation Step 1:**
- Au moins une destination
- Dates valides (start < end)
- Au moins 1 adulte

#### TripEditor
**Props:** `trip, onBack, onTripUpdate`

**State:**
```typescript
{
  selectedDay: number,
  activeTab: 'days' | 'info',
  tripInfo: object | null,
  isLoadingInfo: boolean,
  loadingSections: Record<string, boolean>,
  showAddEvent: boolean,
  showShareModal: boolean,
  showAttachmentsModal: boolean,
  attachmentsEventId: string | null
}
```

#### DayMap
**Props:** `events, startLocation, endLocation`

**Comportement:**
- Affiche les marqueurs colorés par type d'événement
- Marqueurs spéciaux pour start/end du jour
- Popups avec info de l'événement
- Tiles OpenStreetMap avec filtre sombre

#### TripInfoSection
**Props:** 
```typescript
{
  destinations: string[],
  tripInfo: object,
  loadingSections: Record<string, boolean>,
  onRefreshSection: (section: string) => void
}
```

**Sections avec refresh individuel:**
- Chaque section a un bouton refresh
- Loading skeleton pendant le chargement
- Affichage conditionnel des sous-sections

### 4.3 Styles CSS Personnalisés

```css
/* Glass effects */
.glass {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-light {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Gradient text */
.gradient-text {
  background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
```

---

## 5. INTÉGRATIONS EXTERNES

### 5.1 OpenRouter API

**Configuration:**
```typescript
const config = {
  url: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'openrouter/free',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://tripmind.app',
    'X-Title': 'Tripmind - Travel Planning'
  }
};
```

**Parameters par défaut:**
```typescript
{
  temperature: 0.7,
  max_tokens: 2000 // Variable selon endpoint
}
```

**Prompt Templates:**

**Itinéraire:**
```
Système: Tu es un expert en planification de voyage.
Utilisateur: Génère un itinéraire pour {destinations} du {startDate} au {endDate}.
Préférences: pace={pace}, budget={budget}, interests={interests}.
Réponds en JSON avec la structure: {...}
```

**Enrichissement:**
```
Système: Tu es un guide touristique expert.
Utilisateur: Donne des infos pratiques sur "{title}" à {location}.
Réponds en JSON avec: {description, openingHours, priceRange, tips[]}
```

### 5.2 Unsplash API

**Configuration:**
```typescript
const UNSPLASH_ACCESS_KEY = '6jD8PKhN5pLPZpPxXhLQPgDZZL86f7IlR31CqLQw';

const searchImages = async (query: string) => {
  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1`,
    {
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
      }
    }
  );
  // Returns: {results: [{urls: {regular, small}}]}
};
```

### 5.3 Nominatim (Geocoding)

**Configuration:**
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
  // Returns: [{lat, lon, display_name}]
};
```

### 5.4 Lorem Picsum (Fallback Images)

**URL Pattern:**
```
https://picsum.photos/seed/{seed}/{width}/{height}
```

**Usage:**
```typescript
const getFallbackImage = (destination: string, width: number, height: number) => {
  const seed = destination.toLowerCase().replace(/\s+/g, '-');
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
};
```

---

## 6. FLUX UTILISATEUR

### 6.1 Inscription / Connexion

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Landing     │───>│ AuthModal   │───>│ Dashboard   │
│ Page        │    │ (SignIn)    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          v
                   ┌─────────────┐
                   │ Créer compte│
                   │ (SignUp)    │
                   └─────────────┘
```

### 6.2 Création de Voyage

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Dashboard   │───>│ Wizard      │───>│ Wizard      │───>│ TripEditor  │
│             │    │ Step 1      │    │ Step 2-3    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                               │
                                                               v
                                                        ┌─────────────┐
                                                        │ AI Gen      │
                                                        │ Overlay     │
                                                        └─────────────┘
```

### 6.3 Génération IA

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ TripEditor  │───>│ Click "Générer"   │───>│ Show Overlay│───>│ Events      │
│             │    │             │    │ Progress    │    │ Created     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                          │
                          v
                   ┌─────────────┐
                   │ OpenRouter  │
                   │ API Call    │
                   └─────────────┘
```

### 6.4 Enrichissement Événement

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Event Card  │───>│ Click       │───>│ Loading     │───>│ Card        │
│             │    │ "Enrichir"  │    │ Spinner     │    │ Updated     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

---

## 7. SÉCURITÉ

### 7.1 Authentification

**Cookie Configuration:**
```typescript
{
  name: 'auth_token',
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 // 30 jours
  }
}
```

**Session Management:**
- Token UUID v4 unique
- Expiration automatique après 30 jours
- Suppression des sessions expirées (cleanup)

### 7.2 Validation des Données

**Email:** Format email valide, unique
**Password:** Minimum 6 caractères
**File Upload:** 
- Max 10MB
- Types MIME whitelistés
- Sanitization du nom de fichier

### 7.3 Authorization

**Trip Access:**
- Vérification `trip.userId === session.userId`
- Accès public via `shareToken` unique

**Event Access:**
- Vérification via `day.trip.userId`

---

## 8. GESTION D'ERREURS

### 8.1 API Errors

**Format de réponse d'erreur:**
```typescript
{
  error: string,  // Message lisible
  details?: any   // Debug info (dev only)
}
```

**Codes HTTP:**
- 400: Bad Request (validation)
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

### 8.2 Fallbacks IA

**Comportement sans API key:**
- Retourne des données génériques
- `warning` field dans la réponse

**Comportement erreur API:**
- Retry avec exponential backoff
- Max 3 retries
- Timeout: 30s par appel

---

## 9. PERFORMANCE

### 9.1 Optimisations Frontend

**Code Splitting:**
- Lazy loading des composants lourds (Map)
- Dynamic imports pour les modals

**State Management:**
- Local state avec useState
- Pas de global state library

**Images:**
- Lazy loading
- Placeholder pendant chargement
- Cache navigateur

### 9.2 Optimisations Backend

**Database:**
- Index sur les foreign keys
- Index composites pour les queries fréquentes
- Soft delete pour les trips

**API:**
- JSON parsing avec fallback
- Streaming désactivé (compatibilité)

---

## 10. ENVIRONNEMENT ET DÉPLOIEMENT

### 10.1 Variables d'Environnement

```env
# Database
DATABASE_URL=file:/path/to/database.db

# AI
OPENROUTER_API_KEY=sk-or-v1-xxx

# App
NEXT_PUBLIC_URL=https://tripmind.app
```

### 10.2 Scripts

```json
{
  "dev": "bun --hot next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "db:push": "prisma db push",
  "db:studio": "prisma studio"
}
```

### 10.3 Structure des Dossiers

```
tripmind/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Main application
│   │   ├── layout.tsx        # Root layout
│   │   ├── globals.css       # Global styles
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── signin/route.ts
│   │       │   ├── signup/route.ts
│   │       │   ├── signout/route.ts
│   │       │   └── me/route.ts
│   │       ├── trips/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       ├── events/
│   │       ├── days/
│   │       ├── ai/
│   │       │   ├── recommend/route.ts
│   │       │   ├── enrich/route.ts
│   │       │   ├── trip-info/route.ts
│   │       │   └── trip-info-section/route.ts
│   │       └── images/
│   │           └── search/route.ts
│   ├── components/
│   │   └── ui/               # shadcn/ui components
│   └── lib/
│       └── db.ts             # Prisma client
├── prisma/
│   └── schema.prisma
├── uploads/                  # File attachments
├── public/
│   └── images/
├── .env
├── package.json
└── tailwind.config.ts
```

---

## 11. TESTS ET QUALITÉ

### 11.1 Linting

**ESLint Configuration:**
```json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

### 11.2 Types TypeScript

**Types principaux:**
```typescript
interface Trip {
  id: string;
  title: string;
  destinations: string[];
  startDate: Date;
  endDate: Date;
  travelers: Travelers;
  preferences: Preferences;
  status: 'draft' | 'active' | 'completed' | 'archived';
  days: Day[];
}

interface Event {
  id: string;
  type: EventType;
  title: string;
  description?: string;
  startTime?: string;
  durationMinutes?: number;
  location?: Location;
  practicalInfo?: PracticalInfo;
  attachments: Attachment[];
}

type EventType = 'visit' | 'meal' | 'transport' | 'accommodation' | 'activity';
```

---

## 12. FONCTIONNALITÉS FUTURES (Roadmap)

### Phase 2
- [ ] OAuth (Google, Apple)
- [ ] Collaborative editing
- [ ] Offline support (PWA)
- [ ] Push notifications
- [ ] Budget tracking

### Phase 3
- [ ] Hotel booking integration
- [ ] Flight search
- [ ] Weather integration
- [ ] Currency conversion live
- [ ] Multi-language support

---

## 13. ANNEXES

### 13.1 Liste des Intérêts

```typescript
const INTERESTS = [
  { id: 'culture', label: 'Culture & Histoire', icon: 'Landmark' },
  { id: 'nature', label: 'Nature & Paysages', icon: 'Trees' },
  { id: 'gastronomy', label: 'Gastronomie', icon: 'Utensils' },
  { id: 'shopping', label: 'Shopping', icon: 'ShoppingBag' },
  { id: 'sports', label: 'Sports & Aventure', icon: 'Mountain' },
  { id: 'nightlife', label: 'Vie nocturne', icon: 'Moon' },
  { id: 'wellness', label: 'Bien-être', icon: 'Spa' },
  { id: 'adventure', label: 'Aventure', icon: 'Compass' },
  { id: 'family', label: 'En famille', icon: 'Users' }
];
```

### 13.2 Options d'Accessibilité

```typescript
const ACCESSIBILITY_OPTIONS = [
  { id: 'wheelchair', label: 'Fauteuil roulant' },
  { id: 'reduced-mobility', label: 'Mobilité réduite' },
  { id: 'visual-impairment', label: 'Malvoyant' },
  { id: 'hearing-impairment', label: 'Malentendant' },
  { id: 'elderly', label: 'Personnes âgées' }
];
```

### 13.3 Restrictions Alimentaires

```typescript
const DIETARY_OPTIONS = [
  { id: 'vegetarian', label: 'Végétarien' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'halal', label: 'Halal' },
  { id: 'kosher', label: 'Casher' },
  { id: 'gluten-free', label: 'Sans gluten' },
  { id: 'lactose-free', label: 'Sans lactose' }
];
```

---

**Document généré pour TripMind v1.0**
*Ce cahier des charges est conçu pour permettre une reconstruction complète de l'application par un outil de Vibe Coding.*
