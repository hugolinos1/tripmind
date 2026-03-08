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
        max_tokens: 4000,
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

interface TripInfo {
  destinations: string[];
  vocabulary: {
    basics: { phrase: string; translation: string; pronunciation?: string }[];
    politeExpressions: { phrase: string; translation: string }[];
    foodTerms: { term: string; translation: string }[];
    usefulPhrases: { phrase: string; translation: string }[];
  };
  customs: {
    greetings: string;
    tipping: string;
    dress: string;
    behavior: string;
    culturalNuances: string[];
  };
  gastronomy: {
    specialties: { name: string; description: string; whereToTry?: string }[];
    mealTimes: string;
    drinks: { name: string; description: string }[];
    streetFood: string[];
    foodEtiquette: string[];
  };
  currency: {
    name: string;
    exchangeRate: string;
    paymentMethods: string[];
    budget: string;
    tippingGuide: string;
  };
  prices: {
    coffee: string;
    meal: string;
    restaurant: string;
    transport: string;
    taxi: string;
    hotel: string;
    museum: string;
    grocery: string;
  };
  prohibitions: string[];
  scams: string[];
  practicalTips: string[];
  mustSee: { name: string; why: string }[];
  hiddenGems: string[];
  emergency: {
    police: string;
    ambulance: string;
    embassy: string;
    usefulApps: string[];
  };
  weather: {
    bestPeriod: string;
    whatToPack: string[];
    climateInfo: string;
  };
  transportation: {
    fromAirport: string;
    localTransport: string;
    tips: string[];
  };
}

