-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "PlayerGroup" AS ENUM ('MEN', 'WOMEN', 'MIX', 'JUNIORS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "bankIban" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "prepaidSeason" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyPaymentMark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyPaymentMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGroupMembership" (
    "playerId" TEXT NOT NULL,
    "group" "PlayerGroup" NOT NULL,

    CONSTRAINT "PlayerGroupMembership_pkey" PRIMARY KEY ("playerId","group")
);

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "defaultPriceCents" INTEGER,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "totalAmountCents" INTEGER NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedPaymentParticipant" (
    "id" TEXT NOT NULL,
    "sharedPaymentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "SharedPaymentParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Player_userId_idx" ON "Player"("userId");

-- CreateIndex
CREATE INDEX "MonthlyPaymentMark_userId_year_month_idx" ON "MonthlyPaymentMark"("userId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPaymentMark_userId_playerId_year_month_key" ON "MonthlyPaymentMark"("userId", "playerId", "year", "month");

-- CreateIndex
CREATE INDEX "Training_userId_startsAt_idx" ON "Training"("userId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_trainingId_playerId_key" ON "Attendance"("trainingId", "playerId");

-- CreateIndex
CREATE INDEX "SharedPayment_userId_archived_idx" ON "SharedPayment"("userId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "SharedPaymentParticipant_sharedPaymentId_playerId_key" ON "SharedPaymentParticipant"("sharedPaymentId", "playerId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyPaymentMark" ADD CONSTRAINT "MonthlyPaymentMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyPaymentMark" ADD CONSTRAINT "MonthlyPaymentMark_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGroupMembership" ADD CONSTRAINT "PlayerGroupMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedPayment" ADD CONSTRAINT "SharedPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedPaymentParticipant" ADD CONSTRAINT "SharedPaymentParticipant_sharedPaymentId_fkey" FOREIGN KEY ("sharedPaymentId") REFERENCES "SharedPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedPaymentParticipant" ADD CONSTRAINT "SharedPaymentParticipant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
