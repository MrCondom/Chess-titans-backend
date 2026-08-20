/*
  Warnings:

  - You are about to drop the column `championshipWins` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `currentChampionTitle` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `ratingGain` on the `TeamRanking` table. All the data in the column will be lost.
  - Added the required column `tournamentId` to the `TeamPairing` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GameResult" ADD COLUMN "approvedByAdminId" INTEGER;
ALTER TABLE "GameResult" ADD COLUMN "submittedByPlayerId" INTEGER;

-- AlterTable
ALTER TABLE "TeamMembership" ADD COLUMN "boardPosition" INTEGER;

-- CreateTable
CREATE TABLE "TeamGame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamPairingId" INTEGER NOT NULL,
    "boardPosition" INTEGER NOT NULL,
    "whitePlayerId" INTEGER NOT NULL,
    "blackPlayerId" INTEGER NOT NULL,
    "result" INTEGER NOT NULL,
    CONSTRAINT "TeamGame_teamPairingId_fkey" FOREIGN KEY ("teamPairingId") REFERENCES "TeamPairing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamGame_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamGame_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pairing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "tournamentId" INTEGER,
    "whitePlayerId" INTEGER NOT NULL,
    "blackPlayerId" INTEGER NOT NULL,
    "availableAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pairing_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pairing_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pairing_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Pairing" ("availableAt", "blackPlayerId", "category", "createdAt", "id", "mode", "round", "whitePlayerId") SELECT "availableAt", "blackPlayerId", "category", "createdAt", "id", "mode", "round", "whitePlayerId" FROM "Pairing";
DROP TABLE "Pairing";
ALTER TABLE "new_Pairing" RENAME TO "Pairing";
CREATE INDEX "Pairing_category_idx" ON "Pairing"("category");
CREATE INDEX "Pairing_round_idx" ON "Pairing"("round");
CREATE INDEX "Pairing_mode_idx" ON "Pairing"("mode");
CREATE INDEX "Pairing_availableAt_idx" ON "Pairing"("availableAt");
CREATE INDEX "Pairing_whitePlayerId_idx" ON "Pairing"("whitePlayerId");
CREATE INDEX "Pairing_blackPlayerId_idx" ON "Pairing"("blackPlayerId");
CREATE INDEX "Pairing_tournamentId_idx" ON "Pairing"("tournamentId");
CREATE TABLE "new_Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullName" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNREGISTERED',
    "category" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "rapidRating" INTEGER NOT NULL DEFAULT 0,
    "blitzRating" INTEGER NOT NULL DEFAULT 0,
    "bulletRating" INTEGER NOT NULL DEFAULT 0,
    "rapidGain" INTEGER NOT NULL DEFAULT 0,
    "blitzGain" INTEGER NOT NULL DEFAULT 0,
    "bulletGain" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalLosses" INTEGER NOT NULL DEFAULT 0,
    "totalDraws" INTEGER NOT NULL DEFAULT 0,
    "tournamentWins" INTEGER NOT NULL DEFAULT 0,
    "teamId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("bio", "blitzGain", "blitzRating", "bulletGain", "bulletRating", "category", "createdAt", "fullName", "id", "passwordHash", "rapidGain", "rapidRating", "status", "teamId", "totalPoints", "totalRounds", "updatedAt", "username") SELECT "bio", "blitzGain", "blitzRating", "bulletGain", "bulletRating", "category", "createdAt", "fullName", "id", "passwordHash", "rapidGain", "rapidRating", "status", "teamId", "totalPoints", "totalRounds", "updatedAt", "username" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");
CREATE INDEX "Player_category_idx" ON "Player"("category");
CREATE INDEX "Player_status_idx" ON "Player"("status");
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");
CREATE INDEX "Player_fullName_idx" ON "Player"("fullName");
CREATE TABLE "new_PlayerRanking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "accuracy" REAL NOT NULL DEFAULT 0,
    "tournamentId" INTEGER,
    "month" INTEGER,
    "year" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerRanking_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerRanking_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlayerRanking" ("accuracy", "category", "createdAt", "id", "mode", "month", "playerId", "rank", "totalPoints", "totalRounds", "tournamentId", "year") SELECT "accuracy", "category", "createdAt", "id", "mode", "month", "playerId", "rank", "totalPoints", "totalRounds", "tournamentId", "year" FROM "PlayerRanking";
DROP TABLE "PlayerRanking";
ALTER TABLE "new_PlayerRanking" RENAME TO "PlayerRanking";
CREATE INDEX "PlayerRanking_playerId_idx" ON "PlayerRanking"("playerId");
CREATE INDEX "PlayerRanking_category_idx" ON "PlayerRanking"("category");
CREATE INDEX "PlayerRanking_mode_idx" ON "PlayerRanking"("mode");
CREATE INDEX "PlayerRanking_rank_idx" ON "PlayerRanking"("rank");
CREATE INDEX "PlayerRanking_tournamentId_idx" ON "PlayerRanking"("tournamentId");
CREATE INDEX "PlayerRanking_year_month_idx" ON "PlayerRanking"("year", "month");
CREATE TABLE "new_RatingGain" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" INTEGER NOT NULL,
    "pairingId" INTEGER,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "approvedByAdminId" INTEGER,
    "appliedAt" DATETIME,
    "tournamentId" INTEGER,
    "mode" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingGain_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatingGain_pairingId_fkey" FOREIGN KEY ("pairingId") REFERENCES "Pairing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RatingGain" ("amount", "createdAt", "id", "mode", "pairingId", "playerId", "reason") SELECT "amount", "createdAt", "id", "mode", "pairingId", "playerId", "reason" FROM "RatingGain";
DROP TABLE "RatingGain";
ALTER TABLE "new_RatingGain" RENAME TO "RatingGain";
CREATE INDEX "RatingGain_playerId_idx" ON "RatingGain"("playerId");
CREATE INDEX "RatingGain_pairingId_idx" ON "RatingGain"("pairingId");
CREATE INDEX "RatingGain_mode_idx" ON "RatingGain"("mode");
CREATE INDEX "RatingGain_createdAt_idx" ON "RatingGain"("createdAt");
CREATE TABLE "new_TeamPairing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "round" INTEGER NOT NULL,
    "teamAId" INTEGER NOT NULL,
    "teamBId" INTEGER NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "availableAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamPairing_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamPairing_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamPairing_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamPairing" ("availableAt", "createdAt", "id", "round", "teamAId", "teamBId") SELECT "availableAt", "createdAt", "id", "round", "teamAId", "teamBId" FROM "TeamPairing";
DROP TABLE "TeamPairing";
ALTER TABLE "new_TeamPairing" RENAME TO "TeamPairing";
CREATE INDEX "TeamPairing_round_idx" ON "TeamPairing"("round");
CREATE INDEX "TeamPairing_teamAId_idx" ON "TeamPairing"("teamAId");
CREATE INDEX "TeamPairing_teamBId_idx" ON "TeamPairing"("teamBId");
CREATE INDEX "TeamPairing_availableAt_idx" ON "TeamPairing"("availableAt");
CREATE UNIQUE INDEX "TeamPairing_tournamentId_round_teamAId_teamBId_key" ON "TeamPairing"("tournamentId", "round", "teamAId", "teamBId");
CREATE TABLE "new_TeamRanking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamId" INTEGER NOT NULL,
    "category" TEXT,
    "mode" TEXT,
    "rank" INTEGER NOT NULL,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "month" INTEGER,
    "year" INTEGER,
    "tournamentId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamRanking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamRanking_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamRanking" ("category", "createdAt", "id", "mode", "month", "rank", "teamId", "totalPoints", "tournamentId", "year") SELECT "category", "createdAt", "id", "mode", "month", "rank", "teamId", "totalPoints", "tournamentId", "year" FROM "TeamRanking";
DROP TABLE "TeamRanking";
ALTER TABLE "new_TeamRanking" RENAME TO "TeamRanking";
CREATE INDEX "TeamRanking_teamId_idx" ON "TeamRanking"("teamId");
CREATE INDEX "TeamRanking_rank_idx" ON "TeamRanking"("rank");
CREATE INDEX "TeamRanking_category_idx" ON "TeamRanking"("category");
CREATE INDEX "TeamRanking_mode_idx" ON "TeamRanking"("mode");
CREATE INDEX "TeamRanking_tournamentId_idx" ON "TeamRanking"("tournamentId");
CREATE INDEX "TeamRanking_year_month_idx" ON "TeamRanking"("year", "month");
CREATE TABLE "new_Tournament" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "mode" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CATEGORY',
    "format" TEXT NOT NULL DEFAULT 'SWISS',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "championPlayerId" INTEGER,
    "championUsername" TEXT,
    "championTitle" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tournament_championPlayerId_fkey" FOREIGN KEY ("championPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Tournament" ("category", "championPlayerId", "championTitle", "championUsername", "completedAt", "createdAt", "id", "mode", "name", "startedAt", "status", "type", "updatedAt") SELECT "category", "championPlayerId", "championTitle", "championUsername", "completedAt", "createdAt", "id", "mode", "name", "startedAt", "status", "type", "updatedAt" FROM "Tournament";
DROP TABLE "Tournament";
ALTER TABLE "new_Tournament" RENAME TO "Tournament";
CREATE INDEX "Tournament_mode_idx" ON "Tournament"("mode");
CREATE INDEX "Tournament_category_idx" ON "Tournament"("category");
CREATE INDEX "Tournament_type_idx" ON "Tournament"("type");
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");
CREATE INDEX "Tournament_completedAt_idx" ON "Tournament"("completedAt");
CREATE INDEX "Tournament_championPlayerId_idx" ON "Tournament"("championPlayerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TeamGame_teamPairingId_idx" ON "TeamGame"("teamPairingId");

-- CreateIndex
CREATE INDEX "TeamGame_whitePlayerId_idx" ON "TeamGame"("whitePlayerId");

-- CreateIndex
CREATE INDEX "TeamGame_blackPlayerId_idx" ON "TeamGame"("blackPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamGame_teamPairingId_boardPosition_key" ON "TeamGame"("teamPairingId", "boardPosition");

-- CreateIndex
CREATE INDEX "TeamMembership_teamId_boardPosition_idx" ON "TeamMembership"("teamId", "boardPosition");
