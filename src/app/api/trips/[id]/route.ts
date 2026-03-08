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

// GET - Get a single trip
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

    // Check if it's a shared trip or user's trip
    if (!user && !trip.shareToken) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (user && trip.userId !== user.id && !trip.shareToken) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    return NextResponse.json({ trip });
  } catch (error) {
    console.error('Get trip error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du voyage' },
      { status: 500 }
    );
  }
}

// PUT - Update a trip
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    // Check ownership
    const existingTrip = await db.trip.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });

    if (!existingTrip) {
      return NextResponse.json({ error: 'Voyage non trouvé' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (data.title) updateData.title = data.title;
    if (data.destinations) updateData.destinations = JSON.stringify(data.destinations);
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    if (data.travelers) updateData.travelers = JSON.stringify(data.travelers);
    if (data.preferences) updateData.preferences = JSON.stringify(data.preferences);
    if (data.status) updateData.status = data.status;

    const trip = await db.trip.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ trip });
  } catch (error) {
    console.error('Update trip error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du voyage' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete a trip
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;

    // Check ownership
    const trip = await db.trip.findFirst({
      where: { id, userId: user.id, deletedAt: null },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Voyage non trouvé' }, { status: 404 });
    }

    // Soft delete
    await db.trip.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete trip error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du voyage' },
      { status: 500 }
    );
  }
}
