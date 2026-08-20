/*
  Warnings:

  - You are about to drop the column `blitzGain` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `bulletGain` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `rapidGain` on the `Team` table. All the data in the column will be lost.
  - You are about to alter the column `totalPoints` on the `Team` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Float`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "captainId" INTEGER,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("captainId", "createdAt", "description", "id", "name", "totalPoints", "updatedAt") SELECT "captainId", "createdAt", "description", "id", "name", "totalPoints", "updatedAt" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");
CREATE UNIQUE INDEX "Team_captainId_key" ON "Team"("captainId");
CREATE INDEX "Team_captainId_idx" ON "Team"("captainId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
