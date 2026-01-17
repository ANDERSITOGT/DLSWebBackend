/*
  Warnings:

  - You are about to drop the `Producto` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "estado_documento" AS ENUM ('BORRADOR', 'APROBADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "estado_lote" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "estado_solicitud" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'ENTREGADA');

-- CreateEnum
CREATE TYPE "rol" AS ENUM ('ADMIN', 'BODEGUERO', 'SOLICITANTE', 'VISOR');

-- CreateEnum
CREATE TYPE "tipo_documento" AS ENUM ('INGRESO', 'SALIDA', 'TRANSFERENCIA', 'AJUSTE', 'DEVOLUCION', 'SOLICITUD');

-- DropTable
DROP TABLE "Producto";

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "usuarioid" TEXT,
    "entidad" TEXT NOT NULL,
    "entidadid" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "payload" JSONB,
    "fecha" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "useragent" TEXT,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bodega" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bodega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobante_fiscal" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "documentoid" TEXT NOT NULL,
    "tipocomprobante" TEXT NOT NULL,
    "nitemisor" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "serie" TEXT,
    "uuid" TEXT,
    "fechaemision" TIMESTAMP(6) NOT NULL,
    "notas" TEXT,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobante_fiscal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consecutivo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "tipo" "tipo_documento" NOT NULL,
    "anio" INTEGER NOT NULL,
    "prefijo" TEXT,
    "ultimo" INTEGER DEFAULT 0,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consecutivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cultivo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "variedad" TEXT,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cultivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "tipo" "tipo_documento" NOT NULL,
    "estado" "estado_documento" DEFAULT 'BORRADOR',
    "fecha" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "proveedorid" TEXT,
    "bodegaorigenid" TEXT,
    "bodegadestinoid" TEXT,
    "solicitanteid" TEXT,
    "creadorid" TEXT NOT NULL,
    "consecutivo" TEXT,
    "observacion" TEXT,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_item" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "documentoid" TEXT NOT NULL,
    "productoid" TEXT NOT NULL,
    "unidadid" TEXT NOT NULL,
    "ubicacionid" TEXT,
    "loteid" TEXT,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "costounit" DECIMAL(12,4),
    "precioref" DECIMAL(12,2),
    "notas" TEXT,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finca" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "ubicacion" TEXT,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "fincaid" TEXT NOT NULL,
    "cultivoid" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "areamanzanas" DECIMAL(10,4),
    "areametroslineales" DECIMAL(12,2),
    "areahectareas" DECIMAL(10,4),
    "fechasiembra" TIMESTAMP(6),
    "fechacierre" TIMESTAMP(6),
    "estado" "estado_lote" DEFAULT 'ABIERTO',
    "descripcion" TEXT,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "codigo" TEXT NOT NULL,
    "codigoalt" TEXT,
    "nombre" TEXT NOT NULL,
    "ingredienteactivo" TEXT,
    "categoriaid" TEXT NOT NULL,
    "unidadid" TEXT NOT NULL,
    "activo" BOOLEAN DEFAULT true,
    "precioref" DECIMAL(12,2),
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "notas" TEXT,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor_contacto" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "proveedorid" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "puesto" TEXT,
    "notas" TEXT,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedor_contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "fecha" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "estado" "estado_solicitud" DEFAULT 'PENDIENTE',
    "solicitanteid" TEXT NOT NULL,
    "bodegaid" TEXT,
    "aprobadorid" TEXT,
    "documentosalidaid" TEXT,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_item" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "solicitudid" TEXT NOT NULL,
    "productoid" TEXT NOT NULL,
    "unidadid" TEXT NOT NULL,
    "loteid" TEXT,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "notas" TEXT,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicacion" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "bodegaid" TEXT NOT NULL,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ubicacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidad" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "abreviatura" TEXT NOT NULL,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password" TEXT NOT NULL DEFAULT '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm',
    "rol" "rol" DEFAULT 'VISOR',
    "activo" BOOLEAN DEFAULT true,
    "createdat" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bodega_nombre_key" ON "bodega"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_nombre_key" ON "categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "comprobante_fiscal_documentoid_key" ON "comprobante_fiscal"("documentoid");

-- CreateIndex
CREATE UNIQUE INDEX "consecutivo_tipo_anio_key" ON "consecutivo"("tipo", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "cultivo_nombre_variedad_key" ON "cultivo"("nombre", "variedad");

-- CreateIndex
CREATE INDEX "idx_documento_tipo_fecha" ON "documento"("tipo", "fecha");

-- CreateIndex
CREATE INDEX "idx_documento_item_lote" ON "documento_item"("loteid");

-- CreateIndex
CREATE INDEX "idx_documento_item_producto" ON "documento_item"("productoid");

-- CreateIndex
CREATE UNIQUE INDEX "finca_nombre_key" ON "finca"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "lote_fincaid_codigo_key" ON "lote"("fincaid", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "producto_codigo_key" ON "producto"("codigo");

-- CreateIndex
CREATE INDEX "idx_producto_nombre" ON "producto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "proveedor_nombre_key" ON "proveedor"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_documentosalidaid_key" ON "solicitud"("documentosalidaid");

-- CreateIndex
CREATE UNIQUE INDEX "ubicacion_bodegaid_codigo_key" ON "ubicacion"("bodegaid", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "unidad_abreviatura_key" ON "unidad"("abreviatura");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuarioid_fkey" FOREIGN KEY ("usuarioid") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "comprobante_fiscal" ADD CONSTRAINT "comprobante_fiscal_documentoid_fkey" FOREIGN KEY ("documentoid") REFERENCES "documento"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_bodegadestinoid_fkey" FOREIGN KEY ("bodegadestinoid") REFERENCES "bodega"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_bodegaorigenid_fkey" FOREIGN KEY ("bodegaorigenid") REFERENCES "bodega"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_creadorid_fkey" FOREIGN KEY ("creadorid") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_proveedorid_fkey" FOREIGN KEY ("proveedorid") REFERENCES "proveedor"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_solicitanteid_fkey" FOREIGN KEY ("solicitanteid") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento_item" ADD CONSTRAINT "documento_item_documentoid_fkey" FOREIGN KEY ("documentoid") REFERENCES "documento"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento_item" ADD CONSTRAINT "documento_item_loteid_fkey" FOREIGN KEY ("loteid") REFERENCES "lote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento_item" ADD CONSTRAINT "documento_item_productoid_fkey" FOREIGN KEY ("productoid") REFERENCES "producto"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento_item" ADD CONSTRAINT "documento_item_ubicacionid_fkey" FOREIGN KEY ("ubicacionid") REFERENCES "ubicacion"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento_item" ADD CONSTRAINT "documento_item_unidadid_fkey" FOREIGN KEY ("unidadid") REFERENCES "unidad"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_cultivoid_fkey" FOREIGN KEY ("cultivoid") REFERENCES "cultivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_fincaid_fkey" FOREIGN KEY ("fincaid") REFERENCES "finca"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoriaid_fkey" FOREIGN KEY ("categoriaid") REFERENCES "categoria"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_unidadid_fkey" FOREIGN KEY ("unidadid") REFERENCES "unidad"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proveedor_contacto" ADD CONSTRAINT "proveedor_contacto_proveedorid_fkey" FOREIGN KEY ("proveedorid") REFERENCES "proveedor"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_aprobadorid_fkey" FOREIGN KEY ("aprobadorid") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_bodegaid_fkey" FOREIGN KEY ("bodegaid") REFERENCES "bodega"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_documentosalidaid_fkey" FOREIGN KEY ("documentosalidaid") REFERENCES "documento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_solicitanteid_fkey" FOREIGN KEY ("solicitanteid") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud_item" ADD CONSTRAINT "solicitud_item_loteid_fkey" FOREIGN KEY ("loteid") REFERENCES "lote"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud_item" ADD CONSTRAINT "solicitud_item_productoid_fkey" FOREIGN KEY ("productoid") REFERENCES "producto"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud_item" ADD CONSTRAINT "solicitud_item_solicitudid_fkey" FOREIGN KEY ("solicitudid") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud_item" ADD CONSTRAINT "solicitud_item_unidadid_fkey" FOREIGN KEY ("unidadid") REFERENCES "unidad"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ubicacion" ADD CONSTRAINT "ubicacion_bodegaid_fkey" FOREIGN KEY ("bodegaid") REFERENCES "bodega"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
