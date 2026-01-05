import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extendemos la interfaz de Request para que TypeScript sepa que 'user' existe
export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  // 1. Buscamos el token en la cabecera "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // 2. Si no hay token, prohibido pasar (401)
  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado: Token no proporcionado' });
  }

  // 3. Verificamos si el token es real
  // IMPORTANTE: Asegúrate que este 'secret' sea el mismo que usaste en tu Login
  const secret = process.env.JWT_SECRET || "secreto_super_seguro"; 

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido o expirado' });
    }
    
    // 4. Si todo bien, guardamos los datos del usuario en la petición y dejamos pasar
    (req as AuthRequest).user = user;
    next();
  });
};