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
      console.error('Geocoding returned XML instead of JSON, API might be rate limited');
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

// Search for a public image using Lorem Picsum (reliable)
async function searchPublicImage(
  eventTitle: string,
  destination: string,
  eventType: string
): Promise<string> {
  try {
    const typeDescriptions: Record<string, string> = {
      visit: 'landmark',
      meal: 'food',
      transport: 'travel',
      accommodation: 'hotel',
      activity: 'nature',
    };

    const typeDesc = typeDescriptions[eventType] || typeDescriptions.visit;
    const seed = `${eventTitle}-${destination}-${typeDesc}`.toLowerCase().replace(/\s+/g, '-');
    
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/400`;
  } catch {
    const randomSeed = Math.floor(Math.random() * 10000);
    return `https://picsum.photos/seed/${randomSeed}/800/400`;
  }
}

// Check if OpenRouter is configured
function isOpenRouterConfigured(): boolean {
  const apiKey = process.env.OPENROUTER_API_KEY;
  return !!apiKey && apiKey !== 'your-openrouter-api-key-here' && apiKey.length > 10;
}

// Call OpenRouter API for AI enrichment
async function callOpenRouter(prompt: string, systemPrompt: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey || apiKey === 'your-openrouter-api-key-here') {
    console.log('OpenRouter API key not configured');
    return null;
  }

  try {
    console.log('Calling OpenRouter API...');
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
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || null;
    console.log('OpenRouter response length:', content?.length || 0);
    return content;
  } catch (error) {
    console.error('OpenRouter call failed:', error);
    return null;
  }
}

