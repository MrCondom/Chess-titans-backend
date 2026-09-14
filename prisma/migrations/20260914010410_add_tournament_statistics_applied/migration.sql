/*
  Warnings:

  - You are about to drop the column `accuracy` on the `TournamentResult` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tournament" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "mode" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CATEGORY',
    "format" TEXT NOT NULL DEFAULT 'SWISS',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalRounds" INTEGER NOT NULL DEFAULT 1,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "roundDurationMinutes" INTEGER NOT NULL DEFAULT 0,
    "championPlayerId" INTEGER,
    "championUsername" TEXT,
    "championTitle" TEXT,
    "statisticsApplied" BOOLEAN NOT NULL DEFAULT false,
    "statisticsAppliedAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tournament_championPlayerId_fkey" FOREIGN KEY ("championPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Tournament" ("category", "championPlayerId", "championTitle", "championUsername", "completedAt", "createdAt", "currentRound", "format", "id", "mode", "name", "roundDurationMinutes", "startedAt", "status", "totalRounds", "type", "updatedAt") SELECT "category", "championPlayerId", "championTitle", "championUsername", "completedAt", "createdAt", "currentRound", "format", "id", "mode", "name", "roundDurationMinutes", "startedAt", "status", "totalRounds", "type", "updatedAt" FROM "Tournament";
DROP TABLE "Tournament";
ALTER TABLE "new_Tournament" RENAME TO "Tournament";
CREATE INDEX "Tournament_mode_idx" ON "Tournament"("mode");
CREATE INDEX "Tournament_category_idx" ON "Tournament"("category");
CREATE INDEX "Tournament_type_idx" ON "Tournament"("type");
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");
CREATE INDEX "Tournament_completedAt_idx" ON "Tournament"("completedAt");
CREATE INDEX "Tournament_championPlayerId_idx" ON "Tournament"("championPlayerId");
CREATE TABLE "new_TournamentResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tournamentId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "tieBreaker" REAL NOT NULL DEFAULT 0,
    "ratingBefore" INTEGER NOT NULL DEFAULT 0,
    "ratingAfter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentResult_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TournamentResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TournamentResult" ("createdAt", "draws", "id", "losses", "playerId", "rank", "ratingAfter", "ratingBefore", "tieBreaker", "totalPoints", "totalRounds", "tournamentId", "wins") SELECT "createdAt", "draws", "id", "losses", "playerId", "rank", "ratingAfter", "ratingBefore", "tieBreaker", "totalPoints", "totalRounds", "tournamentId", "wins" FROM "TournamentResult";
DROP TABLE "TournamentResult";
ALTER TABLE "new_TournamentResult" RENAME TO "TournamentResult";
CREATE INDEX "TournamentResult_tournamentId_idx" ON "TournamentResult"("tournamentId");
CREATE INDEX "TournamentResult_playerId_idx" ON "TournamentResult"("playerId");
CREATE INDEX "TournamentResult_rank_idx" ON "TournamentResult"("rank");
CREATE UNIQUE INDEX "TournamentResult_tournamentId_playerId_key" ON "TournamentResult"("tournamentId", "playerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
