import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// OpenRouter configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.user;
}

// Check if OpenRouter is configured
function isOpenRouterConfigured(): boolean {
  const apiKey = process.env.OPENROUTER_API_KEY;
  return !!apiKey && apiKey !== 'your-openrouter-api-key-here' && apiKey.length > 10;
}

// Call OpenRouter API
async function callOpenRouter(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey || apiKey === 'your-openrouter-api-key-here') {
    return null;
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://tripmind.app',
        'X-Title': 'Tripmind - Travel Planning',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('OpenRouter call failed:', error);
    return null;
  }
}

// Extract JSON from AI response
function extractJson(aiResponse: string): any {
  if (!aiResponse) return null;
  
  try {
    let jsonStr = aiResponse;
    
    // Try markdown code blocks first
    const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      // Find JSON object with balanced braces
      const startIndex = aiResponse.indexOf('{');
      if (startIndex === -1) return null;
      
      let braceCount = 0;
      let endIndex = aiResponse.length;
      let inString = false;
      let escapeNext = false;
      
      for (let i = startIndex; i < aiResponse.length; i++) {
        const char = aiResponse[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }
      }
      
      jsonStr = aiResponse.substring(startIndex, endIndex);
      
      // Try to fix incomplete JSON
      if (braceCount > 0) {
        if (inString) jsonStr += '"';
        while (braceCount > 0) {
          jsonStr += '}';
          braceCount--;
        }
      }
    }
    
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('JSON parse error:', e);
    return null;
  }
}

