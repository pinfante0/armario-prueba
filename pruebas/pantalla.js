// Que la pantalla del tablero quepa y no se vaya de la lengua, medido sobre
// todos los tableros de verdad y no sobre uno de ejemplo.
//
// Las dos reglas y cómo se miden están en `medidas.js`, porque desde la Fase 3
// hay más pantallas que el tablero y las mide `armazon.js` con la misma vara.
// Aquí queda lo que solo vale para el tablero: recorrerse cada plantilla por
// cada uno de sus armarios por cada una de sus semillas.
//
// Y desde la Fase 4, tres estados por tablero en vez de uno en los dos niveles
// de recambio. La pantalla de la segunda vuelta no se parece a la de la primera
// —montón vacío, baldas llenas, otro aviso— y no se llega a ella si no es
// jugando, porque los rótulos solo se dan la vuelta cuando el armario ya está
// ordenado. Se ordena con la misma mano que `jugar.js`, que está en
// `jugadas.js` para que no haya dos.
//
// Cada tamaño de teléfono es un <iframe> de ese tamaño exacto y no una ventana
// del navegador: Chrome no baja de 500 px de ancho de ventana, así que pedirle
// 320 daría 500 y una medición que parece buena y no lo es. Dentro del marco,
// `100dvh` y las unidades `vh` miden lo que el marco, que es de lo que cuelga
// todo el CSS de este juego.

import { cargarTodo, disponiblesPara } from '../js/datos.js';
import { generar } from '../js/generador.js';
import { cargarIconos } from '../js/iconos.js';
import { cargarFotografias } from '../js/fotografias.js';
import { combinar } from '../js/recursos.js';
import { pantallaTablero } from '../js/pantalla_tablero.js';
import { marco } from './marco.js';
import { ordenarColocando, ordenarIntercambiando, principal } from './jugadas.js';
import { TELEFONOS, fugas, medir } from './medidas.js';

// --------------------------------------------------------------------------

/**
 * Los recursos, y con `?todas` uno prestado para cada pieza que aún no tiene.
 *
 * Existe porque **el tamaño no se decide contra la tanda de hoy sino contra las
 * 59**. Con ocho dibujadas, 40 px pasaba y el más justo quedaba en 3 px: habría
 * sido un verde que se rompe solo dentro de cinco tandas, que es la peor forma
 * de pasar una prueba. En la tanda 1 esto se montó a mano, y por eso en la
 * tanda 2 hubo que volver a montarlo a mano — que es exactamente lo que
 * `navegador.py` dice de una comprobación que hay que preparar a mano: no se
 * pasa nunca.
 *
 * Prestar un recurso cualquiera no falsea la medida: todos ocupan la misma caja
 * de `--ficha-recurso` con `aspect-ratio: 1`, así que lo que se mide es la
 * geometría de la ficha y no qué hay dentro. Lo que sí cambia, y es todo el
 * asunto, es **cuántas fichas la tienen**.
 *
 * **Y desde la 6.4 lo que se presta es una fotografía y no un dibujo.** No es
 * limpieza: el final contra el que hay que medir son 58 fotografías, y un
 * `<img>` y un `<svg>` no le imponen lo mismo a la columna que los contiene
 * —uno trae tamaño propio y el otro no—. Prestar dibujos habría medido un juego
 * terminado que ya se decidió que no va a existir. Si no hubiera ninguna
 * fotografía preparada se presta lo que haya, porque una medición que no se
 * puede hacer es peor que una aproximada que se dice.
 */
function conLasQueFaltan(recursos, fotos, instrumentos) {
  if (!new URLSearchParams(location.search).has('todas')) return recursos;
  const ids = instrumentos.map((pieza) => pieza.id);
  const prestado = ids.find((id) => fotos.nodo(id)) ?? ids.find((id) => recursos(id));
  if (!prestado) return recursos;
  const dar = fotos.nodo(prestado) ? fotos.nodo : recursos;
  return (id) => recursos(id) ?? dar(prestado);
}