// GET - Get practical info for destinations
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const destinations = searchParams.get('destinations');

    if (!destinations) {
      return NextResponse.json({ error: 'Destinations requises' }, { status: 400 });
    }

    const destinationList = destinations.split(',').map(d => d.trim()).filter(Boolean);

    if (!isOpenRouterConfigured()) {
      // Return fallback data
      return NextResponse.json({
        success: true,
        info: getFallbackInfo(destinationList),
        usedAI: false,
        warning: 'Clé API OpenRouter non configurée. Informations génériques affichées.',
      });
    }

    const systemPrompt = `Tu es un expert en voyage passionné qui fournit des informations pratiques, culturelles et gastronomiques RICHES ET DÉTAILLÉES.

IMPORTANT: Tu DOIS répondre EN FRANÇAIS. Tout le contenu doit être en français.

Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.

Format de réponse attendu:
{
  "vocabulary": {
    "basics": [
      {"phrase": "Bonjour", "translation": "Hello", "pronunciation": "bon-ZHOOR"}
    ],
    "politeExpressions": [
      {"phrase": "Merci", "translation": "Thank you"}
    ],
    "foodTerms": [
      {"term": "L'eau", "translation": "Water"}
    ],
    "usefulPhrases": [
      {"phrase": "L'addition s'il vous plaît", "translation": "The bill please"}
    ]
  },
  "customs": {
    "greetings": "Description détaillée des salutations (baiser, poignée de main, inclination...)",
    "tipping": "Pourcentages exacts et quand donner un pourboire",
    "dress": "Tenues appropriées selon les lieux (temples, restaurants...)",
    "behavior": "Comportements spécifiques à adopter ou éviter",
    "culturalNuances": ["Nuance 1", "Nuance 2"]
  },
  "gastronomy": {
    "specialties": [
      {"name": "Nom du plat", "description": "Description appétissante avec ingrédients", "whereToTry": "Où le manger"}
    ],
    "mealTimes": "Horaires précis des repas et culture culinaire",
    "drinks": [
      {"name": "Nom de la boisson", "description": "Description et quand la boire"}
    ],
    "streetFood": ["Street food 1 avec description", "Street food 2"],
    "foodEtiquette": ["Règle 1", "Règle 2"]
  },
  "currency": {
    "name": "Nom de la monnaie locale",
    "exchangeRate": "1 EUR = X devise locale",
    "paymentMethods": ["Méthode 1", "Méthode 2"],
    "budget": "Budget quotidien détaillé (low/mid/high)",
    "tippingGuide": "Guide précis des pourboires"
  },
  "prices": {
    "coffee": "Prix en devise locale et EUR",
    "meal": "Prix repas simple",
    "restaurant": "Prix restaurant milieu de gamme",
    "transport": "Prix ticket bus/métro",
    "taxi": "Prix course moyenne",
    "hotel": "Prix hôtel 3 étoiles/nuit",
    "museum": "Prix entrée musée principal",
    "grocery": "Prix courses de base"
  },
  "prohibitions": ["Interdit important 1 avec explication", "Interdit 2"],
  "scams": ["Arnaque courante à éviter avec comment la reconnaître"],
  "practicalTips": ["Conseil pratique spécifique et actionnable"],
  "mustSee": [
    {"name": "Nom du lieu", "why": "Pourquoi c'est incontournable, quoi y faire"}
  ],
  "hiddenGems": ["Lieu peu connu 1 avec pourquoi y aller"],
  "emergency": {
    "police": "Numéro",
    "ambulance": "Numéro",
    "embassy": "Adresse ambassade France la plus proche",
    "usefulApps": ["App 1: à quoi elle sert", "App 2"]
  },
  "weather": {
    "bestPeriod": "Meilleurs mois avec raisons",
    "whatToPack": ["Vêtement 1", "Vêtement 2"],
    "climateInfo": "Info climat détaillée"
  },
  "transportation": {
    "fromAirport": "Options depuis l'aéroport avec prix",
    "localTransport": "Description du réseau local",
    "tips": ["Conseil transport 1", "Conseil 2"]
  }
}

SOIS SPÉCIFIQUE ET PRÉCIS. Donne des noms de plats réels, des prix exacts, des expressions locales authentiques. Évite les généralités. L'objectif est que le voyageur se sente préparé et informé.`;

    const userPrompt = `Je prépare un voyage à: ${destinationList.join(', ')}

Fournis un guide COMPLET et DÉTAILLÉ EN FRANÇAIS avec:

📘 VOCABULAIRE LOCAL:
- 8-10 expressions de base avec prononciation phonétique
- 5-6 expressions polies essentielles
- 10 termes culinaires indispensables
- 5-6 phrases utiles au restaurant/dans les magasins

👘 COUTUMES ET CULTURE:
- Comment se saluer (nombre de bises, poignée de main, inclination...)
- Pourboires: pourcentages exacts selon les situations
- Code vestimentaire (temples, restaurants chic, plage...)
- Nuances culturelles importantes à connaître

🍽️ GASTRONOMIE LOCALE:
- 5-6 spécialités culinaires avec description des ingrédients et où les goûter
- Boissons typiques (avec ou sans alcool)
- Street food incontournable
- Étiquette à table (baguettes, mains, etc.)

💰 ARGENT ET PRIX:
- Monnaie locale et taux de change actuel
- Budget quotidien selon 3 niveaux (backpacker/mid-range/luxe)
- Prix précis en devise locale ET en euros de: café, repas simple, restaurant, ticket transport, taxi, hôtel 3*, entrée musée, courses de base

🚫 À ÉVITER:
- Interdits culturels/religieux
- Arnaques courantes et comment les éviter

✨ INCONTOURNABLES:
- 5-6 lieux must-see avec POURQUOI ils le sont
- 3-4 pépites cachées hors des sentiers battus

🚍 TRANSPORT:
- Comment venir de l'aéroport au centre (options + prix)
- Réseau de transport local (types de pass, applications)

📱 URGENCE ET PRATIQUE:
- Numéros d'urgence
- Ambassade de France la plus proche
- Applications utiles à télécharger

Sois PRÉCIS, CONCRET et ACTIONNABLE. Le voyageur doit se sentir vraiment préparé!`;

    const aiResponse = await callOpenRouter(systemPrompt, userPrompt);
    
    let tripInfo: TripInfo | null = null;
    
    if (aiResponse) {
      try {
        // Try to extract JSON from markdown code blocks first
        let jsonStr = aiResponse;
        const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1].trim();
        } else {
          // Find the outermost JSON object by matching balanced braces
          let startIndex = aiResponse.indexOf('{');
          if (startIndex !== -1) {
            let braceCount = 0;
            let endIndex = aiResponse.length; // Default to end of string
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
            
            // If JSON is incomplete (braceCount > 0), try to fix it
            if (braceCount > 0) {
              console.log('Incomplete JSON detected, attempting to repair...');
              // Close any unclosed strings
              if (inString) {
                jsonStr += '"';
              }
              // Add missing closing braces
              while (braceCount > 0) {
                jsonStr += '}';
                braceCount--;
              }
            }
          }
        }
        
        tripInfo = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Failed to parse trip info:', parseError);
        console.error('AI Response preview:', aiResponse?.substring(0, 500));
      }
    }

    if (!tripInfo) {
      return NextResponse.json({
        success: true,
        info: getFallbackInfo(destinationList),
        usedAI: false,
        warning: 'Impossible de générer les informations détaillées. Informations génériques affichées.',
      });
    }

    return NextResponse.json({
      success: true,
      info: { destinations: destinationList, ...tripInfo },
      usedAI: true,
    });
  } catch (error) {
    console.error('Trip info error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des informations' },
      { status: 500 }
    );
  }
}

