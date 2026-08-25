// Las dos ayudas de redacción que usan dos pantallas.
//
// Está aquí por lo mismo que `pruebas/medidas.js` y `pruebas/jugadas.js`: en
// cuanto una segunda pantalla necesita lo mismo, la copia acaba siendo una
// segunda definición, y aquí la segunda definición se ve enseguida —una lista
// con «y» final en un sitio y con coma en el otro— pero se ve **en clase**.
//
// Y las dos existen por el mismo motivo, que es el suelo de este proyecto: los
// avisos se leen en voz alta delante de un aula, así que las concordancias se
// escriben enteras y no con «pieza(s)» ni con «1 pieza(s) mal».

/**
 * «Gong, Celesta y Bandurria». La última lleva su «y» en vez de una coma.
 *
 * Sin `at(-1)`, que pide un Safari más nuevo que el del teléfono que este
 * proyecto se ha puesto de suelo.
 */
export function enumerar(cosas) {
  if (cosas.length <= 1) return cosas.join('');
  return `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`;
}

/**
 * Singular o plural, con el número puesto donde diga `%d`.
 *
 *     segun(1, 'Queda una pieza', 'Quedan %d piezas')
 */
export const segun = (n, una, varias) => (n === 1 ? una : varias.replaceAll('%d', n));
