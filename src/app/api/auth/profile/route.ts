import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Find session
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expirée' }, { status: 401 });
    }

    const data = await request.json();
    const { name, language, currency, avatar } = data;

    // Update user
    const updatedUser = await db.user.update({
      where: { id: session.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(language !== undefined && { language }),
        ...(currency !== undefined && { currency }),
        ...(avatar !== undefined && { avatar }),
      },
    });

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatar: updatedUser.avatar,
        language: updatedUser.language,
        currency: updatedUser.currency,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du profil' },
      { status: 500 }
    );
  }
}