// Section-specific prompts
const SECTION_PROMPTS: Record<string, { system: string; user: (destinations: string) => string }> = {
  vocabulary: {
    system: `Tu es un expert linguistique spécialisé dans les langues des destinations touristiques.

IMPORTANT: Tu DOIS répondre EN FRANÇAIS. Tout le contenu explicatif doit être en français.

Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.

Fournis le vocabulaire dans la LANGUE LOCALE de la destination (pas en anglais sauf si c'est un pays anglophone).

Format de réponse:
{
  "basics": [
    {"phrase": "Expression locale", "translation": "Traduction française", "pronunciation": "Prononciation phonétique"}
  ],
  "politeExpressions": [
    {"phrase": "Expression polie locale", "translation": "Traduction française"}
  ],
  "foodTerms": [
    {"term": "Terme culinaire local", "translation": "Traduction française"}
  ],
  "usefulPhrases": [
    {"phrase": "Phrase utile locale", "translation": "Traduction française", "context": "Quand l'utiliser"}
  ]
}

Donne 8-10 expressions de base, 5-6 expressions polies, 10 termes culinaires, et 6-8 phrases utiles.
Les phrases doivent être dans la LANGUE NATALE du pays visité, pas en anglais!`,
    user: (destinations) => `Donne-moi le vocabulaire essentiel pour voyager à ${destinations}.

IMPORTANT: Les expressions doivent être dans la LANGUE LOCALE de ${destinations}, PAS en anglais (sauf si c'est un pays anglophone).

Pour chaque expression:
1. L'expression dans la langue locale
2. Sa traduction en FRANÇAIS
3. La prononciation phonétique pour un francophone

Donne des expressions vraiment utiles pour un touriste: salutations, commandes au restaurant, demandes de direction, achats, urgences.`
  },

  gastronomy: {
    system: `Tu es un expert gastronomique spécialisé dans les cuisines du monde.

IMPORTANT: Tu DOIS répondre EN FRANÇAIS.

Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.

Format de réponse:
{
  "specialties": [
    {"name": "Nom du plat", "description": "Description appétissante avec ingrédients principaux", "whereToTry": "Type de lieu où le déguster"}
  ],
  "mealTimes": "Horaires et culture des repas",
  "drinks": [
    {"name": "Nom de la boisson", "description": "Description et quand la boire", "alcoholic": true}
  ],
  "streetFood": ["Street food 1 avec brève description", "Street food 2"],
  "foodEtiquette": ["Règle d'étiquette importante 1", "Règle 2"]
}

Donne 6-8 spécialités avec descriptions détaillées, 4-6 boissons, 4-5 street foods, et 4-5 règles d'étiquette.
Sois SPÉCIFIQUE: donne les VRAIS noms des plats, pas des généralités!`,
    user: (destinations) => `Décris la gastronomie de ${destinations} avec des détails précis.

Je veux les VRAIS plats typiques avec leurs noms authentiques, pas des généralités.
Pour chaque plat: nom local, ingrédients principaux, comment c'est préparé, où le trouver.

Inclus aussi:
- Les boissons typiques (avec et sans alcool)
- La street food populaire
- Les règles d'étiquette à table (comment manger, tabous alimentaires)`
  },

  customs: {
    system: `Tu es un expert en cultures et coutumes mondiales.

IMPORTANT: Tu DOIS répondre EN FRANÇAIS.

Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.

Format de réponse:
{
  "greetings": "Description détaillée: comment se saluer, nombre de bises, poignée de main, inclinaison...",
  "tipping": "Pourcentages exacts selon les situations (restaurant, taxi, hôtel...)",
  "dress": "Tenues appropriées et inappropriées selon les contextes",
  "behavior": "Comportements importants à adopter ou éviter",
  "culturalNuances": ["Nuance culturelle importante 1", "Nuance 2"]
}

Sois TRÈS SPÉCIFIQUE sur les coutumes locales. Les voyageurs doivent savoir exactement comment se comporter.`,
    user: (destinations) => `Explique les coutumes et la culture de ${destinations} en détail.

Je veux des informations PRÉCISES et ACTIONNABLES:
- Comment se saluer exactement (bises, poignée, inclination, geste spécifique?)
- Combien donner de pourboire et quand (pourcentages exacts)
- Comment s'habiller selon les lieux (temples, restaurants, plage...)
- Comportements à adopter ou éviter absolument
- Tabous culturels à respecter`
  },

  currency: {
    system: `Tu es un expert en finances et budgets voyage.

IMPORTANT: Tu DOIS répondre EN FRANÇAIS.

Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.

Format de réponse:
{
  "name": "Nom de la monnaie locale",
  "code": "Code ISO (ex: JPY, USD)",
  "exchangeRate": "1 EUR = X devise (taux approximatif actuel)",
  "paymentMethods": ["Méthode 1", "Méthode 2"],
  "budget": {
    "backpacker": "Budget minimal en €/jour",
    "midRange": "Budget confortable en €/jour", 
    "luxury": "Budget luxe en €/jour"
  },
  "tippingGuide": "Guide précis des pourboires par situation",
  "atmAdvice": "Conseils pour les retraits et changes"
}

Donne des chiffres RÉELS et ACTUELS, pas des approximations vagues.`,
    user: (destinations) => `Donne les informations financières pour ${destinations}.

Je veux:
- La monnaie exacte et son code
- Le taux de change actuel approximatif avec l'euro
- Budget quotidien réaliste pour 3 niveaux (backpacker/mid-range/luxe)
- Où et comment payer (CB acceptée? espèces nécessaires?)
- Guide des pourboires détaillé`
  },

  prices: {
    system: `Tu es un expert en coûts de voyage.

IMPORTANT: Tu DOIS répondre EN FRANÇAIS.

Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.

Format de réponse:
{
  "coffee": "Prix en devise locale ET en euros",
  "meal": "Prix repas simple (street food/petit resto)",
  "restaurant": "Prix restaurant milieu de gamme (plat principal)",
  "transport": "Prix ticket bus/métro simple",
  "taxi": "Prix course moyenne en ville",
  "hotel": "Prix hôtel 3 étoiles/nuit",
  "museum": "Prix entrée musée principal",
  "grocery": "Prix courses base pour 2 personnes (eau, pain, fruits)"
}

Donne des PRIX RÉELS et ACTUELS. Le voyageur doit pouvoir budgeter précisément.`,
    user: (destinations) => `Donne les prix actuels à ${destinations}.

IMPORTANT: Donne les prix dans la DEVISE LOCALE et leur équivalent en EUROS.

Je veux des prix RÉELS que je peux utiliser pour budgeter mon voyage:
- Café dans un café normal
- Repas simple (pas gastronomique)
- Restaurant milieu de gamme
- Ticket de transport en commun
- Course de taxi moyenne
- Nuit d'hôtel 3 étoiles
- Entrée de musée
- Courses de base

Pas d'approximations - je veux pouvoir planifier mon budget!`
  },

  prohibitions: {
    system: `Tu es un expert en sécurité et coutumes culturelles.

IMPORTANT: Tu DOIS répondre EN FRANÇAIS.

Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.

Format de réponse:
{
  "prohibitions": [
    "Interdit important avec explication du POURQUOI et conséquences"
  ],
  "scams": [
    "Arnaque courante avec comment la RECONNAÎTRE et l'éviter"
  ],
  "safetyTips": [
    "Conseil de sécurité spécifique et actionnable"
  ]
}

Sois PRÉCIS et UtILE. Les voyageurs doivent savoir exactement quoi éviter et pourquoi.`,
    user: (destinations) => `Liste les interdits et dangers à ${destinations}.

Je veux:
1. Les choses INTERDITES (légalement ou culturellement) avec explications
2. Les ARNAQUES courantes et comment les éviter
3. Les conseils de SÉCURITÉ spécifiques à cette destination

Sois spécifique - pas de généralités! Donne des exemples concrets d'arnaques, des numéros à appeler, des quartiers à éviter.`
  },

  mustSee: {
    system: `Tu es un guide touristique expert.

IMPORTANT: Tu DOIS répondre EN FRANÇAIS.

Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.

Format de réponse:
{
  "mustSee": [
    {
      "name": "Nom du lieu",
      "why": "Pourquoi c'est incontournable (2-3 phrases)",
      "duration": "Temps de visite recommandé",
      "bestTime": "Meilleur moment pour visiter"
    }
  ],
  "hiddenGems": [
    {
      "name": "Nom du lieu peu connu",
      "why": "Pourquoi c'est spécial",
      "howToGet": "Comment y aller"
    }
  ]
}

Donne 6-8 incontournables et 4-5 pépites cachées avec des détails UTILES.`,
    user: (destinations) => `Donne les incontournables et pépites de ${destinations}.

Pour chaque lieu, je veux savoir:
- POURQUOI c'est spécial (pas juste "c'est beau")
- Combien de temps y passer
- Le meilleur moment pour y aller (heure, jour, saison)
- Pour les pépites: comment y accéder

Donne des lieux SPÉCIFIQUES avec leurs VRAIS noms!`
  },

  transportation: {
    system: `Tu es un expert en transports et logistique voyage.

IMPORTANT: Tu DOIS répondre EN FRANÇAIS.

Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.

Format de réponse:
{
  "fromAirport": {
    "options": [
      {"type": "Type (train, bus, taxi)", "price": "Prix approximatif", "duration": "Durée", "details": "Où le prendre"}
    ]
  },
  "localTransport": {
    "types": ["Type 1 avec description"],
    "passes": "Informations sur les pass/journaux",
    "apps": "Applications utiles à télécharger"
  },
  "tips": ["Conseil pratique 1", "Conseil 2"]
}`,
    user: (destinations) => `Explique les transports pour ${destinations}.

Je veux:
1. Comment aller de l'aéroport au centre (TOUTES les options avec prix et durée)
2. Le système de transport local (métro, bus, tram, vélo...)
3. Les pass et cartes touristiques disponibles
4. Les applications à télécharger
5. Les astuces pour se déplacer efficacement

Sois PRATIQUE avec des PRIX et NOMS EXACTS des lignes/stations!`
  },

  weather: {
    system: `Tu es un expert météo et climat.

IMPORTANT: Tu DOIS répondre EN FRANÇAIS.

Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.

Format de réponse:
{
  "bestPeriod": "Meilleurs mois avec raisons",
  "seasons": {
    "spring": "Description printemps (mois, températures, particularités)",
    "summer": "Description été",
    "autumn": "Description automne",
    "winter": "Description hiver"
  },
  "whatToPack": ["Item 1 avec pourquoi", "Item 2"],
  "climateInfo": "Info climat générale et particularités"
}`,
    user: (destinations) => `Décris le climat de ${destinations}.

Je veux:
1. La MEILLEURE période pour visiter (mois exacts)
2. Description de chaque saison (températures, pluie, affluence)
3. Liste PRÉCISE de quoi emporter selon la saison
4. Particularités climatiques (mousson, canicule, typhons...)

Donne des TEMPÉRATURES en Celsius et des conseils CONCRETS!`
  },

  emergency: {
    system: `Tu es un expert en sécurité et urgences voyage.

IMPORTANT: Tu DOIS répondre EN FRANÇAIS.

Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.

Format de réponse:
{
  "numbers": {
    "police": "Numéro police",
    "ambulance": "Numéro ambulance", 
    "fire": "Numéro pompiers",
    "general": "Numéro d'urgence général"
  },
  "embassy": {
    "address": "Adresse ambassade France",
    "phone": "Téléphone",
    "hours": "Horaires d'ouverture"
  },
  "usefulApps": ["App 1: à quoi elle sert", "App 2"],
  "healthTips": ["Conseil santé 1", "Conseil 2"]
}

Donne des informations EXACTES et VÉRIFIÉES!`,
    user: (destinations) => `Donne les infos d'urgence pour ${destinations}.

Je veux:
1. Les NUMÉROS d'urgence EXACTS (pas 112 si ce n'est pas le bon!)
2. L'adresse PRÉCISE de l'ambassade de France la plus proche
3. Les applications utiles à télécharger AVANT le départ
4. Les conseils santé spécifiques (vaccins, eau, pharmacies)

Sois PRÉCIS - ces informations peuvent être vitales!`
  }
};

