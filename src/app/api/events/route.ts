import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';

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

// POST - Create a new event
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const data = await request.json();
    const {
      dayId,
      type,
      title,
      description,
      startTime,
      durationMinutes,
      locationName,
      locationAddress,
      lat,
      lng,
      estimatedBudget,
    } = data;

    if (!dayId || !title) {
      return NextResponse.json(
        { error: 'Données incomplètes' },
        { status: 400 }
      );
    }

    // Verify day belongs to user's trip
    const day = await db.day.findUnique({
      where: { id: dayId },
      include: { trip: true },
    });

    if (!day || day.trip.userId !== user.id) {
      return NextResponse.json({ error: 'Jour non trouvé' }, { status: 404 });
    }

    // Get max order index
    const existingEvents = await db.event.findMany({
      where: { dayId },
      orderBy: { orderIndex: 'desc' },
      take: 1,
    });

    const orderIndex = existingEvents.length > 0 ? existingEvents[0].orderIndex + 1 : 0;

    const event = await db.event.create({
      data: {
        id: randomUUID(),
        dayId,
        type: type || 'visit',
        title,
        description: description || null,
        startTime: startTime || null,
        durationMinutes: durationMinutes || null,
        locationName: locationName || null,
        locationAddress: locationAddress || null,
        lat: lat || null,
        lng: lng || null,
        estimatedBudget: estimatedBudget || null,
        orderIndex,
        photos: '[]',
        practicalInfo: '{}',
        isAiEnriched: false,
      },
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'événement' },
      { status: 500 }
    );
  }
}
