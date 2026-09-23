-- ============================================================================
-- Migration: 003_add_myntra_ajio_westside.sql
-- Purpose: Add Myntra, Ajio, and Westside support to platform_type enum
-- ============================================================================

-- Add new platform enum values safely
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'myntra';
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'ajio';
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'westside';
