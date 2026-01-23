import prisma from "../prisma";

interface CreateProductoDTO {
  nombre: string;
  categoriaid: string;
  unidadid: string;
  ingredienteactivo?: string; // 👈 Nuevo campo
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
  // Ej: "Fungicidas" -> "FUN"
  const prefijo = categoria.nombre.substring(0, 3).toUpperCase();

  // 3. Buscar el último producto con este prefijo para calcular el correlativo
  // Buscamos algo que empiece con "FUN" y ordenamos descendente
  const ultimoProducto = await prisma.producto.findFirst({
    where: {
      codigo: { startsWith: prefijo }
    },
    orderBy: {
      codigo: 'desc'
    },
    select: { codigo: true }
  });

  // 4. Calcular el siguiente número
  let nuevoNumero = 1;
  
  if (ultimoProducto) {
    // Si el último es "FUN0005", extraemos "0005" -> 5
    const numeroStr = ultimoProducto.codigo.replace(prefijo, "");
    const numeroAnterior = parseInt(numeroStr, 10);
    
    if (!isNaN(numeroAnterior)) {
      nuevoNumero = numeroAnterior + 1;
    }
  }

  // 5. Formatear el nuevo código (Relleno con ceros a 4 dígitos)
  // Ej: 1 -> "0001", 15 -> "0015"
  const numeroFormateado = nuevoNumero.toString().padStart(4, "0");
  const nuevoCodigo = `${prefijo}${numeroFormateado}`; // Ej: FUN0001

  // 6. Crear el producto en BD
  const nuevoProducto = await prisma.producto.create({
    data: {
      codigo: nuevoCodigo,          // Ej: FUN0001
      codigoalt: numeroFormateado,  // Ej: 0001 (Como lo pediste)
      nombre: data.nombre,
      categoriaid: data.categoriaid,
      unidadid: data.unidadid,
      ingredienteactivo: data.ingredienteactivo || null, // 👈 Guardamos el ingrediente
      precioref: data.precioref || null,
      activo: true,
    },
  });

  return nuevoProducto;
};

export default {
  createProducto,
};