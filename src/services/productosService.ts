import prisma from "../prisma";

interface CreateProductoDTO {
  nombre: string;
  categoriaid: string;
  unidadid: string;
  ingredienteactivo?: string;
  precioref?: number;
}

const createProducto = async (data: CreateProductoDTO) => {
  // 1. Obtener la Categoría para generar el prefijo
  const categoria = await prisma.categoria.findUnique({
    where: { id: data.categoriaid },
    select: { nombre: true }
  });

  if (!categoria) {
    throw new Error("La categoría seleccionada no existe.");
  }

  // 2. Generar Prefijo (Primeras 3 letras en Mayúsculas)
  // Ej: "Fertilizantes" -> "FER"
  const prefijo = categoria.nombre.substring(0, 3).toUpperCase();

  // 3. Obtener el ÚLTIMO NÚMERO usado globalmente
  // Al ser 'codigoalt' un entero (Int), la DB lo busca rapidísimo.
  const agregado = await prisma.producto.aggregate({
    _max: {
      codigoalt: true
    }
  });

// Convertimos explícitamente a Number() para evitar el error de tipos
const ultimoNumero = Number(agregado._max.codigoalt || 0);
  const nuevoNumero = ultimoNumero + 1;

  // 4. Generar el código final
  // Formato: PREFIJO-NUMERO (Ej: FER-276)
  // Nota: No usamos padStart(4, '0') porque en tu DB vi números directos (276, no 0276)
  const nuevoCodigo = `${prefijo}-${nuevoNumero}`;

  // 5. Crear el producto en BD
  const nuevoProducto = await prisma.producto.create({
    data: {
      codigo: nuevoCodigo,     
      codigoalt: nuevoNumero,     
      nombre: data.nombre,
      categoriaid: data.categoriaid,
      unidadid: data.unidadid,
      ingredienteactivo: data.ingredienteactivo || null,
      precioref: data.precioref || null,
      activo: true,
    },
  });

  return nuevoProducto;
};

export default {
  createProducto,
};