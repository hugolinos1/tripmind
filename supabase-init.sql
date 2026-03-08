-- TripMind Database Schema for Supabase (PostgreSQL)
-- Execute this in Supabase SQL Editor

-- Create User table
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT,
  "name" TEXT,
  "avatar" TEXT,
  "language" TEXT NOT NULL DEFAULT 'fr',
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_email_key" UNIQUE ("email")
);

-- Create Session table
CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Session_token_key" UNIQUE ("token")
);

-- Create Trip table
CREATE TABLE IF NOT EXISTS "Trip" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "destinations" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "travelers" TEXT NOT NULL,
  "preferences" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "shareToken" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Trip_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Trip_shareToken_key" UNIQUE ("shareToken")
);

-- Create Day table
CREATE TABLE IF NOT EXISTS "Day" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "notes" TEXT,
  "startLocationName" TEXT,
  "startLocationAddress" TEXT,
  "startLat" DOUBLE PRECISION,
  "startLng" DOUBLE PRECISION,
  "endLocationName" TEXT,
  "endLocationAddress" TEXT,
  "endLat" DOUBLE PRECISION,
  "endLng" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Day_pkey" PRIMARY KEY ("id")
);

-- Create Event table
CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT NOT NULL,
  "dayId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startTime" TEXT,
  "durationMinutes" INTEGER,
  "locationName" TEXT,
  "locationAddress" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "photos" TEXT NOT NULL DEFAULT '[]',
  "practicalInfo" TEXT NOT NULL DEFAULT '{}',
  "estimatedBudget" DOUBLE PRECISION,
  "isAiEnriched" BOOLEAN NOT NULL DEFAULT false,
  "sourceUrl" TEXT,
  "attachments" TEXT NOT NULL DEFAULT '[]',
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- Create Enrichment table
CREATE TABLE IF NOT EXISTS "Enrichment" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "rawResponse" TEXT NOT NULL,
  "tokensUsed" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Enrichment_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Day" ADD CONSTRAINT "Day_tripId_fkey" 
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Event" ADD CONSTRAINT "Event_dayId_fkey" 
  FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Enrichment" ADD CONSTRAINT "Enrichment_eventId_fkey" 
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Trip_userId_idx" ON "Trip"("userId");
CREATE INDEX IF NOT EXISTS "Day_tripId_idx" ON "Day"("tripId");
CREATE INDEX IF NOT EXISTS "Day_tripId_orderIndex_idx" ON "Day"("tripId", "orderIndex");
CREATE INDEX IF NOT EXISTS "Event_dayId_idx" ON "Event"("dayId");
CREATE INDEX IF NOT EXISTS "Event_dayId_orderIndex_idx" ON "Event"("dayId", "orderIndex");
CREATE INDEX IF NOT EXISTS "Enrichment_eventId_idx" ON "Enrichment"("eventId");

-- Success message
SELECT 'Tables created successfully!' as message;
