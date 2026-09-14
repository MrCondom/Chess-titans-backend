-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GameResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "round" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "whitePlayerId" INTEGER NOT NULL,
    "blackPlayerId" INTEGER NOT NULL,
    "whiteScore" REAL NOT NULL,
    "blackScore" REAL NOT NULL,
    "whiteRatingChange" INTEGER NOT NULL DEFAULT 0,
    "blackRatingChange" INTEGER NOT NULL DEFAULT 0,
    "submittedByPlayerId" INTEGER,
    "category" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedByAdminId" INTEGER,
    "approvedAt" DATETIME,
    "statisticsApplied" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "pairingId" INTEGER,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameResult_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameResult_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameResult_pairingId_fkey" FOREIGN KEY ("pairingId") REFERENCES "Pairing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GameResult" ("approvalStatus", "approvedAt", "approvedByAdminId", "blackPlayerId", "blackRatingChange", "blackScore", "category", "date", "id", "mode", "pairingId", "rejectionReason", "round", "submittedByPlayerId", "whitePlayerId", "whiteRatingChange", "whiteScore") SELECT "approvalStatus", "approvedAt", "approvedByAdminId", "blackPlayerId", "blackRatingChange", "blackScore", "category", "date", "id", "mode", "pairingId", "rejectionReason", "round", "submittedByPlayerId", "whitePlayerId", "whiteRatingChange", "whiteScore" FROM "GameResult";
DROP TABLE "GameResult";
ALTER TABLE "new_GameResult" RENAME TO "GameResult";
CREATE UNIQUE INDEX "GameResult_pairingId_key" ON "GameResult"("pairingId");
CREATE INDEX "GameResult_round_idx" ON "GameResult"("round");
CREATE INDEX "GameResult_mode_idx" ON "GameResult"("mode");
CREATE INDEX "GameResult_category_idx" ON "GameResult"("category");
CREATE INDEX "GameResult_date_idx" ON "GameResult"("date");
CREATE INDEX "GameResult_approvalStatus_idx" ON "GameResult"("approvalStatus");
CREATE INDEX "GameResult_whitePlayerId_idx" ON "GameResult"("whitePlayerId");
CREATE INDEX "GameResult_blackPlayerId_idx" ON "GameResult"("blackPlayerId");
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
    "statisticsApplied" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TeamGame_teamPairingId_fkey" FOREIGN KEY ("teamPairingId") REFERENCES "TeamPairing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamGame_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamGame_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamGame" ("approvalStatus", "approvedAt", "approvedByAdminId", "blackPlayerId", "boardPosition", "id", "rejectionReason", "result", "teamPairingId", "whitePlayerId") SELECT "approvalStatus", "approvedAt", "approvedByAdminId", "blackPlayerId", "boardPosition", "id", "rejectionReason", "result", "teamPairingId", "whitePlayerId" FROM "TeamGame";
DROP TABLE "TeamGame";
ALTER TABLE "new_TeamGame" RENAME TO "TeamGame";
CREATE INDEX "TeamGame_teamPairingId_idx" ON "TeamGame"("teamPairingId");
CREATE INDEX "TeamGame_whitePlayerId_idx" ON "TeamGame"("whitePlayerId");
CREATE INDEX "TeamGame_blackPlayerId_idx" ON "TeamGame"("blackPlayerId");
CREATE INDEX "TeamGame_approvalStatus_idx" ON "TeamGame"("approvalStatus");
CREATE UNIQUE INDEX "TeamGame_teamPairingId_boardPosition_key" ON "TeamGame"("teamPairingId", "boardPosition");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
