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

// POST - Generate share token for a trip
export async function POST(
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

    // Generate share token if not exists
    let shareToken = trip.shareToken;
    if (!shareToken) {
      shareToken = randomUUID();
      await db.trip.update({
        where: { id },
        data: { shareToken },
      });
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_URL || ''}/shared/${shareToken}`;

    return NextResponse.json({
      success: true,
      shareToken,
      shareUrl,
    });
  } catch (error) {
    console.error('Share trip error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du partage du voyage' },
      { status: 500 }
    );
  }
}

// DELETE - Remove share access
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
      where: { id, userId: user.id },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Voyage non trouvé' }, { status: 404 });
    }

    // Remove share token
    await db.trip.update({
      where: { id },
      data: { shareToken: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unshare trip error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du partage' },
      { status: 500 }
    );
  }
}
