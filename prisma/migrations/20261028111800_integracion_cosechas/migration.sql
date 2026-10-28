-- AlterEnum
BEGIN;
CREATE TYPE "estado_documento_new" AS ENUM ('BORRADOR', 'APROBADO', 'ANULADO');
ALTER TABLE "documento" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "documento" ALTER COLUMN "estado" TYPE "estado_documento_new" USING ("estado"::text::"estado_documento_new");
ALTER TYPE "estado_documento" RENAME TO "estado_documento_old";
ALTER TYPE "estado_documento_new" RENAME TO "estado_documento";
DROP TYPE "estado_documento_old";
ALTER TABLE "documento" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR';
COMMIT;

-- AlterTable
ALTER TABLE "producto" DROP COLUMN "comentarioDosis",
DROP COLUMN "dosis_200lt";

-- DropTable
DROP TABLE "dump_railway_202608250850";

-- CreateTable
CREATE TABLE "boleta_cosecha" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "cosechaid" TEXT NOT NULL,
    "empacadoraid" TEXT NOT NULL,
    "numero_boleta" TEXT,
    "libras" DECIMAL(12,2) NOT NULL,
    "fecha_envio" TIMESTAMP(6) NOT NULL,
    "createdat" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boleta_cosecha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cosecha" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "loteid" TEXT NOT NULL,
    "fecha" TIMESTAMP(6) NOT NULL,
    "libras_campo" DECIMAL(12,2) NOT NULL,
    "libras_rechazo" DECIMAL(12,2),
    "libras_vendidas" DECIMAL(12,2),
    "observaciones" TEXT,
    "creadorid" TEXT NOT NULL,
    "createdat" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cosecha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empacadora" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdat" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empacadora_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empacadora_nombre_key" ON "empacadora"("nombre");

-- AddForeignKey
ALTER TABLE "boleta_cosecha" ADD CONSTRAINT "boleta_cosecha_cosechaid_fkey" FOREIGN KEY ("cosechaid") REFERENCES "cosecha"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "boleta_cosecha" ADD CONSTRAINT "boleta_cosecha_empacadoraid_fkey" FOREIGN KEY ("empacadoraid") REFERENCES "empacadora"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cosecha" ADD CONSTRAINT "cosecha_loteid_fkey" FOREIGN KEY ("loteid") REFERENCES "lote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cosecha" ADD CONSTRAINT "cosecha_creadorid_fkey" FOREIGN KEY ("creadorid") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
