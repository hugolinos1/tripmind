import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

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

// PUT - Update day (locations, notes, etc.)
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

    // Verify day belongs to user's trip
    const day = await db.day.findUnique({
      where: { id },
      include: { trip: true },
    });

    if (!day || day.trip.userId !== user.id) {
      return NextResponse.json({ error: 'Jour non trouvé' }, { status: 404 });
    }

    // Build SQL update query for location fields
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (data.startLocationName !== undefined) {
      updates.push('startLocationName = ?');
      values.push(data.startLocationName);
    }
    if (data.startLocationAddress !== undefined) {
      updates.push('startLocationAddress = ?');
      values.push(data.startLocationAddress || null);
    }
    if (data.startLat !== undefined) {
      updates.push('startLat = ?');
      values.push(data.startLat || null);
    }
    if (data.startLng !== undefined) {
      updates.push('startLng = ?');
      values.push(data.startLng || null);
    }
    if (data.endLocationName !== undefined) {
      updates.push('endLocationName = ?');
      values.push(data.endLocationName);
    }
    if (data.endLocationAddress !== undefined) {
      updates.push('endLocationAddress = ?');
      values.push(data.endLocationAddress || null);
    }
    if (data.endLat !== undefined) {
      updates.push('endLat = ?');
      values.push(data.endLat || null);
    }
    if (data.endLng !== undefined) {
      updates.push('endLng = ?');
      values.push(data.endLng || null);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes || null);
    }

    if (updates.length > 0) {
      updates.push('updatedAt = ?');
      values.push(new Date().toISOString());
      values.push(id);

      await db.$executeRawUnsafe(
        `UPDATE Day SET ${updates.join(', ')} WHERE id = ?`,
        ...values
      );
    }

    // Fetch the updated day with events
    const updatedDay = await db.day.findUnique({
      where: { id },
      include: {
        events: {
          orderBy: { orderIndex: 'asc' as Prisma.SortOrder },
        },
      },
    });

    // If setting end location, update next day's start location
    if (data.endLocationName) {
      const nextDay = await db.day.findFirst({
        where: {
          tripId: day.tripId,
          orderIndex: day.orderIndex + 1,
        },
      });

      if (nextDay) {
        await db.$executeRawUnsafe(
          `UPDATE Day SET startLocationName = ?, startLocationAddress = ?, startLat = ?, startLng = ?, updatedAt = ? WHERE id = ?`,
          data.endLocationName,
          data.endLocationAddress || null,
          data.endLat || null,
          data.endLng || null,
          new Date().toISOString(),
          nextDay.id
        );
      }
    }

    // If setting start location, update previous day's end location
    if (data.startLocationName) {
      const prevDay = await db.day.findFirst({
        where: {
          tripId: day.tripId,
          orderIndex: day.orderIndex - 1,
        },
      });

      if (prevDay) {
        await db.$executeRawUnsafe(
          `UPDATE Day SET endLocationName = ?, endLocationAddress = ?, endLat = ?, endLng = ?, updatedAt = ? WHERE id = ?`,
          data.startLocationName,
          data.startLocationAddress || null,
          data.startLat || null,
          data.startLng || null,
          new Date().toISOString(),
          prevDay.id
        );
      }
    }

    return NextResponse.json({ day: updatedDay });
  } catch (error) {
    console.error('Update day error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du jour' },
      { status: 500 }
    );
  }
}
