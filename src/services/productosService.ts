import prisma from "../prisma";

interface CreateProductoDTO {
  nombre: string;
  categoriaid: string;
  unidadid: string;
  ingredienteactivo?: string;
  precioref?: number;
  dosis_200lt?: number;
  comentarioDosis?: string;
}

// Nueva interfaz para actualizar productos. Todos los campos son opcionales.
interface UpdateProductoDTO {
  nombre?: string;
  codigo?: string;
  categoriaid?: string;
  unidadid?: string;
  ingredienteactivo?: string;
  precioref?: number;
  dosis_200lt?: number;
  comentarioDosis?: string;
  activo?: boolean;
}

const createProducto = async (data: CreateProductoDTO) => {
  // 1. Obtener la Categoria para generar el prefijo
  const categoria = await prisma.categoria.findUnique({
    where: { id: data.categoriaid },
    select: { nombre: true }
  });

  if (!categoria) {
    throw new Error("La categoria seleccionada no existe.");
  }

  // 2. Generar Prefijo (Primeras 3 letras en Mayusculas)
  // Ej: "Fertilizantes" -> "FER"
  const prefijo = categoria.nombre.substring(0, 3).toUpperCase();

  // 3. Obtener el ULTIMO NUMERO usado globalmente
  // Al ser 'codigoalt' un entero (Int), la DB lo busca rapidisimo.
  const agregado = await prisma.producto.aggregate({
    _max: {
      codigoalt: true
    }
  });

  // Convertimos explicitamente a Number() para evitar el error de tipos
  const ultimoNumero = Number(agregado._max.codigoalt || 0);
  const nuevoNumero = ultimoNumero + 1;

  // 4. Generar el codigo final
  // Formato: PREFIJO-NUMERO (Ej: FER-276)
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
      dosis_200lt: data.dosis_200lt || null,
      comentarioDosis: data.comentarioDosis || null,
      activo: true,
    },
  });

  return nuevoProducto;
};

const updateProducto = async (id: string, data: UpdateProductoDTO) => {
  // Validacion estricta: si el usuario envio un codigo, verificamos que no exista previamente
  // excluyendo el id del producto que estamos editando en este momento.
  if (data.codigo) {
    const productoExistente = await prisma.producto.findFirst({
      where: {
        codigo: data.codigo,
        NOT: { id: id }
      }
    });

    if (productoExistente) {
      throw new Error(`El codigo ${data.codigo} ya esta en uso por otro producto.`);
    }
  }

  // Actualizamos el producto en la base de datos.
  // Prisma ignorara automaticamente los campos que vengan como undefined.
  const productoActualizado = await prisma.producto.update({
    where: { id },
    data: {
      nombre: data.nombre,
      codigo: data.codigo,
      categoriaid: data.categoriaid,
      unidadid: data.unidadid,
      ingredienteactivo: data.ingredienteactivo,
      precioref: data.precioref,
      dosis_200lt: data.dosis_200lt,
      comentarioDosis: data.comentarioDosis,
      activo: data.activo,
    }
  });

  return productoActualizado;
};

export default {
  createProducto,
  updateProducto,
};