async function medirTelefono(ancho, alto, etiqueta, datos, soloEste) {
  const lineas = [`  ${ancho}×${alto}, ${etiqueta}`];
  if (soloEste && soloEste !== `${ancho}x${alto}`) return { lineas: [], mal: 0 };

  const ventana = await marco(ancho, alto, etiqueta);
  const dentro = ventana.contentWindow;
  const juego = dentro.document.getElementById('juego');
  // Los dibujos van **dentro del marco**: un `<use href="#i-piano">` solo
  // encuentra su símbolo en su propio documento, así que con el sprite en la
  // página de fuera esto mediría fichas sin dibujo y diría que cabe lo que no
  // se está pintando. Desde la Fase 6 esta página mide el juego con los recursos
  // puestos, que es donde la exploración de `medir_iconos.py` deja de valer.
  // Las fotografías no necesitan ese cuidado —un `<img>` trae su contenido en el
  // `src`— pero se cargan aquí igual para que la política de convivencia sea la
  // misma que la del juego y no una copia de ella.
  const fotos = await cargarFotografias();
  const recursos = conLasQueFaltan(
    combinar(fotos.nodo, await cargarIconos(dentro.document)),
    fotos,
    datos.instrumentos,
  );
  let mal = 0;
  let sobrante = Infinity;
  let apretado = '';

  for (const plantilla of Object.values(datos.plantillas)) {
    for (const idArmario of plantilla.armarios) {
      const armario = datos.armarios[idArmario];
      const fallos = [];
      let peor = Infinity;
      let piezas = 0;
      let cuando = '';

      for (let semilla = 0; semilla < plantilla.semillas; semilla++) {
        juego.replaceChildren();
        let nodo;
        try {
          nodo = pantallaTablero({
            plantilla,
            armario,
            semilla,
            instrumentos: datos.instrumentos,
            recursos,
            // La lupa reserva su sitio en la cabecera, así que se mide aunque
            // aquí no se abra el visor: lo que cuesta es el ancho que le quita al
            // título en «recién abierto», y eso lo ve esta medición sin más. El
            // visor en sí lo mide `pruebas/visor.js`, que no depende del tablero.
            foto: fotos,
            ir: () => {},
            atras: () => {},
          });
        } catch (fallo) {
          fallos.push(`semilla ${semilla}: no se ha podido pintar: ${fallo.message}`);
          continue;
        }
        juego.append(nodo);

        const mirar = (momento) => {
          const medida = medir(nodo, dentro);
          for (const p of [...medida.problemas, ...fugas(nodo, datos.instrumentos)]) {
            fallos.push(`semilla ${semilla}, ${momento}: ${p}`);
          }
          if (medida.sobra < peor) {
            peor = medida.sobra;
            piezas = nodo.querySelectorAll('[data-pieza]').length;
            cuando = momento;
          }
        };

        mirar('recién abierto');

        // Al final de un armario no se llega de otra manera que ordenándolo, ni
        // a la segunda vuelta tampoco: los rótulos solo se dan la vuelta cuando
        // el armario ya está ordenado. Así que aquí se juega, igual que en
        // jugar.js y con la misma mano, y se mide lo que sale.
        //
        // Y hay que medirlo en todos y no razonarlo en uno. Parece que el final
        // no puede apretar —el montón está vacío y el panel ocupa su sitio—
        // pero eso es un argumento, y en la Fase 4 el argumento equivalente
        // resultó cierto y aun así se midió. Aquí además el panel escribe la
        // lista de lo que se ha resistido, que puede ser el armario entero.
        const tablero = generar(
          plantilla,
          armario,
          disponiblesPara(plantilla, datos.instrumentos),
          semilla,
        );
        // El nivel 7 empieza lleno, así que allí no hay nada que colocar: se
        // ordena intercambiando, igual que la segunda vuelta del 5.
        if (tablero.inicial) ordenarIntercambiando(nodo, tablero, fallos);
        else ordenarColocando(nodo, tablero, fallos);
        principal(nodo).click();

        if (plantilla.recambio) {
          principal(nodo).click();
          mirar('con los rótulos ya vueltos');
          ordenarIntercambiando(nodo, tablero.recambio, fallos);
          principal(nodo).click();
        }
        mirar('con el candado puesto');
      }

      const donde = `${plantilla.id} / ${armario.id}`;
      if (fallos.length) {
        mal += fallos.length;
        lineas.push(`    MAL ${donde}`);
        for (const f of fallos.slice(0, 3)) lineas.push(`        x ${f}`);
        if (fallos.length > 3) lineas.push(`        ... y ${fallos.length - 3} más`);
      } else {
        lineas.push(
          `    ok  ${donde.padEnd(28)} sobran ${String(peor).padStart(4)} px ` +
            `con ${piezas} piezas, ${cuando}`,
        );
        if (peor < sobrante) {
          sobrante = peor;
          apretado = donde;
        }
      }
    }
  }

  if (sobrante !== Infinity) {
    lineas.push(`    el más justo es ${apretado}, con ${sobrante} px de sobra`);
  }
  lineas.push('');
  return { lineas, mal };
}

async function arrancar() {
  const salida = document.getElementById('informe');
  const soloEste = new URLSearchParams(location.search).get('solo');
  const datos = await cargarTodo();

  // Contado y no escrito. Este número ya se quedó viejo una vez —decía 720
  // cuando la Fase 4 lo dejó en 1080— y es el mismo error que los créditos del
  // proyecto hermano contando canciones: un número a mano caduca la próxima vez
  // que alguien añade una plantilla.
  const cuantos = Object.values(datos.plantillas)
    .reduce((n, pl) => n + pl.armarios.length * pl.semillas, 0);
  const lineas = [`Los ${cuantos} tableros, uno a uno, en cada teléfono.`, ''];
  let mal = 0;
  for (const [ancho, alto, etiqueta] of TELEFONOS) {
    const resultado = await medirTelefono(ancho, alto, etiqueta, datos, soloEste);
    lineas.push(...resultado.lineas);
    mal += resultado.mal;
  }

  lineas.push(`ESTADO: ${mal === 0 ? 'PASA' : 'NO PASA'}`);
  salida.textContent = lineas.join('\n');
  salida.dataset.estado = mal === 0 ? 'pasa' : 'no-pasa';
}

arrancar().catch((fallo) => {
  const salida = document.getElementById('informe');
  salida.textContent = `${fallo.message}\n\nESTADO: NO PASA`;
  salida.dataset.estado = 'no-pasa';
});
