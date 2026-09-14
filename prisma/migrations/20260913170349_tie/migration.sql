/*
  Warnings:

  - You are about to drop the column `accuracy` on the `PlayerRanking` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlayerRanking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "tieBreaker" REAL NOT NULL DEFAULT 0,
    "tournamentId" INTEGER,
    "month" INTEGER,
    "year" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerRanking_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerRanking_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlayerRanking" ("category", "createdAt", "id", "mode", "month", "playerId", "rank", "rating", "totalPoints", "totalRounds", "tournamentId", "year") SELECT "category", "createdAt", "id", "mode", "month", "playerId", "rank", "rating", "totalPoints", "totalRounds", "tournamentId", "year" FROM "PlayerRanking";
DROP TABLE "PlayerRanking";
ALTER TABLE "new_PlayerRanking" RENAME TO "PlayerRanking";
CREATE INDEX "PlayerRanking_playerId_idx" ON "PlayerRanking"("playerId");
CREATE INDEX "PlayerRanking_category_idx" ON "PlayerRanking"("category");
CREATE INDEX "PlayerRanking_mode_idx" ON "PlayerRanking"("mode");
CREATE INDEX "PlayerRanking_rank_idx" ON "PlayerRanking"("rank");
CREATE INDEX "PlayerRanking_tournamentId_idx" ON "PlayerRanking"("tournamentId");
CREATE INDEX "PlayerRanking_year_month_idx" ON "PlayerRanking"("year", "month");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