// GET - Get specific section info
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const destinations = searchParams.get('destinations');
    const section = searchParams.get('section');

    if (!destinations || !section) {
      return NextResponse.json({ error: 'Destinations et section requises' }, { status: 400 });
    }

    const destinationList = destinations.split(',').map(d => d.trim()).filter(Boolean);

    if (!isOpenRouterConfigured()) {
      return NextResponse.json({
        success: true,
        section: section,
        data: getFallbackSection(section, destinationList),
        usedAI: false,
        warning: 'Clé API OpenRouter non configurée.',
      });
    }

    const promptConfig = SECTION_PROMPTS[section];
    if (!promptConfig) {
      return NextResponse.json({ error: 'Section inconnue' }, { status: 400 });
    }

    const aiResponse = await callOpenRouter(promptConfig.system, promptConfig.user(destinations));
    
    let sectionData = extractJson(aiResponse);
    
    if (!sectionData) {
      return NextResponse.json({
        success: true,
        section: section,
        data: getFallbackSection(section, destinationList),
        usedAI: false,
        warning: 'Impossible de générer cette section.',
      });
    }

    return NextResponse.json({
      success: true,
      section: section,
      data: sectionData,
      usedAI: true,
    });
  } catch (error) {
    console.error('Section info error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des informations' },
      { status: 500 }
    );
  }
}

