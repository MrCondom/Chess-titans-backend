/*
  Warnings:

  - You are about to alter the column `totalPoints` on the `PlayerRanking` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.
  - You are about to alter the column `totalPoints` on the `TeamRanking` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

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
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "accuracy" REAL NOT NULL DEFAULT 0,
    "month" INTEGER,
    "year" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerRanking_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlayerRanking" ("accuracy", "category", "createdAt", "id", "mode", "month", "playerId", "rank", "totalPoints", "totalRounds", "year") SELECT "accuracy", "category", "createdAt", "id", "mode", "month", "playerId", "rank", "totalPoints", "totalRounds", "year" FROM "PlayerRanking";
DROP TABLE "PlayerRanking";
ALTER TABLE "new_PlayerRanking" RENAME TO "PlayerRanking";
CREATE INDEX "PlayerRanking_category_idx" ON "PlayerRanking"("category");
CREATE INDEX "PlayerRanking_mode_idx" ON "PlayerRanking"("mode");
CREATE INDEX "PlayerRanking_rank_idx" ON "PlayerRanking"("rank");
CREATE INDEX "PlayerRanking_year_month_idx" ON "PlayerRanking"("year", "month");
CREATE TABLE "new_TeamRanking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamId" INTEGER NOT NULL,
    "category" TEXT,
    "mode" TEXT,
    "rank" INTEGER NOT NULL,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "ratingGain" INTEGER NOT NULL DEFAULT 0,
    "month" INTEGER,
    "year" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamRanking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamRanking" ("category", "createdAt", "id", "mode", "month", "rank", "ratingGain", "teamId", "totalPoints", "year") SELECT "category", "createdAt", "id", "mode", "month", "rank", "ratingGain", "teamId", "totalPoints", "year" FROM "TeamRanking";
DROP TABLE "TeamRanking";
ALTER TABLE "new_TeamRanking" RENAME TO "TeamRanking";
CREATE INDEX "TeamRanking_rank_idx" ON "TeamRanking"("rank");
CREATE INDEX "TeamRanking_category_idx" ON "TeamRanking"("category");
CREATE INDEX "TeamRanking_mode_idx" ON "TeamRanking"("mode");
CREATE INDEX "TeamRanking_year_month_idx" ON "TeamRanking"("year", "month");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
