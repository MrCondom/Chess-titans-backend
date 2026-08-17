/*
  Warnings:

  - You are about to alter the column `totalPoints` on the `Player` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "rapidRating" INTEGER NOT NULL DEFAULT 0,
    "blitzRating" INTEGER NOT NULL DEFAULT 0,
    "bulletRating" INTEGER NOT NULL DEFAULT 0,
    "rapidGain" INTEGER NOT NULL DEFAULT 0,
    "blitzGain" INTEGER NOT NULL DEFAULT 0,
    "bulletGain" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamId" INTEGER,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("bio", "blitzGain", "blitzRating", "bulletGain", "bulletRating", "category", "createdAt", "fullName", "id", "rapidGain", "rapidRating", "status", "teamId", "totalPoints", "totalRounds", "updatedAt", "username") SELECT "bio", "blitzGain", "blitzRating", "bulletGain", "bulletRating", "category", "createdAt", "fullName", "id", "rapidGain", "rapidRating", "status", "teamId", "totalPoints", "totalRounds", "updatedAt", "username" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");
CREATE INDEX "Player_category_idx" ON "Player"("category");
CREATE INDEX "Player_status_idx" ON "Player"("status");
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
