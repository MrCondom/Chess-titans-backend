/*
  Warnings:

  - You are about to drop the column `tournamentId` on the `TeamPairing` table. All the data in the column will be lost.
  - Added the required column `mode` to the `TeamPairing` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TeamPairing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "round" INTEGER NOT NULL,
    "teamAId" INTEGER NOT NULL,
    "teamBId" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "availableAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamPairing_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamPairing_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamPairing" ("availableAt", "createdAt", "id", "round", "teamAId", "teamBId") SELECT "availableAt", "createdAt", "id", "round", "teamAId", "teamBId" FROM "TeamPairing";
DROP TABLE "TeamPairing";
ALTER TABLE "new_TeamPairing" RENAME TO "TeamPairing";
CREATE INDEX "TeamPairing_round_idx" ON "TeamPairing"("round");
CREATE INDEX "TeamPairing_teamAId_idx" ON "TeamPairing"("teamAId");
CREATE INDEX "TeamPairing_teamBId_idx" ON "TeamPairing"("teamBId");
CREATE INDEX "TeamPairing_mode_idx" ON "TeamPairing"("mode");
CREATE INDEX "TeamPairing_availableAt_idx" ON "TeamPairing"("availableAt");
CREATE UNIQUE INDEX "TeamPairing_round_teamAId_teamBId_mode_key" ON "TeamPairing"("round", "teamAId", "teamBId", "mode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
