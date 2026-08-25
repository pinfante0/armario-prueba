// Cargar los tres archivos de `web/datos/` y aplicarles las dos reglas que
// deciden qué piezas puede repartir un tablero. Las dos están también en
// `resolver.py`, y por el mismo motivo que el generador: si aquí entrara una
// pieza que allí no entra, el resolvedor estaría demostrando otra cosa.

import { ARBOL } from './generador.js';

const RUTA = new URL('../datos/', import.meta.url);

async function leer(nombre) {
  const respuesta = await fetch(new URL(nombre, RUTA));
  if (!respuesta.ok) throw new Error(`no se ha podido leer datos/${nombre}: ${respuesta.status}`);
  return respuesta.json();
}

/**
 * Todo lo que el juego necesita saber antes de empezar.
 *
 * Los armarios y las plantillas llegan indexados por id porque así es como se
 * usan siempre; los instrumentos llegan en lista porque el orden del archivo es
 * parte del contrato: es el que ve el generador antes de barajar.
 */
export async function cargarTodo() {
  const [catalogo, armarios, tableros] = await Promise.all([
    leer('instrumentos.json'),
    leer('armarios.json'),
    leer('tableros.json'),
  ]);

  return {
    instrumentos: jugables(catalogo.instrumentos),
    armarios: Object.fromEntries(armarios.armarios.map((a) => [a.id, a])),
    plantillas: Object.fromEntries(plantillasDe(tableros).map((p) => [p.id, p])),
  };
}

/**
 * Las plantillas, con el vocabulario de baldas que necesita cada una.
 *
 * Los subniveles viven aparte en `tableros.json` porque no son de una plantilla
 * sino de todas las que usen el eje `hs-arbol`, y se enganchan aquí —por
 * referencia y no por copia— para que el generador los encuentre donde
 * encuentra lo demás de su plantilla, sin un argumento más en las nueve
 * llamadas a `generar()`. La otra mitad es `plantillas_de()`, en resolver.py, y
 * las dos tienen que enganchar lo mismo: lo comprueba `comparar_generadores`,
 * porque una plantilla sin su vocabulario no genera el mismo tablero.
 */
export function plantillasDe(tableros) {
  const subniveles = tableros.subniveles?.baldas ?? [];
  for (const pl of tableros.plantillas) {
    if ((pl.ejes ?? []).some((e) => e.sistema === ARBOL)) pl.subniveles = subniveles;
  }
  return tableros.plantillas;
}

/**
 * Lo que está pendiente de revisión no entra en ningún tablero.
 *
 * Es lo que hace seguro rellenar el catálogo por tandas: una clasificación
 * dudosa se escribe con su duda al lado y no llega a ninguna partida hasta que
 * alguien le quita el campo. Hoy son «Láminas» y la batería.
 */
export function jugables(instrumentos) {
  return instrumentos.filter((i) => !('revisar' in i));
}

/**
 * Lo que esta plantilla puede repartir.
 *
 * Un instrumento sin `dia` es de fuera del Tema 7, y una plantilla que dice
 * `solo_del_temario` no lo usa. Es lo que permite tener el piano y el órgano en
 * el catálogo sin que un tablero de entrada examine de lo que no se dio.
 */
export function disponiblesPara(plantilla, instrumentos) {
  if (!plantilla.solo_del_temario) return instrumentos;
  return instrumentos.filter((i) => i.dia && i.dia.length);
}
