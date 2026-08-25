// La ficha documental: la recompensa por terminar el tablero completo.
//
// Es el gemelo de `fotografias.js` y `iconos.js` en la forma —un archivo que
// se carga una vez y una función que pregunta por id— pero no en el fondo:
// aquellos deciden qué se ve **durante** la partida y este solo puede
// consultarse **después**, cuando `correccion.final` es verdadero. Quién
// decide ese candado es `pantalla_tablero.js`; este módulo solo sabe qué dato
// hay para cada pieza, no cuándo se puede pedir.
//
// `web/datos/fichas.json` es el archivo revisado y público, no
// `material/fotografias/fuentes.json`: ese es el manifiesto técnico de la
// migración fotográfica y no se sirve nunca tal cual. Dos bloques por pieza,
// los dos opcionales campo a campo porque el caso mayoritario es que falten
// la mayoría: `fotografia` casi siempre trae autor, licencia y un enlace, y
// solo seis piezas —las que de verdad vienen del Met, verificado contra el
// sha256 del original y no contra lo que decía la documentación— traen
// además `instrumento`, con museo, colección, inventario, constructor, fecha
// y procedencia. Lo que no exista no se pinta: no hay un «sin documentar» que
// rellene el hueco, que es lo que convertiría la ficha en un formulario
// vacío en vez de en una tarjeta con lo que se sabe.

const RUTA = new URL('../datos/fichas.json', import.meta.url);

/** El mismo objeto que si no hubiera ninguna ficha: «Ver ficha» no aparece nunca. */
function ninguna() {
  return { tieneFicha: () => false, datosDe: () => null };
}

/**
 * Carga `fichas.json` y devuelve con qué preguntar por una pieza.
 *
 * Si el archivo no existe o no es válido, se juega igual y sin «Ver ficha»:
 * es la misma degradación que ya tienen `cargarFotografias()` y
 * `cargarIconos()`, y por el mismo motivo. Se avisa por consola porque un
 * archivo que falta no es un lote a medias, es algo roto.
 */
export async function cargarFichas() {
  try {
    const respuesta = await fetch(RUTA);
    if (!respuesta.ok) throw new Error(`${respuesta.status}`);
    const documento = await respuesta.json();
    if (documento?.version !== 1 || typeof documento.fichas !== 'object') {
      throw new Error('no tiene la forma esperada');
    }
    const fichas = documento.fichas;
    return {
      tieneFicha: (id) => Object.prototype.hasOwnProperty.call(fichas, id),
      datosDe: (id) => fichas[id] ?? null,
    };
  } catch (error) {
    console.warn(`sin fichas documentales: no se ha podido leer el catálogo (${error.message})`);
    return ninguna();
  }
}
