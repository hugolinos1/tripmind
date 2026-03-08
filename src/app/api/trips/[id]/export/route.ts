import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

// GET - Export trip as printable HTML
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    const { id } = await params;

    const trip = await db.trip.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user ? { userId: user.id } : {}),
      },
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

    if (!trip) {
      return NextResponse.json({ error: 'Voyage non trouvé' }, { status: 404 });
    }

    // Check access
    if (!user && !trip.shareToken) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const destinations = JSON.parse(trip.destinations);
    const destinationStr = Array.isArray(destinations) ? destinations.join(', ') : destinations;

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    };

    // Generate printable HTML
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${trip.title} - Carnet de Voyage</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #fff;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 2px solid #f59e0b;
    }
    
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #f59e0b;
      margin-bottom: 10px;
    }
    
    h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 10px;
      color: #111827;
    }
    
    .meta {
      color: #6b7280;
      font-size: 14px;
    }
    
    .destination {
      display: inline-block;
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 14px;
      margin-top: 10px;
    }
    
    .day {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }
    
    .day-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .day-number {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 18px;
    }
    
    .day-title {
      flex: 1;
    }
    
    .day-title h2 {
      font-size: 20px;
      font-weight: 600;
    }
    
    .day-title p {
      color: #6b7280;
      font-size: 14px;
      text-transform: capitalize;
    }
    
    .event {
      margin-left: 25px;
      padding-left: 20px;
      border-left: 2px solid #e5e7eb;
      margin-bottom: 20px;
    }
    
    .event-time {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 5px;
    }
    
    .event-title {
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 5px;
    }
    
    .event-type {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      text-transform: uppercase;
      margin-left: 8px;
    }
    
    .type-visit { background: #fef3c7; color: #92400e; }
    .type-meal { background: #fce7f3; color: #9d174d; }
    .type-transport { background: #dbeafe; color: #1e40af; }
    .type-accommodation { background: #d1fae5; color: #065f46; }
    .type-activity { background: #ede9fe; color: #5b21b6; }
    
    .event-description {
      color: #4b5563;
      font-size: 14px;
      margin-bottom: 8px;
    }
    
    .event-location {
      color: #6b7280;
      font-size: 13px;
    }
    
    .event-budget {
      color: #059669;
      font-size: 13px;
      margin-top: 5px;
    }
    
    .practical-info {
      background: #f9fafb;
      padding: 10px;
      border-radius: 6px;
      margin-top: 10px;
      font-size: 13px;
    }
    
    .footer {
      text-align: center;
      padding-top: 30px;
      border-top: 1px solid #e5e7eb;
      margin-top: 40px;
      color: #9ca3af;
      font-size: 12px;
    }
    
    @media print {
      body {
        padding: 20px;
      }
      
      .day {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🧠 Tripmind</div>
    <h1>${trip.title}</h1>
    <div class="meta">
      ${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}
    </div>
    <div class="destination">📍 ${destinationStr}</div>
  </div>
  
  ${trip.days.map((day, index) => `
    <div class="day">
      <div class="day-header">
        <div class="day-number">${index + 1}</div>
        <div class="day-title">
          <h2>Jour ${index + 1}</h2>
          <p>${formatDate(day.date)}</p>
        </div>
      </div>
      
      ${day.events.length === 0 ? '<p style="color: #9ca3af; margin-left: 25px;">Aucune activité planifiée</p>' : ''}
      
      ${day.events.map(event => {
        let practicalInfo: { tips?: string[]; openingHours?: string } = {};
        try {
          practicalInfo = JSON.parse(event.practicalInfo);
        } catch { /* ignore */ }
        
        const typeLabels: Record<string, string> = {
          visit: 'Visite',
          meal: 'Repas',
          transport: 'Transport',
          accommodation: 'Logement',
          activity: 'Activité',
        };
        
        return `
          <div class="event">
            ${event.startTime ? `<div class="event-time">🕐 ${event.startTime}</div>` : ''}
            <div class="event-title">
              ${event.title}
              <span class="event-type type-${event.type}">${typeLabels[event.type] || event.type}</span>
            </div>
            ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
            ${event.locationName ? `<div class="event-location">📍 ${event.locationName}</div>` : ''}
            ${event.estimatedBudget ? `<div class="event-budget">💰 ~${event.estimatedBudget}€</div>` : ''}
            ${(practicalInfo.tips?.length || practicalInfo.openingHours) ? `
              <div class="practical-info">
                ${practicalInfo.openingHours ? `<div>🕐 ${practicalInfo.openingHours}</div>` : ''}
                ${practicalInfo.tips?.[0] ? `<div>💡 ${practicalInfo.tips[0]}</div>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
      
      ${day.notes ? `<p style="margin-left: 25px; color: #6b7280; font-style: italic; margin-top: 10px;">📝 ${day.notes}</p>` : ''}
    </div>
  `).join('')}
  
  <div class="footer">
    Généré par Tripmind - ${new Date().toLocaleDateString('fr-FR')}
  </div>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Export trip error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'export du voyage' },
      { status: 500 }
    );
  }
}
