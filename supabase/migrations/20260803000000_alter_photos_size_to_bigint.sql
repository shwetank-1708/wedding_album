-- Migration: Alter photos size column to BIGINT to support videos and files larger than 2.14 GB (Integer limit)
ALTER TABLE photos ALTER COLUMN size TYPE bigint USING size::bigint;
