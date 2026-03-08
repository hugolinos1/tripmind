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

// GET - List all trips for the user
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const trips = await db.trip.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ trips });
  } catch (error) {
    console.error('Get trips error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des voyages' },
      { status: 500 }
    );
  }
}

// POST - Create a new trip
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const data = await request.json();
    const {
      title,
      destinations,
      startDate,
      endDate,
      travelers,
      preferences,
    } = data;

    if (!title || !destinations || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Données incomplètes' },
        { status: 400 }
      );
    }

    // Create trip
    const trip = await db.trip.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        title,
        destinations: JSON.stringify(destinations),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        travelers: JSON.stringify(travelers || { adults: 1, children: [], hasPets: false }),
        preferences: JSON.stringify(preferences || {
          pace: 50,
          budget: 50,
          interests: [],
          accessibility: false,
          dietary: [],
          alreadyVisited: [],
        }),
        status: 'draft',
      },
    });

    // Create days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const daysData = [];
    for (let i = 0; i < dayCount; i++) {
      const dayDate = new Date(start);
      dayDate.setDate(dayDate.getDate() + i);
      daysData.push({
        id: randomUUID(),
        tripId: trip.id,
        date: dayDate,
        orderIndex: i,
      });
    }

    await db.day.createMany({ data: daysData });

    // Fetch the complete trip with days
    const completeTrip = await db.trip.findUnique({
      where: { id: trip.id },
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

    return NextResponse.json({ trip: completeTrip });
  } catch (error) {
    console.error('Create trip error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du voyage' },
      { status: 500 }
    );
  }
}
