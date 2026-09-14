-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RatingGain" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" INTEGER NOT NULL,
    "pairingId" INTEGER,
    "teamGameId" INTEGER,
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
    CONSTRAINT "RatingGain_pairingId_fkey" FOREIGN KEY ("pairingId") REFERENCES "Pairing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RatingGain_teamGameId_fkey" FOREIGN KEY ("teamGameId") REFERENCES "TeamGame" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RatingGain" ("amount", "appliedAt", "approvalStatus", "approvedAt", "approvedByAdminId", "createdAt", "id", "isApplied", "mode", "pairingId", "playerId", "reason", "tournamentId") SELECT "amount", "appliedAt", "approvalStatus", "approvedAt", "approvedByAdminId", "createdAt", "id", "isApplied", "mode", "pairingId", "playerId", "reason", "tournamentId" FROM "RatingGain";
DROP TABLE "RatingGain";
ALTER TABLE "new_RatingGain" RENAME TO "RatingGain";
CREATE INDEX "RatingGain_playerId_idx" ON "RatingGain"("playerId");
CREATE INDEX "RatingGain_pairingId_idx" ON "RatingGain"("pairingId");
CREATE INDEX "RatingGain_teamGameId_idx" ON "RatingGain"("teamGameId");
CREATE INDEX "RatingGain_mode_idx" ON "RatingGain"("mode");
CREATE INDEX "RatingGain_createdAt_idx" ON "RatingGain"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
