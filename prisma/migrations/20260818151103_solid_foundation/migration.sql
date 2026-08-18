-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "mode" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TOURNAMENT',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "championPlayerId" INTEGER,
    "championUsername" TEXT,
    "championTitle" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tournament_championPlayerId_fkey" FOREIGN KEY ("championPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tournamentId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "accuracy" REAL NOT NULL DEFAULT 0,
    "ratingBefore" INTEGER NOT NULL DEFAULT 0,
    "ratingAfter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TournamentResult_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TournamentResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BulletChampionship" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "championPlayerId" INTEGER,
    "championUsername" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BulletChampionship_championPlayerId_fkey" FOREIGN KEY ("championPlayerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BulletChampionshipPlayer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "championshipId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "rank" INTEGER,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "accuracy" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "BulletChampionshipPlayer_championshipId_fkey" FOREIGN KEY ("championshipId") REFERENCES "BulletChampionship" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BulletChampionshipPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" INTEGER,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "data" TEXT NOT NULL,
    "reason" TEXT,
    "adminId" INTEGER,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalRequest_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" INTEGER,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "category" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "pairingId" INTEGER,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameResult_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameResult_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameResult_pairingId_fkey" FOREIGN KEY ("pairingId") REFERENCES "Pairing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GameResult" ("blackPlayerId", "blackRatingChange", "blackScore", "category", "date", "id", "mode", "pairingId", "round", "whitePlayerId", "whiteRatingChange", "whiteScore") SELECT "blackPlayerId", "blackRatingChange", "blackScore", "category", "date", "id", "mode", "pairingId", "round", "whitePlayerId", "whiteRatingChange", "whiteScore" FROM "GameResult";
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
CREATE TABLE "new_Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fullName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "rapidRating" INTEGER NOT NULL DEFAULT 0,
    "blitzRating" INTEGER NOT NULL DEFAULT 0,
    "bulletRating" INTEGER NOT NULL DEFAULT 0,
    "rapidGain" INTEGER NOT NULL DEFAULT 0,
    "blitzGain" INTEGER NOT NULL DEFAULT 0,
    "bulletGain" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "currentChampionTitle" TEXT,
    "championshipWins" INTEGER NOT NULL DEFAULT 0,
    "teamId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Player" ("bio", "blitzGain", "blitzRating", "bulletGain", "bulletRating", "category", "createdAt", "fullName", "id", "rapidGain", "rapidRating", "status", "teamId", "totalPoints", "totalRounds", "updatedAt", "username") SELECT "bio", "blitzGain", "blitzRating", "bulletGain", "bulletRating", "category", "createdAt", "fullName", "id", "rapidGain", "rapidRating", "status", "teamId", "totalPoints", "totalRounds", "updatedAt", "username" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");
CREATE INDEX "Player_category_idx" ON "Player"("category");
CREATE INDEX "Player_status_idx" ON "Player"("status");
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");
CREATE INDEX "Player_fullName_idx" ON "Player"("fullName");
CREATE TABLE "new_PlayerRanking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "accuracy" REAL NOT NULL DEFAULT 0,
    "tournamentId" INTEGER,
    "month" INTEGER,
    "year" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerRanking_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerRanking_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlayerRanking" ("accuracy", "category", "createdAt", "id", "mode", "month", "playerId", "rank", "totalPoints", "totalRounds", "year") SELECT "accuracy", "category", "createdAt", "id", "mode", "month", "playerId", "rank", "totalPoints", "totalRounds", "year" FROM "PlayerRanking";
DROP TABLE "PlayerRanking";
ALTER TABLE "new_PlayerRanking" RENAME TO "PlayerRanking";
CREATE INDEX "PlayerRanking_playerId_idx" ON "PlayerRanking"("playerId");
CREATE INDEX "PlayerRanking_category_idx" ON "PlayerRanking"("category");
CREATE INDEX "PlayerRanking_mode_idx" ON "PlayerRanking"("mode");
CREATE INDEX "PlayerRanking_rank_idx" ON "PlayerRanking"("rank");
CREATE INDEX "PlayerRanking_tournamentId_idx" ON "PlayerRanking"("tournamentId");
CREATE INDEX "PlayerRanking_year_month_idx" ON "PlayerRanking"("year", "month");
CREATE TABLE "new_Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "captainId" INTEGER,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "rapidGain" INTEGER NOT NULL DEFAULT 0,
    "blitzGain" INTEGER NOT NULL DEFAULT 0,
    "bulletGain" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("blitzGain", "bulletGain", "createdAt", "description", "id", "name", "rapidGain", "totalPoints", "updatedAt") SELECT "blitzGain", "bulletGain", "createdAt", "description", "id", "name", "rapidGain", "totalPoints", "updatedAt" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");
