import { useEffect, useState } from "react";

/**
 * Por debajo de este umbral no es el teclado: es la barra de direcciones del
 * navegador contrayéndose al hacer scroll, que también encoge el viewport
 * visual unas decenas de píxeles. Reaccionar a eso haría bailar al elemento
 * anclado en cada scroll.
 */
const KEYBOARD_MIN_INSET_PX = 120;

/**
 * Píxeles que el teclado virtual tapa por abajo, o `0` si está cerrado.
 *
 * Hace falta porque `position: fixed` se ancla al viewport de *layout*, y al
 * abrirse el teclado iOS solo encoge el viewport *visual*: un elemento
 * anclado a `bottom` queda por debajo del teclado — invisible justo mientras
 * se escribe, que es cuando se necesita. Android normalmente redimensiona el
 * layout y devuelve `0` aquí, así que la corrección se aplica sola donde
 * hace falta.
 *
 * SSR-safe y degradado: sin `visualViewport` devuelve siempre `0`, que deja
 * el posicionamiento estático de siempre.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!viewport) return;

    const update = () => {
      // Lo que queda fuera del viewport visual por abajo. `offsetTop` entra
      // en la cuenta porque iOS desplaza el viewport visual al hacer zoom.
      const hidden = window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(hidden >= KEYBOARD_MIN_INSET_PX ? Math.round(hidden) : 0);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
