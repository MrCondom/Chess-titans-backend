-- CreateTable
CREATE TABLE "Player" (
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
    "category" TEXT NOT NULL DEFAULT 'unavailable',
    "bio" TEXT NOT NULL DEFAULT '',
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamId" INTEGER,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "rapidGain" INTEGER NOT NULL DEFAULT 0,
    "blitzGain" INTEGER NOT NULL DEFAULT 0,
    "bulletGain" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Pairing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "whitePlayerId" INTEGER NOT NULL,
    "blackPlayerId" INTEGER NOT NULL,
    "availableAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pairing_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pairing_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamPairing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "round" INTEGER NOT NULL,
    "teamAId" INTEGER NOT NULL,
    "teamBId" INTEGER NOT NULL,
    "availableAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamPairing_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamPairing_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameResult" (
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
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pairingId" INTEGER,
    CONSTRAINT "GameResult_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameResult_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameResult_pairingId_fkey" FOREIGN KEY ("pairingId") REFERENCES "Pairing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerRanking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "accuracy" REAL NOT NULL DEFAULT 0,
    "month" INTEGER,
    "year" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerRanking_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamRanking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamId" INTEGER NOT NULL,
    "category" TEXT,
    "mode" TEXT,
    "rank" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "ratingGain" INTEGER NOT NULL DEFAULT 0,
    "month" INTEGER,
    "year" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamRanking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RatingGain" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "playerId" INTEGER NOT NULL,
    "pairingId" INTEGER,
    "mode" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingGain_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatingGain_pairingId_fkey" FOREIGN KEY ("pairingId") REFERENCES "Pairing" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminLoginLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "adminId" INTEGER NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "successful" BOOLEAN NOT NULL DEFAULT false,
    "loginAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminLoginLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlockedIP" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ipAddress" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT true,
    "blockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblockedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");

-- CreateIndex
CREATE INDEX "Player_category_idx" ON "Player"("category");

-- CreateIndex
CREATE INDEX "Player_status_idx" ON "Player"("status");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_name_idx" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Pairing_category_idx" ON "Pairing"("category");

-- CreateIndex
CREATE INDEX "Pairing_round_idx" ON "Pairing"("round");

-- CreateIndex
CREATE INDEX "Pairing_availableAt_idx" ON "Pairing"("availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pairing_category_round_whitePlayerId_blackPlayerId_key" ON "Pairing"("category", "round", "whitePlayerId", "blackPlayerId");

-- CreateIndex
CREATE INDEX "TeamPairing_round_idx" ON "TeamPairing"("round");

-- CreateIndex
CREATE INDEX "TeamPairing_availableAt_idx" ON "TeamPairing"("availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamPairing_round_teamAId_teamBId_key" ON "TeamPairing"("round", "teamAId", "teamBId");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_pairingId_key" ON "GameResult"("pairingId");

-- CreateIndex
CREATE INDEX "GameResult_round_idx" ON "GameResult"("round");

-- CreateIndex
CREATE INDEX "GameResult_mode_idx" ON "GameResult"("mode");

-- CreateIndex
CREATE INDEX "GameResult_category_idx" ON "GameResult"("category");

-- CreateIndex
CREATE INDEX "GameResult_date_idx" ON "GameResult"("date");

-- CreateIndex
CREATE INDEX "PlayerRanking_category_idx" ON "PlayerRanking"("category");

-- CreateIndex
CREATE INDEX "PlayerRanking_mode_idx" ON "PlayerRanking"("mode");

-- CreateIndex
CREATE INDEX "PlayerRanking_rank_idx" ON "PlayerRanking"("rank");

-- CreateIndex
CREATE INDEX "PlayerRanking_year_month_idx" ON "PlayerRanking"("year", "month");

-- CreateIndex
CREATE INDEX "TeamRanking_rank_idx" ON "TeamRanking"("rank");

-- CreateIndex
CREATE INDEX "TeamRanking_category_idx" ON "TeamRanking"("category");

-- CreateIndex
CREATE INDEX "TeamRanking_mode_idx" ON "TeamRanking"("mode");

-- CreateIndex
CREATE INDEX "TeamRanking_year_month_idx" ON "TeamRanking"("year", "month");

-- CreateIndex
CREATE INDEX "RatingGain_playerId_idx" ON "RatingGain"("playerId");

-- CreateIndex
CREATE INDEX "RatingGain_pairingId_idx" ON "RatingGain"("pairingId");

-- CreateIndex
CREATE INDEX "RatingGain_mode_idx" ON "RatingGain"("mode");

-- CreateIndex
CREATE INDEX "RatingGain_createdAt_idx" ON "RatingGain"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE INDEX "Admin_ipAddress_idx" ON "Admin"("ipAddress");

-- CreateIndex
CREATE INDEX "AdminLoginLog_adminId_idx" ON "AdminLoginLog"("adminId");

-- CreateIndex
CREATE INDEX "AdminLoginLog_ipAddress_idx" ON "AdminLoginLog"("ipAddress");

-- CreateIndex
CREATE INDEX "AdminLoginLog_loginAt_idx" ON "AdminLoginLog"("loginAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedIP_ipAddress_key" ON "BlockedIP"("ipAddress");

-- CreateIndex
CREATE INDEX "BlockedIP_isBlocked_idx" ON "BlockedIP"("isBlocked");

-- CreateIndex
CREATE INDEX "Announcement_isActive_idx" ON "Announcement"("isActive");