// Fallback data for each section
function getFallbackSection(section: string, destinations: string[]): any {
  const dest = destinations[0] || 'votre destination';
  
  const fallbacks: Record<string, any> = {
    vocabulary: {
      basics: [
        { phrase: 'Bonjour', translation: 'Bonjour', pronunciation: 'bon-ZHOOR' },
        { phrase: 'Merci', translation: 'Merci', pronunciation: 'mer-SEE' },
      ],
      politeExpressions: [
        { phrase: 'S\'il vous plaît', translation: 'S\'il vous plaît' },
      ],
      foodTerms: [
        { term: 'L\'addition', translation: 'L\'addition' },
      ],
      usefulPhrases: [
        { phrase: 'Parlez-vous français?', translation: 'Parlez-vous français?' },
      ],
    },
    gastronomy: {
      specialties: [
        { name: 'Spécialité locale', description: `Spécialité typique de ${dest}`, whereToTry: 'Restaurants locaux' },
      ],
      mealTimes: 'Déjeuner: 12h-14h, Dîner: 19h-21h',
      drinks: [{ name: 'Boisson locale', description: 'Boisson typique de la région' }],
      streetFood: ['Street food locale'],
      foodEtiquette: ['Respecter les coutumes locales'],
    },
    customs: {
      greetings: 'Poignée de main ou salutation verbale',
      tipping: '10% pour bon service',
      dress: 'Tenue appropriée aux lieux visités',
      behavior: 'Respecter les coutumes locales',
      culturalNuances: ['Renseignez-vous sur les traditions'],
    },
    currency: {
      name: 'Monnaie locale',
      code: 'XXX',
      exchangeRate: 'Vérifiez le taux actuel',
      paymentMethods: ['Carte bancaire', 'Espèces'],
      budget: { backpacker: '30-50€/jour', midRange: '80-120€/jour', luxury: '150€+/jour' },
      tippingGuide: '10% au restaurant',
      atmAdvice: 'Utilisez les DAB des banques',
    },
    prices: {
      coffee: '~2-4€',
      meal: '~10-15€',
      restaurant: '~20-40€',
      transport: '~2-5€',
      taxi: '~10-20€',
      hotel: '~80-150€',
      museum: '~10-20€',
      grocery: '~20-30€',
    },
    prohibitions: {
      prohibitions: ['Respectez les lois locales'],
      scams: ['Méfiez-vous des offres trop belles'],
      safetyTips: ['Gardez vos documents en sécurité'],
    },
    mustSee: {
      mustSee: [{ name: `Sites de ${dest}`, why: 'Lieux emblématiques à visiter', duration: 'Variable', bestTime: 'Matin' }],
      hiddenGems: [{ name: 'Quartiers authentiques', why: 'Pour une expérience locale', howToGet: 'À pied ou transports' }],
    },
    transportation: {
      fromAirport: { options: [{ type: 'Taxi/Bus', price: '~20-50€', duration: '~30-60min', details: 'Suivez les indications aéroport' }] },
      localTransport: { types: ['Métro, Bus, Tram'], passes: 'Pass journée disponible', apps: 'Google Maps' },
      tips: ['Privilégiez les transports en commun'],
    },
    weather: {
      bestPeriod: 'Printemps et automne',
      seasons: { spring: 'Mars-Mai', summer: 'Juin-Août', autumn: 'Sept-Nov', winter: 'Déc-Fév' },
      whatToPack: ['Vêtements confortables', 'Chaussures de marche'],
      climateInfo: 'Vérifiez la météo avant le départ',
    },
    emergency: {
      numbers: { police: '112', ambulance: '112', fire: '112', general: '112' },
      embassy: { address: 'Consultez diplomatie.gouv.fr', phone: 'Voir site officiel', hours: 'Lun-Ven' },
      usefulApps: ['Google Translate', 'Maps.me'],
      healthTips: ['Assurance voyage recommandée'],
    },
  };

  return fallbacks[section] || {};
}
