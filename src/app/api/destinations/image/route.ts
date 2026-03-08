import { NextRequest, NextResponse } from 'next/server';

// Cache for destination images (in memory for simplicity)
const imageCache = new Map<string, { url: string; source: string; photographer: string }>();

// Lorem Picsum - reliable free image service
function getPicsumImage(seed: string, width: number = 1344, height: number = 768): { url: string; source: string; photographer: string } {
  return {
    url: `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`,
    source: 'Lorem Picsum',
    photographer: 'Random',
  };
}

// Search Unsplash API for destination images
async function searchUnsplashImage(query: string, width: number, height: number): Promise<{ url: string; source: string; photographer: string } | null> {
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
      {
        headers: {
          'Accept-Version': 'v1',
          'Authorization': 'Client-ID 6jD8PKhN5pLPZpPxXhLQPgDZZL86f7IlR31CqLQw',
        },
      }
    );

    if (!response.ok) {
      console.log('Unsplash API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const randomIndex = Math.floor(Math.random() * Math.min(data.results.length, 5));
      const image = data.results[randomIndex];
      
      // Get the right size
      let imageUrl = image.urls.regular;
      if (image.urls.raw) {
        imageUrl = `${image.urls.raw}&w=${width}&h=${height}&fit=crop`;
      }
      
      return {
        url: imageUrl,
        source: 'Unsplash',
        photographer: image.user?.name || 'Unsplash Community',
      };
    }

    return null;
  } catch (error) {
    console.error('Unsplash search error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const destination = searchParams.get('destination');
  const width = parseInt(searchParams.get('width') || '1344');
  const height = parseInt(searchParams.get('height') || '768');

  if (!destination) {
    return NextResponse.json({ error: 'Destination required' }, { status: 400 });
  }

  // Check cache first
  const cacheKey = `${destination.toLowerCase().trim()}_${width}x${height}`;
  if (imageCache.has(cacheKey)) {
    const cached = imageCache.get(cacheKey)!;
    return NextResponse.json({ 
      imageUrl: cached.url, 
      source: cached.source,
      photographer: cached.photographer,
      cached: true 
    });
  }

  try {
    // Build search queries
    const searchQueries = [
      `${destination} city skyline landmark`,
      `${destination} travel destination tourism`,
      `${destination} famous landmark`,
    ];

    let imageResult = null;

    // Try Unsplash API
    for (const query of searchQueries) {
      imageResult = await searchUnsplashImage(query, width, height);
      if (imageResult) break;
    }

    // Fallback to Lorem Picsum with seed based on destination
    if (!imageResult) {
      imageResult = getPicsumImage(destination, width, height);
    }

    // Cache the result
    imageCache.set(cacheKey, imageResult);

    return NextResponse.json({ 
      imageUrl: imageResult.url,
      source: imageResult.source,
      photographer: imageResult.photographer,
      cached: false 
    });

  } catch (error) {
    console.error('Error getting destination image:', error);
    
    // Return Lorem Picsum as fallback
    const fallbackUrl = `https://picsum.photos/seed/${encodeURIComponent(destination)}/${width}/${height}`;
    
    return NextResponse.json({ 
      imageUrl: fallbackUrl,
      source: 'Lorem Picsum',
      photographer: 'Random',
      cached: false,
      fallback: true,
    });
  }
}
