import { useEffect, useRef } from 'react';

// =============================================================================
// Botón atrás de Android para pantallas que se abren encima (chat, paneles).
// Cada pantalla abierta registra cómo cerrarse; App.jsx llama primero a la última
// registrada y, si no hay ninguna, usa la navegación normal entre pestañas.
// =============================================================================

const pila = [];

/**
 * Cierra la pantalla abierta más reciente. Devuelve true si había alguna.
 */
export function manejarAtras() {
  const ultimo = pila[pila.length - 1];
  if (!ultimo) return false;
  ultimo.current();
  return true;
}

/**
 * Mientras `activo` sea true, el botón atrás ejecuta `alCerrar`.
 */
export function useAtras(activo, alCerrar) {
  const ref = useRef(alCerrar);
  ref.current = alCerrar;

  useEffect(() => {
    if (!activo) return undefined;
    pila.push(ref);
    return () => {
      const i = pila.lastIndexOf(ref);
      if (i >= 0) pila.splice(i, 1);
    };
  }, [activo]);
}
