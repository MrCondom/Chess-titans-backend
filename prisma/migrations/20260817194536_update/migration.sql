/*
  Warnings:

  - Added the required column `mode` to the `Pairing` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pairing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "whitePlayerId" INTEGER NOT NULL,
    "blackPlayerId" INTEGER NOT NULL,
    "availableAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pairing_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pairing_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Pairing" ("availableAt", "blackPlayerId", "category", "createdAt", "id", "round", "whitePlayerId") SELECT "availableAt", "blackPlayerId", "category", "createdAt", "id", "round", "whitePlayerId" FROM "Pairing";
DROP TABLE "Pairing";
ALTER TABLE "new_Pairing" RENAME TO "Pairing";
CREATE INDEX "Pairing_category_idx" ON "Pairing"("category");
CREATE INDEX "Pairing_round_idx" ON "Pairing"("round");
CREATE INDEX "Pairing_availableAt_idx" ON "Pairing"("availableAt");
CREATE UNIQUE INDEX "Pairing_category_round_mode_whitePlayerId_blackPlayerId_key" ON "Pairing"("category", "round", "mode", "whitePlayerId", "blackPlayerId");
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
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
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
