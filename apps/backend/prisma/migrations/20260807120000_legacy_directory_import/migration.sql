ALTER TABLE "User" ALTER COLUMN "lastName" DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Profile") THEN
    RAISE EXCEPTION 'The legacy directory migration requires an empty Profile table';
  END IF;
END $$;

ALTER TABLE "Profile" ALTER COLUMN "branch" TYPE TEXT USING "branch"::TEXT;
DROP TYPE "Branch";
CREATE TYPE "Branch" AS ENUM (
  'Biotechnology',
  'COE (Computer Engineering)',
  'Civil Engineering',
  'Computer Science Engineering',
  'Computer Science Engineering (Artificial Intelligence)',
  'Computer Science Engineering (Big Data Analytics)',
  'Computer Science Engineering (Data Science)',
  'Computer Science Engineering (IoT)',
  'Electrical Engineering',
  'Electronics Engineering (VLSI Desgin)',
  'Electronics and Communication Engineering',
  'Electronics and Communication Engineering (ECAM)',
  'Geoinformatics (GI)',
  'Information Technology',
  'Information Technology (Network Secuirty)',
  'Instrumentation and Control Engineering',
  'MPAE (Manufacturing Processes and Automation Engineering)',
  'Mathematics and Computing (MAC)',
  'Mechanical Engineering',
  'Mechanical Engineering (MEEV)'
);
ALTER TABLE "Profile" ALTER COLUMN "branch" TYPE "Branch" USING "branch"::"Branch";
