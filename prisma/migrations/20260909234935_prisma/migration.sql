/*
  Warnings:

  - You are about to alter the column `result` on the `TeamGame` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TeamGame" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamPairingId" INTEGER NOT NULL,
    "boardPosition" INTEGER NOT NULL,
    "whitePlayerId" INTEGER NOT NULL,
    "blackPlayerId" INTEGER NOT NULL,
    "result" REAL NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedByAdminId" INTEGER,
    "approvedAt" DATETIME,
    "rejectionReason" TEXT,
    CONSTRAINT "TeamGame_teamPairingId_fkey" FOREIGN KEY ("teamPairingId") REFERENCES "TeamPairing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamGame_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamGame_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamGame" ("approvalStatus", "blackPlayerId", "boardPosition", "id", "result", "teamPairingId", "whitePlayerId") SELECT "approvalStatus", "blackPlayerId", "boardPosition", "id", "result", "teamPairingId", "whitePlayerId" FROM "TeamGame";
DROP TABLE "TeamGame";
ALTER TABLE "new_TeamGame" RENAME TO "TeamGame";
CREATE INDEX "TeamGame_teamPairingId_idx" ON "TeamGame"("teamPairingId");
CREATE INDEX "TeamGame_whitePlayerId_idx" ON "TeamGame"("whitePlayerId");
CREATE INDEX "TeamGame_blackPlayerId_idx" ON "TeamGame"("blackPlayerId");
CREATE INDEX "TeamGame_approvalStatus_idx" ON "TeamGame"("approvalStatus");
CREATE UNIQUE INDEX "TeamGame_teamPairingId_boardPosition_key" ON "TeamGame"("teamPairingId", "boardPosition");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