// POST - Enrich an event with AI
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const data = await request.json();
    const { eventId } = data;

    if (!eventId) {
      return NextResponse.json({ error: 'ID événement requis' }, { status: 400 });
    }

    // Get event and verify ownership
    const event = await db.event.findUnique({
      where: { id: eventId },
      include: {
        day: {
          include: {
            trip: true,
          },
        },
      },
    });

    if (!event || event.day.trip.userId !== user.id) {
      return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
    }

    const trip = event.day.trip;
    let destinations: string[] = [];
    try {
      const parsed = JSON.parse(trip.destinations);
      destinations = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      destinations = ['Destination'];
    }
    const destinationQuery = destinations.join(', ');

    // Check if OpenRouter is configured
    const isAIConfigured = isOpenRouterConfigured();
    let enrichmentData;
    let usedAI = false;

    if (isAIConfigured) {
      // Build AI prompt for enrichment
      const systemPrompt = `Tu es un guide de voyage expert. Tu fournis des informations détaillées et pratiques sur des lieux touristiques.

IMPORTANT: Tu DOIS répondre EN FRANÇAIS. Tout le contenu doit être en français.

Réponds UNIQUEMENT avec un JSON valide. Pas de texte avant ou après le JSON.
Format de réponse:
{
  "description": "Description en 2 phrases",
  "openingHours": "Horaires",
  "priceRange": "€-€€€€",
  "averagePrice": 20,
  "address": "Adresse complète",
  "lat": 48.8584,
  "lng": 2.2945,
  "tips": ["Conseil 1"],
  "bestTimeToVisit": "Matin",
  "recommendedDuration": "2h"
}

IMPORTANT: Si tu connais les coordonnées GPS approximatives, inclus les valeurs lat et lng (nombres décimaux). Sinon, laisse null.`;

      const userPrompt = `Fournis des informations EN FRANÇAIS pour: "${event.title}"
Lieu: ${event.locationName || 'Non spécifié'}
Destination: ${destinationQuery}`;

      const aiResponse = await callOpenRouter(userPrompt, systemPrompt);
      
      if (aiResponse) {
        try {
          // Try to extract JSON from the response
          let jsonStr = aiResponse;
          
          // If response contains markdown code blocks, extract the content
          const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
          } else {
            // Find the outermost JSON object by matching balanced braces
            let startIndex = aiResponse.indexOf('{');
            if (startIndex !== -1) {
              let braceCount = 0;
              let endIndex = startIndex;
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
            }
          }
          
          enrichmentData = JSON.parse(jsonStr);
          usedAI = true;
          console.log('Successfully parsed AI response for event:', event.title);
        } catch (parseError) {
          console.error('Failed to parse AI response:', parseError, 'Response was:', aiResponse.substring(0, 200));
        }
      }
    }

    // Fallback data if AI is not available or failed
    if (!enrichmentData) {
      enrichmentData = {
        description: `Découvrez ${event.title}, un incontournable de ${destinationQuery}.`,
        openingHours: 'Variable selon la saison',
        priceRange: '€€',
        averagePrice: 20,
        address: event.locationAddress || '',
        lat: null,
        lng: null,
        tips: ['Réservez à l\'avance', 'Arrivez tôt pour éviter la foule'],
        bestTimeToVisit: 'Matin',
        recommendedDuration: '2h',
      };
    }

    // Get coordinates via geocoding if AI didn't provide them
    let lat = enrichmentData.lat;
    let lng = enrichmentData.lng;
    
    // Validate coordinates - must be numbers and within valid ranges
    const isValidCoord = (lat: any, lng: any): lat is number => {
      if (typeof lat !== 'number' || typeof lng !== 'number') return false;
      if (isNaN(lat) || isNaN(lng)) return false;
      if (lat === 0 && lng === 0) return false; // Null Island
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
      return true;
    };
    
    if (!isValidCoord(lat, lng)) {
      const geocodeQuery = event.locationName 
        ? `${event.locationName}, ${destinationQuery}`
        : `${event.title}, ${destinationQuery}`;
      
      const coords = await geocodeLocation(geocodeQuery);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
    }
    
    // Final validation - if still invalid, keep existing coordinates
    if (!isValidCoord(lat, lng)) {
      console.warn('Invalid coordinates for event:', event.title, 'Keeping existing coords');
      lat = event.lat;
      lng = event.lng;
    }

    // Check if we already have photos
    let photos: string[] = [];
    try {
      photos = JSON.parse(event.photos || '[]');
    } catch {
      photos = [];
    }

    // Search for a public image if we don't have one
    if (photos.length === 0 || !photos[0].startsWith('http')) {
      const publicImage = await searchPublicImage(
        event.title,
        destinationQuery,
        event.type
      );
      photos = [publicImage];
    }

    // Update event with enrichment
    const practicalInfo = {
      openingHours: enrichmentData.openingHours,
      priceRange: enrichmentData.priceRange,
      tips: enrichmentData.tips,
      bestTimeToVisit: enrichmentData.bestTimeToVisit,
      recommendedDuration: enrichmentData.recommendedDuration,
    };

    const updatedEvent = await db.event.update({
      where: { id: eventId },
      data: {
        description: enrichmentData.description || event.description,
        locationAddress: enrichmentData.address || event.locationAddress,
        lat: isValidCoord(lat, lng) ? lat : event.lat,
        lng: isValidCoord(lat, lng) ? lng : event.lng,
        estimatedBudget: enrichmentData.averagePrice || event.estimatedBudget,
        practicalInfo: JSON.stringify(practicalInfo),
        photos: JSON.stringify(photos),
        isAiEnriched: true,
      },
    });

    // Log enrichment
    try {
      await db.enrichment.create({
        data: {
          id: randomUUID(),
          eventId: eventId,
          rawResponse: JSON.stringify(enrichmentData),
          tokensUsed: null,
        },
      });
    } catch {
      // Ignore
    }

    // Build warning message
    let warning: string | undefined;
    if (!isAIConfigured) {
      warning = 'Clé API OpenRouter non configurée. Ajoutez votre clé dans le fichier .env';
    } else if (!usedAI) {
      warning = 'L\'enrichissement AI n\'a pas pu être effectué. Données par défaut utilisées.';
    }

    return NextResponse.json({
      success: true,
      event: updatedEvent,
      usedAI: usedAI,
      warning,
    });
  } catch (error) {
    console.error('AI enrich error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'enrichissement' },
      { status: 500 }
    );
  }
}
