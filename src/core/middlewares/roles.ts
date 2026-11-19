import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Middleware de autorización por rol.
 *
 * Debe usarse SIEMPRE después de `authenticateToken`, ya que ese middleware
 * es quien valida el JWT y deja la información fresca del usuario (incluido
 * el rol) en `req.user`.
 *
 * @param roles Lista de roles permitidos (ej: ["ADMIN", "BODEGUERO"]).
 * @returns Middleware que responde 401 si no hay usuario y 403 si el rol no está permitido.
 *
 * @example
 *   router.get('/admin', authenticateToken, requireRole('ADMIN'), handler);
 *   router.get('/bodega', authenticateToken, requireRole('ADMIN', 'BODEGUERO'), handler);
 */
export const requireRole = (...roles: string[]) => {
  const permitidos = new Set(roles);

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const usuario = req.user;

    if (!usuario) {
      return res
        .status(401)
        .json({ message: 'Acceso denegado: usuario no autenticado' });
    }

    if (!permitidos.has(usuario.rol)) {
      return res
        .status(403)
        .json({ message: 'Acceso denegado: no tiene permisos para este recurso' });
    }

    next();
  };
};