function getFallbackInfo(destinations: string[]): TripInfo & { destinations: string[] } {
  const destName = destinations[0] || 'votre destination';
  return {
    destinations,
    vocabulary: {
      basics: [
        { phrase: 'Bonjour', translation: 'Hello', pronunciation: 'bon-ZHOOR' },
        { phrase: 'Merci', translation: 'Thank you', pronunciation: 'mer-SEE' },
        { phrase: 'Au revoir', translation: 'Goodbye', pronunciation: 'oh ruh-VWAHR' },
        { phrase: "S'il vous plaît", translation: 'Please', pronunciation: 'seel voo PLEH' },
        { phrase: 'Oui / Non', translation: 'Yes / No', pronunciation: 'wee / nohn' },
      ],
      politeExpressions: [
        { phrase: 'Excusez-moi', translation: 'Excuse me' },
        { phrase: 'Pardon', translation: 'Sorry' },
        { phrase: 'Je ne comprends pas', translation: "I don't understand" },
      ],
      foodTerms: [
        { term: "L'addition", translation: 'The bill' },
        { term: "L'eau", translation: 'Water' },
        { term: 'Le menu', translation: 'The menu' },
      ],
      usefulPhrases: [
        { phrase: 'Parlez-vous anglais?', translation: 'Do you speak English?' },
        { phrase: "Combien ça coûte?", translation: 'How much does it cost?' },
      ],
    },
    customs: {
      greetings: 'Une poignée de main ferme ou un "Bonjour" avec un sourire sont appropriés dans la plupart des situations.',
      tipping: 'Le service est généralement inclus. Pourboire de 5-10% apprécié pour bon service, plus en restauration.',
      dress: 'Tenue décente recommandée. Éviter les tenues trop décontractées dans les lieux de culte ou restaurants chic.',
      behavior: 'Respecter les coutumes locales, être ponctuel aux rendez-vous, et demander avant de photographier.',
      culturalNuances: [
        "Gardez une attitude polie et respectueuse en toutes circonstances",
        "Renseignez-vous sur les traditions locales avant votre visite",
      ],
    },
    gastronomy: {
      specialties: [
        { name: 'Spécialité locale', description: `Découvrez les saveurs authentiques de ${destName}`, whereToTry: 'Restaurants locaux recommandés' },
        { name: 'Plat traditionnel', description: 'Une recette transmise de génération en génération', whereToTry: 'Marchés et eateries locales' },
      ],
      mealTimes: 'Petit-déjeuner 7h-9h, Déjeuner 12h-14h, Dîner 19h-21h',
      drinks: [
        { name: 'Boisson locale', description: 'À déguster pour découvrir la culture locale' },
        { name: 'Café/Thé', description: 'Moment de détente typique' },
      ],
      streetFood: ['Snacks locaux à découvrir dans les marchés', 'Spécialités de rue authentiques'],
      foodEtiquette: [
        'Attendre que tout le monde soit servi pour commencer',
        'Remercier le personnel après le repas',
      ],
    },
    currency: {
      name: 'Monnaie locale (vérifier avant le départ)',
      exchangeRate: 'Consulter le taux actuel sur xe.com',
      paymentMethods: ['Carte bancaire internationale', 'Espèces pour les petits montants', 'Paiement mobile si disponible'],
      budget: 'Budget backpacker: 30-50€/jour | Mid-range: 80-120€/jour | Confort: 150€+/jour',
      tippingGuide: 'Restaurant: 10% si service non inclus. Taxi: arrondir au supérieur. Hôtel: 1-2€ par bagage.',
    },
    prices: {
      coffee: '2-4€ (ou équivalent local)',
      meal: '8-15€ repas simple',
      restaurant: '20-40€ restaurant milieu de gamme',
      transport: '1-3€ ticket simple',
      taxi: '10-20€ course moyenne en ville',
      hotel: '60-120€ hôtel 3 étoiles/nuit',
      museum: '8-15€ entrée standard',
      grocery: '15-25€ courses de base pour 2 personnes',
    },
    prohibitions: [
      'Respecter les lieux de culte (tenue appropriée, silence)',
      'Éviter les photos non autorisées, surtout des personnes',
      'Ne pas critiquer ouvertement les coutumes locales',
      'Se renseigner sur les tabous culturels spécifiques',
    ],
    scams: [
      'Méfiez-vous des "guides" non officiels proposant leurs services',
      'Vérifiez toujours les prix avant d\'acheter ou de commander',
      'Gardez vos objets de valeur en sécurité dans les zones touristiques',
    ],
    practicalTips: [
      'Faites des copies de vos documents importants',
      'Souscrivez une assurance voyage complète',
      'Téléchargez les cartes Google Maps hors-ligne',
      'Apprenez quelques mots de la langue locale',
      'Informez votre banque de votre voyage à l\'étranger',
    ],
    mustSee: destinations.map(d => ({
      name: `Sites emblématiques de ${d}`,
      why: 'Lieux incontournables à visiter absolument pour découvrir l\'essence de la destination',
    })),
    hiddenGems: [
      'Explorez les quartiers moins touristiques pour une expérience authentique',
      'Demandez aux locaux leurs adresses préférées',
    ],
    emergency: {
      police: '112 (Europe) ou numéro local d\'urgence',
      ambulance: '112 (Europe) ou numéro local d\'urgence',
      embassy: 'Consultez diplomatie.gouv.fr pour l\'ambassade France la plus proche',
      usefulApps: [
        'Google Translate: traduction instantanée',
        'Maps.me: cartes hors-ligne',
        'XE Currency: convertisseur de devises',
      ],
    },
    weather: {
      bestPeriod: 'Printemps (avril-mai) et automne (sept-oct) offrent généralement le meilleur climat',
      whatToPack: ['Vêtements en layers', 'Chaussures confortables', 'Adaptateur électrique', 'Protection solaire', 'Imperméable léger'],
      climateInfo: 'Vérifiez les conditions météo spécifiques à votre période de voyage',
    },
    transportation: {
      fromAirport: 'Navette aéroport (~15-25€), Taxi (~40-60€), ou transports en commun disponibles selon la destination',
      localTransport: 'Métro, bus, tram selon la ville. Pass journée souvent rentable pour plusieurs trajets.',
      tips: [
        'Privilégiez les transports en commun en heures creuses',
        'Téléchargez l\'app de transport local si disponible',
      ],
    },
  };
}
