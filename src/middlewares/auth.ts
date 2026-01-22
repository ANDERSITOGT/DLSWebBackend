import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma'; // 👈 Necesitamos importar Prisma aquí

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  // 1. Buscamos el token en la cabecera
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado: Token no proporcionado' });
  }

  const secret = process.env.JWT_SECRET || "secreto_por_defecto"; 

  // 2. Verificamos la firma del token
  jwt.verify(token, secret, async (err: any, decoded: any) => {
    if (err) {
      // Si el token expiró (pasaron los 15 días) o es falso
      return res.status(403).json({ message: 'Token inválido o expirado' });
    }

    try {
        // 3. DOBLE VERIFICACIÓN (KILL SWITCH) 🛡️
        // Buscamos al usuario en la BD para ver si sigue activo
        const usuarioActual = await prisma.usuario.findUnique({
            where: { id: decoded.id },
            select: { id: true, rol: true, activo: true, email: true, nombre: true } // Solo traemos lo necesario
        });

        // Si el usuario fue borrado O está marcado como inactivo (false)
        if (!usuarioActual || !usuarioActual.activo) {
            return res.status(403).json({ message: 'Su cuenta ha sido desactivada. Acceso revocado.' });
        }

        // 4. Todo correcto: Actualizamos la info del usuario en la petición
        // Esto es genial porque 'req.user' siempre tendrá la info más fresca de la BD
        (req as AuthRequest).user = usuarioActual;
        
        next();

    } catch (dbError) {
        console.error("Error verificando usuario en middleware:", dbError);
        return res.status(500).json({ message: 'Error interno de autenticación' });
    }
  });
};