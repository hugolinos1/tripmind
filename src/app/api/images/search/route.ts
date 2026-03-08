import { NextRequest, NextResponse } from 'next/server';

// Cache for searched images (in memory for simplicity)
const imageCache = new Map<string, { url: string; source: string; photographer: string }>();

// Lorem Picsum - reliable free image service
function getPicsumImage(seed: string, width: number = 800, height: number = 400): { url: string; source: string; photographer: string } {
  return {
    url: `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`,
    source: 'Lorem Picsum',
    photographer: 'Random',
  };
}

// Search Unsplash API for images
async function searchUnsplash(query: string, width: number, height: number): Promise<{ url: string; source: string; photographer: string } | null> {
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
        // Create custom size URL
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

// Generate a beautiful SVG placeholder
function generatePlaceholder(title: string, type: string): string {
  const colors: Record<string, string[]> = {
    visit: ['f59e0b', 'd97706'],
    meal: ['f43f5e', 'e11d48'],
    transport: ['0ea5e9', '0284c7'],
    accommodation: ['10b981', '059669'],
    activity: ['a855f7', '9333ea'],
    travel: ['6366f1', '4f46e5'],
    default: ['6b7280', '4b5563'],
  };
  
  const [color1, color2] = colors[type] || colors.default;
  
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#${color2};stop-opacity:0.8" />
        </linearGradient>
        <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
          <circle cx="15" cy="15" r="2" fill="white" opacity="0.15"/>
        </pattern>
      </defs>
      <rect fill="url(#bg)" width="800" height="400"/>
      <rect fill="url(#dots)" width="800" height="400"/>
      <text x="400" y="180" text-anchor="middle" fill="white" font-size="36" font-family="sans-serif" font-weight="bold">${title.substring(0, 30)}${title.length > 30 ? '...' : ''}</text>
      <text x="400" y="230" text-anchor="middle" fill="white" font-size="16" font-family="sans-serif" opacity="0.8">✈ Travel Destination</text>
    </svg>
  `)}`;
}

// Main GET handler
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query') || searchParams.get('destination');
  const type = searchParams.get('type') || 'travel';
  const useCache = searchParams.get('cache') !== 'false';
  const width = parseInt(searchParams.get('width') || '800');
  const height = parseInt(searchParams.get('height') || '400');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
  }

  // Build cache key
  const cacheKey = `${query.toLowerCase().trim()}_${type}_${width}x${height}`;

  // Check cache first
  if (useCache && imageCache.has(cacheKey)) {
    return NextResponse.json({ 
      ...imageCache.get(cacheKey),
      cached: true,
      query,
    });
  }

  // Build search queries based on type
  const searchQueries: string[] = [];
  
  switch (type.toLowerCase()) {
    case 'food':
    case 'meal':
    case 'restaurant':
      searchQueries.push(`${query} food restaurant cuisine`);
      searchQueries.push(`${query} dining`);
      break;
    case 'hotel':
    case 'accommodation':
      searchQueries.push(`${query} hotel resort`);
      searchQueries.push(`${query} luxury accommodation`);
      break;
    case 'activity':
    case 'adventure':
      searchQueries.push(`${query} tourist attraction`);
      searchQueries.push(`${query} landmark`);
      break;
    default:
      searchQueries.push(`${query} travel landmark`);
      searchQueries.push(`${query} city skyline`);
      searchQueries.push(`${query} tourism`);
  }

  let imageResult = null;

  // Try Unsplash API
  for (const searchQuery of searchQueries) {
    imageResult = await searchUnsplash(searchQuery, width, height);
    if (imageResult) break;
  }

  // Fallback to Lorem Picsum with seed based on query
  if (!imageResult) {
    imageResult = getPicsumImage(`${query}-${type}`, width, height);
  }

  // Cache the result
  if (imageResult) {
    imageCache.set(cacheKey, imageResult);
  }

  return NextResponse.json({
    ...imageResult,
    cached: false,
    query,
    type,
  });
}

// POST handler for batch image search
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { queries, width = 800, height = 400 } = body;

    if (!Array.isArray(queries)) {
      return NextResponse.json({ error: 'queries array required' }, { status: 400 });
    }

    const results = await Promise.all(
      queries.slice(0, 10).map(async (q: { query: string; type?: string }) => {
        const cacheKey = `${q.query.toLowerCase().trim()}_${q.type || 'travel'}_${width}x${height}`;
        
        // Check cache
        if (imageCache.has(cacheKey)) {
          return { query: q.query, ...imageCache.get(cacheKey), cached: true };
        }

        // Use Lorem Picsum for fast batch processing
        const result = {
          query: q.query,
          url: `https://picsum.photos/seed/${encodeURIComponent(q.query)}/${width}/${height}`,
          source: 'Lorem Picsum',
          photographer: 'Random',
          cached: false,
        };

        imageCache.set(cacheKey, result);
        return result;
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Batch image search error:', error);
    return NextResponse.json({ error: 'Failed to search images' }, { status: 500 });
  }
}
