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

// PUT - Update an event
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

    // Get event and verify ownership
    const event = await db.event.findUnique({
      where: { id },
      include: {
        day: {
          include: { trip: true },
        },
      },
    });

    if (!event || event.day.trip.userId !== user.id) {
      return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (data.type !== undefined) updateData.type = data.type;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
    if (data.locationName !== undefined) updateData.locationName = data.locationName;
    if (data.locationAddress !== undefined) updateData.locationAddress = data.locationAddress;
    if (data.lat !== undefined) updateData.lat = data.lat;
    if (data.lng !== undefined) updateData.lng = data.lng;
    if (data.estimatedBudget !== undefined) updateData.estimatedBudget = data.estimatedBudget;
    if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;
    if (data.photos !== undefined) updateData.photos = JSON.stringify(data.photos);
    if (data.practicalInfo !== undefined) updateData.practicalInfo = JSON.stringify(data.practicalInfo);
    if (data.isAiEnriched !== undefined) updateData.isAiEnriched = data.isAiEnriched;
    if (data.sourceUrl !== undefined) updateData.sourceUrl = data.sourceUrl;

    const updatedEvent = await db.event.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ event: updatedEvent });
  } catch (error) {
    console.error('Update event error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'événement' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an event
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

    // Get event and verify ownership
    const event = await db.event.findUnique({
      where: { id },
      include: {
        day: {
          include: { trip: true },
        },
      },
    });

    if (!event || event.day.trip.userId !== user.id) {
      return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
    }

    await db.event.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'événement' },
      { status: 500 }
    );
  }
}
