-- Add BILL document category (bills, utility statements, etc.)
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'BILL';
