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

// Helper to calculate days between two dates
function getDaysBetweenDates(startDate: Date, endDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((endDate.getTime() - startDate.getTime()) / oneDay)) + 1;
}

// PUT - Update trip preferences
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
    const { preferences, travelers, startDate, endDate } = data;

    // Verify trip belongs to user
    const trip = await db.trip.findFirst({
      where: {
        id,
        userId: user.id,
        deletedAt: null,
      },
      include: {
        days: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Voyage non trouvé' }, { status: 404 });
    }

    // Update trip
    const updateData: Record<string, unknown> = {};
    
    if (preferences) {
      updateData.preferences = JSON.stringify(preferences);
    }
    
    if (travelers) {
      updateData.travelers = JSON.stringify(travelers);
    }

    // Handle date changes
    if (startDate && endDate) {
      const newStartDate = new Date(startDate);
      const newEndDate = new Date(endDate);
      
      updateData.startDate = newStartDate;
      updateData.endDate = newEndDate;

      const currentDayCount = trip.days.length;
      const newDayCount = getDaysBetweenDates(newStartDate, newEndDate);

      if (newDayCount > currentDayCount) {
        // Add new days
        const daysToAdd = [];
        for (let i = currentDayCount; i < newDayCount; i++) {
          const dayDate = new Date(newStartDate);
          dayDate.setDate(dayDate.getDate() + i);
          daysToAdd.push({
            id: randomUUID(),
            tripId: id,
            date: dayDate,
            orderIndex: i,
          });
        }
        
        if (daysToAdd.length > 0) {
          await db.day.createMany({ data: daysToAdd });
        }
      } else if (newDayCount < currentDayCount) {
        // Remove extra days (and their events)
        const daysToRemove = trip.days.slice(newDayCount);
        for (const day of daysToRemove) {
          // Delete events first
          await db.event.deleteMany({ where: { dayId: day.id } });
          await db.day.delete({ where: { id: day.id } });
        }
      }

      // Update existing days' dates
      for (let i = 0; i < Math.min(currentDayCount, newDayCount); i++) {
        const dayDate = new Date(newStartDate);
        dayDate.setDate(dayDate.getDate() + i);
        await db.day.update({
          where: { id: trip.days[i].id },
          data: { date: dayDate },
        });
      }
    }

    const updatedTrip = await db.trip.update({
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

    return NextResponse.json({ trip: updatedTrip });
  } catch (error) {
    console.error('Update preferences error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des préférences' },
      { status: 500 }
    );
  }
}
