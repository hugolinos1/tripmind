import { NextRequest, NextResponse } from 'next/server';

// OpenRouter configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface TransportRequest {
  origin: {
    name: string;
    lat: number | null;
    lng: number | null;
  };
  destination: {
    name: string;
    lat: number | null;
    lng: number | null;
  };
  city: string;
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
        max_tokens: 1000,
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

// POST - Get detailed transport information
export async function POST(request: NextRequest) {
  try {
    const data: TransportRequest = await request.json();
    const { origin, destination, city } = data;

    if (!origin.name || !destination.name) {
      return NextResponse.json({ error: 'Origine et destination requises' }, { status: 400 });
    }

    // Calculate approximate distance if coordinates available
    let distanceInfo = '';
    if (origin.lat && origin.lng && destination.lat && destination.lng) {
      const R = 6371; // Earth's radius in km
      const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
      const dLng = ((destination.lng - origin.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((origin.lat * Math.PI) / 180) *
          Math.cos((destination.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      distanceInfo = `Distance approximative: ${distance.toFixed(2)} km`;
    }

    const systemPrompt = `Tu es un expert en transport urbain. Tu fournis des informations précises sur les moyens de transport entre deux lieux.
Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.
Format de réponse:
{
  "recommendedMode": "metro|bus|tram|velib|walking|taxi|rer",
  "summary": "Résumé en une phrase",
  "routes": [
    {
      "type": "metro|bus|tram|rer|walking",
      "line": "Numéro ou nom de la ligne",
      "lineColor": "#couleur",
      "direction": "Direction terminus",
      "fromStop": "Nom de l'arrêt de départ",
      "toStop": "Nom de l'arrêt d'arrivée",
      "stopsCount": 5,
      "duration": "X min",
      "walkingToStation": "X min à pied",
      "walkingFromStation": "X min à pied"
    }
  ],
  "totalDuration": "Durée totale estimée",
  "totalCost": "Prix estimé",
  "tips": ["Conseil 1", "Conseil 2"],
  "alternatives": [
    {
      "mode": "Mode alternatif",
      "duration": "Durée",
      "cost": "Prix"
    }
  ]
}

Si tu n'as pas d'information précise, fournis des estimations réalistes basées sur la distance.`;

    const userPrompt = `Donne-moi les informations de transport pour aller de "${origin.name}" à "${destination.name}" à ${city}.

${distanceInfo}

Utilise tes connaissances pour fournir des estimations réalistes.`;

    let transportData = null;
    
    if (isOpenRouterConfigured()) {
      const aiResponse = await callOpenRouter(systemPrompt, userPrompt);
      
      if (aiResponse) {
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            transportData = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          console.error('Failed to parse transport response:', parseError);
        }
      }
    }

    // Fallback transport data if AI is not available or failed
    if (!transportData) {
      // Estimate duration based on distance
      let estimatedDuration = '15 min';
      let walkingDuration = '10 min';
      
      if (origin.lat && origin.lng && destination.lat && destination.lng) {
        const R = 6371;
        const dLat = ((destination.lat - origin.lat) * Math.PI) / 180;
        const dLng = ((destination.lng - origin.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((origin.lat * Math.PI) / 180) *
            Math.cos((destination.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = R * c;
        
        if (distanceKm < 1) {
          estimatedDuration = '5-10 min';
          walkingDuration = `${Math.round(distanceKm * 12)} min`;
        } else if (distanceKm < 3) {
          estimatedDuration = '10-15 min';
          walkingDuration = `${Math.round(distanceKm * 12)} min`;
        } else if (distanceKm < 10) {
          estimatedDuration = '15-30 min';
          walkingDuration = `${Math.round(distanceKm * 12)} min`;
        } else {
          estimatedDuration = '30-45 min';
          walkingDuration = 'Trop loin à pied';
        }
      }
      
      transportData = {
        recommendedMode: 'walking',
        summary: `Trajet de ${origin.name} à ${destination.name}`,
        routes: [
          {
            type: 'walking',
            line: '',
            lineColor: '#22c55e',
            direction: '',
            fromStop: origin.name,
            toStop: destination.name,
            stopsCount: 0,
            duration: walkingDuration,
            walkingToStation: '',
            walkingFromStation: '',
          },
        ],
        totalDuration: estimatedDuration,
        totalCost: 'Gratuit',
        tips: ['Vérifiez les horaires des transports en commun', 'Utilisez une application de navigation'],
        alternatives: [
          { mode: 'Taxi', duration: estimatedDuration, cost: 'Variable' },
          { mode: 'Vélo', duration: walkingDuration, cost: 'Location' },
        ],
      };
    }

    return NextResponse.json({
      success: true,
      transport: transportData,
    });
  } catch (error) {
    console.error('Transport AI error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des informations de transport' },
      { status: 500 }
    );
  }
}
