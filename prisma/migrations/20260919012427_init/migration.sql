-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('UNREGISTERED', 'ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('RAPID', 'BLITZ', 'BULLET');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('REGISTRATION', 'BIO_CHANGE', 'USERNAME_CHANGE', 'PROFILE_CHANGE', 'RATING_CHANGE', 'PASSWORD_CHANGE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ANNOUNCEMENT', 'APPROVAL', 'REJECTION', 'PAIRING', 'RESULT', 'RANKING', 'SYSTEM', 'CHAMPIONSHIP');

-- CreateEnum
CREATE TYPE "TournamentType" AS ENUM ('CATEGORY', 'SPECIAL', 'TEAM');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('SWISS', 'ROUND_ROBIN', 'TEAM_BOARD');

-- CreateEnum
CREATE TYPE "TeamPairingMode" AS ENUM ('RAPID', 'BLITZ', 'BULLET');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" "PlayerStatus" NOT NULL DEFAULT 'UNREGISTERED',
    "category" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "rapidRating" INTEGER NOT NULL DEFAULT 0,
    "blitzRating" INTEGER NOT NULL DEFAULT 0,
    "bulletRating" INTEGER NOT NULL DEFAULT 0,
    "rapidGain" INTEGER NOT NULL DEFAULT 0,
    "blitzGain" INTEGER NOT NULL DEFAULT 0,
    "bulletGain" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalLosses" INTEGER NOT NULL DEFAULT 0,
    "totalDraws" INTEGER NOT NULL DEFAULT 0,
    "tournamentWins" INTEGER NOT NULL DEFAULT 0,
    "teamBoardPosition" INTEGER,
    "teamId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "captainId" INTEGER,
    "totalPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "boardPosition" INTEGER,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pairing" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "mode" "GameMode" NOT NULL,
    "tournamentId" INTEGER,
    "whitePlayerId" INTEGER NOT NULL,
    "blackPlayerId" INTEGER NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamPairing" (
    "id" SERIAL NOT NULL,
    "round" INTEGER NOT NULL,
    "tournamentId" INTEGER,
    "teamAId" INTEGER NOT NULL,
    "teamBId" INTEGER NOT NULL,
    "mode" "TeamPairingMode" NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamPairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamGame" (
    "id" SERIAL NOT NULL,
    "teamPairingId" INTEGER NOT NULL,
    "boardPosition" INTEGER NOT NULL,
    "whitePlayerId" INTEGER NOT NULL,
    "blackPlayerId" INTEGER NOT NULL,
    "result" DOUBLE PRECISION,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedByAdminId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "playerStatisticsApplied" BOOLEAN NOT NULL DEFAULT false,
    "teamStatisticsApplied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TeamGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "id" SERIAL NOT NULL,
    "round" INTEGER NOT NULL,
    "mode" "GameMode" NOT NULL,
    "whitePlayerId" INTEGER NOT NULL,
    "blackPlayerId" INTEGER NOT NULL,
    "whiteScore" DOUBLE PRECISION NOT NULL,
    "blackScore" DOUBLE PRECISION NOT NULL,
    "whiteRatingChange" INTEGER,
    "blackRatingChange" INTEGER,
    "submittedByPlayerId" INTEGER,
    "category" TEXT NOT NULL,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedByAdminId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "playerStatisticsApplied" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "pairingId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingGain" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "pairingId" INTEGER,
    "teamGameId" INTEGER,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedByAdminId" INTEGER,
    "appliedAt" TIMESTAMP(3),
    "tournamentId" INTEGER,
    "mode" "GameMode" NOT NULL,
    "amount" INTEGER NOT NULL,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingGain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerRanking" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "mode" "GameMode" NOT NULL,
    "rank" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "tieBreaker" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tournamentId" INTEGER,
    "month" INTEGER,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRanking" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "category" TEXT,
    "mode" "GameMode",
    "rank" INTEGER NOT NULL,
    "totalPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRating" INTEGER NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "tieBreaker" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "month" INTEGER,
    "year" INTEGER,
    "tournamentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "mode" "GameMode" NOT NULL,
    "type" "TournamentType" NOT NULL DEFAULT 'CATEGORY',
    "format" "TournamentFormat" NOT NULL DEFAULT 'SWISS',
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "totalRounds" INTEGER NOT NULL DEFAULT 1,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "roundDurationMinutes" INTEGER NOT NULL DEFAULT 0,
    "championPlayerId" INTEGER,
    "championUsername" TEXT,
    "championTitle" TEXT,
    "statisticsApplied" BOOLEAN NOT NULL DEFAULT false,
    "statisticsAppliedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPlayer" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentResult" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "tieBreaker" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingBefore" INTEGER NOT NULL DEFAULT 0,
    "ratingAfter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER,
    "type" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "data" TEXT NOT NULL,
    "reason" TEXT,
    "adminId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "status" "AdminStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLoginLog" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "successful" BOOLEAN NOT NULL DEFAULT false,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedIP" (
    "id" SERIAL NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT true,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblockedAt" TIMESTAMP(3),

    CONSTRAINT "BlockedIP_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Player_fullName_idx" ON "Player"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_captainId_key" ON "Team"("captainId");

-- CreateIndex
CREATE INDEX "Team_captainId_idx" ON "Team"("captainId");

-- CreateIndex
CREATE INDEX "TeamMembership_teamId_idx" ON "TeamMembership"("teamId");

-- CreateIndex
CREATE INDEX "TeamMembership_playerId_idx" ON "TeamMembership"("playerId");

-- CreateIndex
CREATE INDEX "TeamMembership_status_idx" ON "TeamMembership"("status");

-- CreateIndex
CREATE INDEX "TeamMembership_teamId_boardPosition_idx" ON "TeamMembership"("teamId", "boardPosition");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_teamId_playerId_key" ON "TeamMembership"("teamId", "playerId");

-- CreateIndex
CREATE INDEX "Pairing_category_idx" ON "Pairing"("category");

-- CreateIndex
CREATE INDEX "Pairing_round_idx" ON "Pairing"("round");

-- CreateIndex
CREATE INDEX "Pairing_mode_idx" ON "Pairing"("mode");

-- CreateIndex
CREATE INDEX "Pairing_availableAt_idx" ON "Pairing"("availableAt");

-- CreateIndex
CREATE INDEX "Pairing_whitePlayerId_idx" ON "Pairing"("whitePlayerId");

-- CreateIndex
CREATE INDEX "Pairing_blackPlayerId_idx" ON "Pairing"("blackPlayerId");

-- CreateIndex
CREATE INDEX "Pairing_tournamentId_idx" ON "Pairing"("tournamentId");

-- CreateIndex
CREATE INDEX "Pairing_tournamentId_round_idx" ON "Pairing"("tournamentId", "round");

-- CreateIndex
CREATE INDEX "TeamPairing_round_idx" ON "TeamPairing"("round");

-- CreateIndex
CREATE INDEX "TeamPairing_teamAId_idx" ON "TeamPairing"("teamAId");

-- CreateIndex
CREATE INDEX "TeamPairing_teamBId_idx" ON "TeamPairing"("teamBId");

-- CreateIndex
CREATE INDEX "TeamPairing_mode_idx" ON "TeamPairing"("mode");

-- CreateIndex
CREATE INDEX "TeamPairing_tournamentId_idx" ON "TeamPairing"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamPairing_round_teamAId_teamBId_mode_key" ON "TeamPairing"("round", "teamAId", "teamBId", "mode");

-- CreateIndex
CREATE INDEX "TeamGame_teamPairingId_idx" ON "TeamGame"("teamPairingId");

-- CreateIndex
CREATE INDEX "TeamGame_whitePlayerId_idx" ON "TeamGame"("whitePlayerId");

-- CreateIndex
CREATE INDEX "TeamGame_blackPlayerId_idx" ON "TeamGame"("blackPlayerId");

-- CreateIndex
CREATE INDEX "TeamGame_approvalStatus_idx" ON "TeamGame"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "TeamGame_teamPairingId_boardPosition_key" ON "TeamGame"("teamPairingId", "boardPosition");

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
CREATE INDEX "GameResult_approvalStatus_idx" ON "GameResult"("approvalStatus");

-- CreateIndex
CREATE INDEX "GameResult_whitePlayerId_idx" ON "GameResult"("whitePlayerId");

-- CreateIndex
CREATE INDEX "GameResult_blackPlayerId_idx" ON "GameResult"("blackPlayerId");

-- CreateIndex
CREATE INDEX "RatingGain_playerId_idx" ON "RatingGain"("playerId");

-- CreateIndex
CREATE INDEX "RatingGain_pairingId_idx" ON "RatingGain"("pairingId");

-- CreateIndex
CREATE INDEX "RatingGain_teamGameId_idx" ON "RatingGain"("teamGameId");

-- CreateIndex
CREATE INDEX "RatingGain_mode_idx" ON "RatingGain"("mode");

-- CreateIndex
CREATE INDEX "RatingGain_createdAt_idx" ON "RatingGain"("createdAt");

-- CreateIndex
CREATE INDEX "PlayerRanking_playerId_idx" ON "PlayerRanking"("playerId");

-- CreateIndex
CREATE INDEX "PlayerRanking_category_idx" ON "PlayerRanking"("category");

-- CreateIndex
CREATE INDEX "PlayerRanking_mode_idx" ON "PlayerRanking"("mode");

-- CreateIndex
CREATE INDEX "PlayerRanking_rank_idx" ON "PlayerRanking"("rank");

-- CreateIndex
CREATE INDEX "PlayerRanking_tournamentId_idx" ON "PlayerRanking"("tournamentId");

-- CreateIndex
CREATE INDEX "PlayerRanking_year_month_idx" ON "PlayerRanking"("year", "month");

-- CreateIndex
CREATE INDEX "TeamRanking_teamId_idx" ON "TeamRanking"("teamId");

-- CreateIndex
CREATE INDEX "TeamRanking_rank_idx" ON "TeamRanking"("rank");

-- CreateIndex
CREATE INDEX "TeamRanking_category_idx" ON "TeamRanking"("category");

-- CreateIndex
CREATE INDEX "TeamRanking_tournamentId_idx" ON "TeamRanking"("tournamentId");

-- CreateIndex
CREATE INDEX "TeamRanking_year_month_idx" ON "TeamRanking"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "TeamRanking_tournamentId_teamId_key" ON "TeamRanking"("tournamentId", "teamId");

-- CreateIndex
CREATE INDEX "Tournament_mode_idx" ON "Tournament"("mode");

-- CreateIndex
CREATE INDEX "Tournament_category_idx" ON "Tournament"("category");

-- CreateIndex
CREATE INDEX "Tournament_type_idx" ON "Tournament"("type");

-- CreateIndex
CREATE INDEX "Tournament_status_idx" ON "Tournament"("status");

-- CreateIndex
CREATE INDEX "Tournament_completedAt_idx" ON "Tournament"("completedAt");

-- CreateIndex
CREATE INDEX "Tournament_championPlayerId_idx" ON "Tournament"("championPlayerId");

-- CreateIndex
CREATE INDEX "TournamentPlayer_tournamentId_idx" ON "TournamentPlayer"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentPlayer_playerId_idx" ON "TournamentPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentPlayer_tournamentId_playerId_key" ON "TournamentPlayer"("tournamentId", "playerId");

-- CreateIndex
CREATE INDEX "TournamentResult_tournamentId_idx" ON "TournamentResult"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentResult_playerId_idx" ON "TournamentResult"("playerId");

-- CreateIndex
CREATE INDEX "TournamentResult_rank_idx" ON "TournamentResult"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentResult_tournamentId_playerId_key" ON "TournamentResult"("tournamentId", "playerId");

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
CREATE INDEX "Announcement_isActive_idx" ON "Announcement"("isActive");

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

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pairing" ADD CONSTRAINT "Pairing_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pairing" ADD CONSTRAINT "Pairing_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pairing" ADD CONSTRAINT "Pairing_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPairing" ADD CONSTRAINT "TeamPairing_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPairing" ADD CONSTRAINT "TeamPairing_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamPairing" ADD CONSTRAINT "TeamPairing_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGame" ADD CONSTRAINT "TeamGame_teamPairingId_fkey" FOREIGN KEY ("teamPairingId") REFERENCES "TeamPairing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGame" ADD CONSTRAINT "TeamGame_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamGame" ADD CONSTRAINT "TeamGame_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_pairingId_fkey" FOREIGN KEY ("pairingId") REFERENCES "Pairing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingGain" ADD CONSTRAINT "RatingGain_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingGain" ADD CONSTRAINT "RatingGain_pairingId_fkey" FOREIGN KEY ("pairingId") REFERENCES "Pairing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingGain" ADD CONSTRAINT "RatingGain_teamGameId_fkey" FOREIGN KEY ("teamGameId") REFERENCES "TeamGame"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRanking" ADD CONSTRAINT "PlayerRanking_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRanking" ADD CONSTRAINT "PlayerRanking_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRanking" ADD CONSTRAINT "TeamRanking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRanking" ADD CONSTRAINT "TeamRanking_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_championPlayerId_fkey" FOREIGN KEY ("championPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPlayer" ADD CONSTRAINT "TournamentPlayer_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPlayer" ADD CONSTRAINT "TournamentPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentResult" ADD CONSTRAINT "TournamentResult_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentResult" ADD CONSTRAINT "TournamentResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminLoginLog" ADD CONSTRAINT "AdminLoginLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
