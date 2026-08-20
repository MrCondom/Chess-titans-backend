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
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tournament_championPlayerId_fkey" FOREIGN KEY ("championPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Tournament" ("category", "championPlayerId", "championTitle", "championUsername", "completedAt", "createdAt", "format", "id", "mode", "name", "startedAt", "status", "type", "updatedAt") SELECT "category", "championPlayerId", "championTitle", "championUsername", "completedAt", "createdAt", "format", "id", "mode", "name", "startedAt", "status", "type", "updatedAt" FROM "Tournament";
DROP TABLE "Tournament";
ALTER TABLE "new_Tournament" RENAME TO "Tournament";
CREATE INDEX "Tournament_mode_idx" ON "Tournament"("mode");
CREATE INDEX "Tournament_category_idx" ON "Tournament"("category");
CREATE INDEX "Tournament_type_idx" ON "Tournament"("type");
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");
CREATE INDEX "Tournament_completedAt_idx" ON "Tournament"("completedAt");
CREATE INDEX "Tournament_championPlayerId_idx" ON "Tournament"("championPlayerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Pairing_tournamentId_round_idx" ON "Pairing"("tournamentId", "round");
