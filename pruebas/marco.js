// Un teléfono de mentira: un <iframe> del tamaño exacto, con la hoja de estilo
// del juego y nada más.
//
// Existe porque Chrome no da ventanas de menos de 500 px de ancho, así que
// medir un móvil de 320 pidiéndoselo a la ventana da 500 y una medición que
// parece buena y no lo es. Dentro del marco, `100dvh` y las unidades `vh` miden
// lo que mide el marco, que es de lo que cuelga todo el CSS de este juego.

/** Devuelve el iframe ya cargado, listo para meterle un tablero dentro. */
export function marco(ancho, alto, etiqueta, donde = 'marcos') {
  const caja = document.createElement('figure');
  caja.className = 'marco';
  const pie = document.createElement('figcaption');
  pie.textContent = `${ancho}×${alto} — ${etiqueta}`;
  const ventana = document.createElement('iframe');
  ventana.src = 'marco.html';
  ventana.width = String(ancho);
  ventana.height = String(alto);
  ventana.title = pie.textContent;
  caja.append(ventana, pie);
  document.getElementById(donde).append(caja);
  return new Promise((listo) => {
    ventana.addEventListener('load', () => listo(ventana), { once: true });
  });
}
