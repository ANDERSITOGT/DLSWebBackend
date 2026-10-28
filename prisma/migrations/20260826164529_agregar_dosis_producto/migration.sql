/*
  Warnings:

  - The values [ANULADO] on the enum `estado_documento` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "estado_documento_new" AS ENUM ('BORRADOR', 'APROBADO', 'ANULADOp');
ALTER TABLE "documento" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "documento" ALTER COLUMN "estado" TYPE "estado_documento_new" USING ("estado"::text::"estado_documento_new");
ALTER TYPE "estado_documento" RENAME TO "estado_documento_old";
ALTER TYPE "estado_documento_new" RENAME TO "estado_documento";
DROP TYPE "estado_documento_old";
ALTER TABLE "documento" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR';
COMMIT;

-- AlterTable
ALTER TABLE "producto" ADD COLUMN     "comentarioDosis" TEXT,
ADD COLUMN     "dosis_200lt" DECIMAL(12,2);
