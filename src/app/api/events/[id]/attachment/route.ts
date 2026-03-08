import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Upload directory
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

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

// Allowed file types
const ALLOWED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'text/html': ['.html', '.htm'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Category mapping
const FILE_CATEGORIES: Record<string, string> = {
  'billet': 'Billet',
  'voucher': 'Voucher / Bon',
  'reservation': 'Réservation',
  'itineraire': 'Itinéraire',
  'contrat': 'Contrat / Assurance',
  'autre': 'Autre document',
};

// POST - Upload attachment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id: eventId } = await params;

    // Get event and verify ownership
    const event = await db.event.findUnique({
      where: { id: eventId },
      include: {
        day: {
          include: { trip: true },
        },
      },
    });

    if (!event || event.day.trip.userId !== user.id) {
      return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string || 'autre';

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10MB)' }, { status: 400 });
    }

    // Validate file type
    const fileType = file.type;
    const allowedExtensions = ALLOWED_TYPES[fileType];
    if (!allowedExtensions) {
      return NextResponse.json({ 
        error: `Type de fichier non autorisé. Types acceptés: PDF, images, documents Office` 
      }, { status: 400 });
    }

    // Generate unique filename
    const ext = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json({ error: 'Extension de fichier non autorisée' }, { status: 400 });
    }

    await ensureUploadDir();
    
    const fileId = randomUUID();
    const fileName = `${fileId}${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Get current attachments
    let attachments: any[] = [];
    try {
      attachments = JSON.parse(event.attachments || '[]');
    } catch {
      attachments = [];
    }

    // Add new attachment
    const newAttachment = {
      id: fileId,
      name: file.name,
      type: fileType,
      size: file.size,
      category: category,
      categoryName: FILE_CATEGORIES[category] || 'Autre document',
      path: `/uploads/${fileName}`,
      uploadedAt: new Date().toISOString(),
    };

    attachments.push(newAttachment);

    // Update event
    const updatedEvent = await db.event.update({
      where: { id: eventId },
      data: { 
        attachments: JSON.stringify(attachments),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      attachment: newAttachment,
      event: updatedEvent,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du téléchargement' },
      { status: 500 }
    );
  }
}

// GET - List attachments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id: eventId } = await params;

    const event = await db.event.findUnique({
      where: { id: eventId },
      include: {
        day: {
          include: { trip: true },
        },
      },
    });

    if (!event || event.day.trip.userId !== user.id) {
      return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
    }

    let attachments: any[] = [];
    try {
      attachments = JSON.parse(event.attachments || '[]');
    } catch {
      attachments = [];
    }

    return NextResponse.json({
      success: true,
      attachments,
    });
  } catch (error) {
    console.error('Get attachments error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}

// DELETE - Remove attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id: eventId } = await params;
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('attachmentId');

    if (!attachmentId) {
      return NextResponse.json({ error: 'ID de pièce jointe requis' }, { status: 400 });
    }

    const event = await db.event.findUnique({
      where: { id: eventId },
      include: {
        day: {
          include: { trip: true },
        },
      },
    });

    if (!event || event.day.trip.userId !== user.id) {
      return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
    }

    let attachments: any[] = [];
    try {
      attachments = JSON.parse(event.attachments || '[]');
    } catch {
      attachments = [];
    }

    const attachment = attachments.find(a => a.id === attachmentId);
    if (!attachment) {
      return NextResponse.json({ error: 'Pièce jointe non trouvée' }, { status: 404 });
    }

    // Delete file
    try {
      const filePath = path.join(UPLOAD_DIR, `${attachmentId}${path.extname(attachment.name)}`);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (e) {
      console.error('Failed to delete file:', e);
    }

    // Remove from array
    const updatedAttachments = attachments.filter(a => a.id !== attachmentId);

    const updatedEvent = await db.event.update({
      where: { id: eventId },
      data: { 
        attachments: JSON.stringify(updatedAttachments),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      event: updatedEvent,
    });
  } catch (error) {
    console.error('Delete attachment error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}
