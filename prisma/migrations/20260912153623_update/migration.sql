-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TeamPairing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "round" INTEGER NOT NULL,
    "tournamentId" INTEGER,
    "teamAId" INTEGER NOT NULL,
    "teamBId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "availableAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamPairing_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TeamPairing_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamPairing_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamPairing" ("availableAt", "createdAt", "id", "mode", "round", "teamAId", "teamBId") SELECT "availableAt", "createdAt", "id", "mode", "round", "teamAId", "teamBId" FROM "TeamPairing";
DROP TABLE "TeamPairing";
ALTER TABLE "new_TeamPairing" RENAME TO "TeamPairing";
CREATE INDEX "TeamPairing_round_idx" ON "TeamPairing"("round");
CREATE INDEX "TeamPairing_teamAId_idx" ON "TeamPairing"("teamAId");
CREATE INDEX "TeamPairing_teamBId_idx" ON "TeamPairing"("teamBId");
CREATE INDEX "TeamPairing_mode_idx" ON "TeamPairing"("mode");
CREATE INDEX "TeamPairing_tournamentId_idx" ON "TeamPairing"("tournamentId");
CREATE UNIQUE INDEX "TeamPairing_round_teamAId_teamBId_mode_key" ON "TeamPairing"("round", "teamAId", "teamBId", "mode");
CREATE TABLE "new_TeamRanking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamId" INTEGER NOT NULL,
    "category" TEXT,
    "mode" TEXT,
    "rank" INTEGER NOT NULL,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "totalRating" INTEGER NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "tieBreaker" REAL NOT NULL DEFAULT 0,
    "month" INTEGER,
    "year" INTEGER,
    "tournamentId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamRanking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamRanking_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamRanking" ("category", "createdAt", "id", "mode", "month", "rank", "teamId", "totalPoints", "totalRating", "tournamentId", "year") SELECT "category", "createdAt", "id", "mode", "month", "rank", "teamId", "totalPoints", "totalRating", "tournamentId", "year" FROM "TeamRanking";
DROP TABLE "TeamRanking";
ALTER TABLE "new_TeamRanking" RENAME TO "TeamRanking";
CREATE INDEX "TeamRanking_teamId_idx" ON "TeamRanking"("teamId");
CREATE INDEX "TeamRanking_rank_idx" ON "TeamRanking"("rank");
CREATE INDEX "TeamRanking_category_idx" ON "TeamRanking"("category");
CREATE INDEX "TeamRanking_tournamentId_idx" ON "TeamRanking"("tournamentId");
CREATE INDEX "TeamRanking_year_month_idx" ON "TeamRanking"("year", "month");
CREATE UNIQUE INDEX "TeamRanking_tournamentId_teamId_key" ON "TeamRanking"("tournamentId", "teamId");
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
    "accuracy" REAL NOT NULL DEFAULT 0,
    "ratingBefore" INTEGER NOT NULL DEFAULT 0,
    "ratingAfter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentResult_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TournamentResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TournamentResult" ("accuracy", "createdAt", "id", "playerId", "rank", "ratingAfter", "ratingBefore", "totalPoints", "totalRounds", "tournamentId") SELECT "accuracy", "createdAt", "id", "playerId", "rank", "ratingAfter", "ratingBefore", "totalPoints", "totalRounds", "tournamentId" FROM "TournamentResult";
DROP TABLE "TournamentResult";
ALTER TABLE "new_TournamentResult" RENAME TO "TournamentResult";
CREATE INDEX "TournamentResult_tournamentId_idx" ON "TournamentResult"("tournamentId");
CREATE INDEX "TournamentResult_playerId_idx" ON "TournamentResult"("playerId");
CREATE INDEX "TournamentResult_rank_idx" ON "TournamentResult"("rank");
CREATE UNIQUE INDEX "TournamentResult_tournamentId_playerId_key" ON "TournamentResult"("tournamentId", "playerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