CREATE UNIQUE INDEX "Team_captainId_key" ON "Team"("captainId");
CREATE INDEX "Team_captainId_idx" ON "Team"("captainId");
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
    "tournamentId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamRanking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamRanking_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamRanking" ("category", "createdAt", "id", "mode", "month", "rank", "ratingGain", "teamId", "totalPoints", "year") SELECT "category", "createdAt", "id", "mode", "month", "rank", "ratingGain", "teamId", "totalPoints", "year" FROM "TeamRanking";
DROP TABLE "TeamRanking";
ALTER TABLE "new_TeamRanking" RENAME TO "TeamRanking";
CREATE INDEX "TeamRanking_teamId_idx" ON "TeamRanking"("teamId");
CREATE INDEX "TeamRanking_rank_idx" ON "TeamRanking"("rank");
CREATE INDEX "TeamRanking_category_idx" ON "TeamRanking"("category");
CREATE INDEX "TeamRanking_mode_idx" ON "TeamRanking"("mode");
CREATE INDEX "TeamRanking_tournamentId_idx" ON "TeamRanking"("tournamentId");
CREATE INDEX "TeamRanking_year_month_idx" ON "TeamRanking"("year", "month");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TeamMembership_teamId_idx" ON "TeamMembership"("teamId");

-- CreateIndex
CREATE INDEX "TeamMembership_playerId_idx" ON "TeamMembership"("playerId");

-- CreateIndex
CREATE INDEX "TeamMembership_status_idx" ON "TeamMembership"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_teamId_playerId_key" ON "TeamMembership"("teamId", "playerId");

-- CreateIndex
CREATE INDEX "Tournament_mode_idx" ON "Tournament"("mode");

-- CreateIndex
CREATE INDEX "Tournament_category_idx" ON "Tournament"("category");

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE INDEX "Tournament_completedAt_idx" ON "Tournament"("completedAt");

-- CreateIndex
CREATE INDEX "Tournament_championPlayerId_idx" ON "Tournament"("championPlayerId");

-- CreateIndex
CREATE INDEX "TournamentResult_tournamentId_idx" ON "TournamentResult"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentResult_playerId_idx" ON "TournamentResult"("playerId");

-- CreateIndex
CREATE INDEX "TournamentResult_rank_idx" ON "TournamentResult"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentResult_tournamentId_playerId_key" ON "TournamentResult"("tournamentId", "playerId");

-- CreateIndex
CREATE INDEX "BulletChampionship_status_idx" ON "BulletChampionship"("status");

-- CreateIndex
CREATE INDEX "BulletChampionship_completedAt_idx" ON "BulletChampionship"("completedAt");

-- CreateIndex
CREATE INDEX "BulletChampionship_championPlayerId_idx" ON "BulletChampionship"("championPlayerId");

-- CreateIndex
CREATE INDEX "BulletChampionshipPlayer_championshipId_idx" ON "BulletChampionshipPlayer"("championshipId");

-- CreateIndex
CREATE INDEX "BulletChampionshipPlayer_playerId_idx" ON "BulletChampionshipPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "BulletChampionshipPlayer_championshipId_playerId_key" ON "BulletChampionshipPlayer"("championshipId", "playerId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_playerId_idx" ON "ApprovalRequest"("playerId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_type_idx" ON "ApprovalRequest"("type");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_createdAt_idx" ON "ApprovalRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_playerId_idx" ON "Notification"("playerId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Pairing_mode_idx" ON "Pairing"("mode");

-- CreateIndex
CREATE INDEX "Pairing_whitePlayerId_idx" ON "Pairing"("whitePlayerId");

-- CreateIndex
CREATE INDEX "Pairing_blackPlayerId_idx" ON "Pairing"("blackPlayerId");

-- CreateIndex
CREATE INDEX "TeamPairing_teamAId_idx" ON "TeamPairing"("teamAId");

-- CreateIndex
CREATE INDEX "TeamPairing_teamBId_idx" ON "TeamPairing"("teamBId");
