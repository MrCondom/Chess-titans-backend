-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TeamGame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamPairingId" INTEGER NOT NULL,
    "boardPosition" INTEGER NOT NULL,
    "whitePlayerId" INTEGER NOT NULL,
    "blackPlayerId" INTEGER NOT NULL,
    "result" INTEGER NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "TeamGame_teamPairingId_fkey" FOREIGN KEY ("teamPairingId") REFERENCES "TeamPairing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamGame_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamGame_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamGame" ("blackPlayerId", "boardPosition", "id", "result", "teamPairingId", "whitePlayerId") SELECT "blackPlayerId", "boardPosition", "id", "result", "teamPairingId", "whitePlayerId" FROM "TeamGame";
DROP TABLE "TeamGame";
ALTER TABLE "new_TeamGame" RENAME TO "TeamGame";
CREATE INDEX "TeamGame_teamPairingId_idx" ON "TeamGame"("teamPairingId");
CREATE INDEX "TeamGame_whitePlayerId_idx" ON "TeamGame"("whitePlayerId");
CREATE INDEX "TeamGame_blackPlayerId_idx" ON "TeamGame"("blackPlayerId");
CREATE UNIQUE INDEX "TeamGame_teamPairingId_boardPosition_key" ON "TeamGame"("teamPairingId", "boardPosition");
CREATE TABLE "new_TeamRanking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamId" INTEGER NOT NULL,
    "category" TEXT,
    "mode" TEXT,
    "rank" INTEGER NOT NULL,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "totalRating" INTEGER NOT NULL DEFAULT 0,
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
CREATE INDEX "TeamRanking_tournamentId_idx" ON "TeamRanking"("tournamentId");
CREATE INDEX "TeamRanking_year_month_idx" ON "TeamRanking"("year", "month");
CREATE UNIQUE INDEX "TeamRanking_tournamentId_teamId_key" ON "TeamRanking"("tournamentId", "teamId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
