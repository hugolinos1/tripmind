import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

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

// Geocode a location using Nominatim (OpenStreetMap)
async function geocodeLocation(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: {
          'User-Agent': 'Tripmind/1.0',
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('Geocoding failed: HTTP', response.status);
      return null;
    }
    
    const text = await response.text();
    
    if (text.trim().startsWith('<')) {
      console.error('Geocoding returned XML instead of JSON');
      return null;
    }
    
    const data = JSON.parse(text);
    if (data && data[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
}

// Check if OpenRouter is configured
function isOpenRouterConfigured(): boolean {
  const apiKey = process.env.OPENROUTER_API_KEY;
  return !!apiKey && apiKey !== 'your-openrouter-api-key-here' && apiKey.length > 10;
}

// Call OpenRouter API for AI recommendations
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

interface TripPreferences {
  pace: number;
  budget: number;
  interests: string[];
  accessibility: boolean;
  dietary: string[];
  alreadyVisited: string[];
  mustSee: string[];
}

interface Travelers {
  adults: number;
  children: number[];
  hasPets: boolean;
}

// POST - Generate AI recommendations for a trip
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const data = await request.json();
    const { tripId } = data;

    if (!tripId) {
      return NextResponse.json({ error: 'ID voyage requis' }, { status: 400 });
    }

    // Get trip details
    const trip = await db.trip.findFirst({
      where: { id: tripId, userId: user.id, deletedAt: null },
      include: {
        days: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Voyage non trouvé' }, { status: 404 });
    }

    const destinations = JSON.parse(trip.destinations);
    const travelers: Travelers = JSON.parse(trip.travelers);
    const preferences: TripPreferences = JSON.parse(trip.preferences);
    const dayCount = trip.days.length;

    const destinationQuery = Array.isArray(destinations)
      ? destinations.join(', ')
      : destinations;

    // Check if OpenRouter is configured
    const isAIConfigured = isOpenRouterConfigured();
    let recommendations = null;
    let usedAI = false;

    if (isAIConfigured) {
      // Calculate pace description
      const paceDesc = preferences.pace < 33 ? 'reposé' : preferences.pace > 66 ? 'intense' : 'modéré';
      const budgetDesc = preferences.budget < 33 ? 'économique' : preferences.budget > 66 ? 'luxe' : 'confort';

      // Build AI prompt
      const systemPrompt = `Tu es un expert en planification de voyages. Tu crées des itinéraires personnalisés.
Réponds UNIQUEMENT avec un JSON valide, sans texte avant ou après.
Le JSON doit avoir cette structure:
{
  "recommendations": [
    {
      "dayIndex": 0,
      "events": [
        {
          "type": "visit|meal|activity|transport",
          "title": "Nom de l'activité",
          "description": "Description courte",
          "suggestedTime": "HH:MM",
          "durationMinutes": 120,
          "locationName": "Nom du lieu",
          "locationAddress": "Adresse",
          "estimatedBudget": 25,
          "lat": 48.8584,
          "lng": 2.2945,
          "tips": "Conseils pratiques"
        }
      ]
    }
  ]
}

Règles:
- Répartis les activités sur ${dayCount} jour(s)
- 2-4 activités par jour maximum
- Rythme ${paceDesc}
- Budget ${budgetDesc}
- Intérêts: ${preferences.interests.join(', ') || 'découverte'}
- Must-see: ${preferences.mustSee?.join(', ') || 'aucun'}
- Si tu connais les coordonnées GPS, inclus lat et lng`;

      const userPrompt = `Crée un itinéraire pour ${dayCount} jour(s) à: ${destinationQuery}
Dates: ${new Date(trip.startDate).toLocaleDateString('fr-FR')} au ${new Date(trip.endDate).toLocaleDateString('fr-FR')}
Voyageurs: ${travelers.adults} adulte(s)${travelers.children.length > 0 ? `, ${travelers.children.length} enfant(s)` : ''}`;

      const aiResponse = await callOpenRouter(systemPrompt, userPrompt);
      
      if (aiResponse) {
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            recommendations = JSON.parse(jsonMatch[0]);
            usedAI = true;
          }
        } catch (parseError) {
          console.error('Failed to parse AI recommendations:', parseError);
        }
      }
    }

    // Fallback recommendations if AI is not available
    if (!recommendations) {
      recommendations = {
        recommendations: trip.days.map((day, index) => ({
          dayIndex: index,
          events: [
            {
              type: 'visit',
              title: `Découverte de ${destinationQuery}`,
              description: `Explorez les merveilles de ${destinationQuery}`,
              suggestedTime: '10:00',
              durationMinutes: 180,
              locationName: destinationQuery,
              locationAddress: '',
              estimatedBudget: 30,
              lat: null,
              lng: null,
              tips: 'Pensez à réserver à l\'avance',
            },
            {
              type: 'meal',
              title: `Déjeuner à ${destinationQuery}`,
              description: 'Profitez d\'un repas local',
              suggestedTime: '12:30',
              durationMinutes: 60,
              locationName: `Restaurant ${destinationQuery}`,
              locationAddress: '',
              estimatedBudget: 25,
              lat: null,
              lng: null,
              tips: 'Essayez les spécialités locales',
            },
            {
              type: 'visit',
              title: `Après-midi à ${destinationQuery}`,
              description: 'Continuez votre exploration',
              suggestedTime: '14:30',
              durationMinutes: 180,
              locationName: destinationQuery,
              locationAddress: '',
              estimatedBudget: 20,
              lat: null,
              lng: null,
              tips: 'Profitez du coucher de soleil',
            },
          ],
        })),
      };
    }

    // Save recommendations to database as events
    for (const dayRec of recommendations.recommendations || []) {
      const dayIndex = dayRec.dayIndex;
      if (dayIndex >= 0 && dayIndex < trip.days.length) {
        const day = trip.days[dayIndex];

        for (let i = 0; i < (dayRec.events?.length || 0); i++) {
          const evt = dayRec.events[i];
          
          // Get coordinates via geocoding if not provided
          let lat = evt.lat;
          let lng = evt.lng;
          
          if (typeof lat !== 'number' || typeof lng !== 'number') {
            const geocodeQuery = evt.locationName 
              ? `${evt.locationName}, ${destinationQuery}`
              : `${evt.title}, ${destinationQuery}`;
            const coords = await geocodeLocation(geocodeQuery);
            if (coords) {
              lat = coords.lat;
              lng = coords.lng;
            }
          }
          
          await db.event.create({
            data: {
              id: randomUUID(),
              dayId: day.id,
              type: evt.type || 'visit',
              title: evt.title || 'Activité',
              description: evt.description || null,
              startTime: evt.suggestedTime || null,
              durationMinutes: evt.durationMinutes || null,
              locationName: evt.locationName || null,
              locationAddress: evt.locationAddress || null,
              lat: typeof lat === 'number' ? lat : null,
              lng: typeof lng === 'number' ? lng : null,
              estimatedBudget: evt.estimatedBudget || null,
              orderIndex: i,
              photos: '[]',
              practicalInfo: JSON.stringify({ tips: evt.tips || '' }),
              isAiEnriched: false,
            },
          });
        }
      }
    }

    // Fetch updated trip with events
    const updatedTrip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        days: {
          include: {
            events: {
              orderBy: { orderIndex: 'asc' },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    // Build warning message
    let warning: string | undefined;
    if (!isAIConfigured) {
      warning = 'Clé API OpenRouter non configurée. Ajoutez votre clé dans le fichier .env';
    } else if (!usedAI) {
      warning = 'La génération AI a échoué. Itinéraire par défaut utilisé.';
    }

    return NextResponse.json({
      success: true,
      trip: updatedTrip,
      recommendations,
      usedAI,
      warning,
    });
  } catch (error) {
    console.error('AI recommend error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération des recommandations' },
      { status: 500 }
    );
  }
}
