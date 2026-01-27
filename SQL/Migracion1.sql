-- 1. Cambiar el tipo de dato de Texto a Entero
ALTER TABLE "producto" 
ALTER COLUMN "codigoalt" TYPE INTEGER 
USING "codigoalt"::integer;

-- 2. (Opcional pero recomendado) Agregar la restricción de que sea Único
-- Esto evitará que tengas dos productos con el número 276 por error.
ALTER TABLE "producto" 
ADD CONSTRAINT "producto_codigoalt_key" UNIQUE ("codigoalt");

select* from producto p 