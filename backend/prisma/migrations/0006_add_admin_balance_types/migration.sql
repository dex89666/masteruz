-- AlterEnum: Add ADMIN_TOPUP and ADMIN_WITHDRAW to BalanceTransactionType
ALTER TYPE "BalanceTransactionType" ADD VALUE IF NOT EXISTS 'ADMIN_TOPUP';
ALTER TYPE "BalanceTransactionType" ADD VALUE IF NOT EXISTS 'ADMIN_WITHDRAW';
