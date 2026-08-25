// Cuánto icono cabe en una ficha. Medido antes de dibujar ninguno.
//
// La Fase 6 dice «iconos reconocibles a 60 px» y una ficha mide hoy
// `clamp(1.85rem, 4.9vh, 2.5rem)` de alto, o sea entre 30 y 40 px. Los dos
// números no caben juntos, así que antes de dibujar cincuenta y nueve dibujos
// hay que saber **de qué tamaño se pueden dibujar**, y eso no se razona: se
// mide, que es la regla de esta casa desde la Fase 2.
//
// Esto NO es una comprobación y no lleva su caso que tiene que dar mal: es una
// exploración, como `resolver.py --ver`. No dice PASA ni NO PASA, dice cuántos
// píxeles. La comprobación de verdad llegará cuando el icono esté dentro del
// juego y la haga `comprobar_pantalla.py` sobre los 1440 tableros.
//
// Tres decisiones de método, que son lo que hace que el número valga algo:
//
//   - **No se toca el juego.** La pantalla se pinta con `pantallaTablero()`, la
//     de verdad, y los iconos se le inyectan encima al documento ya pintado.
//     Así la medición no compromete ninguna decisión de dibujo: lo que se está
//     midiendo es la geometría de la ficha, no el icono.
//
//   - **Un icono que se encoge o se recorta no cuenta como que cabe.** `.ficha`
//     lleva `overflow: hidden`, así que un dibujo demasiado grande no desborda
//     la pantalla: se corta por la mitad sin que nadie se queje, y `medir()`
//     diría que todo va bien. Es exactamente «un resultado que se parece a un
//     aprobado». Por eso aquí se le mide el rectángulo a cada icono y se exige
//     que mida lo que se le pidió y que quepa dentro de su ficha.
//
//   - **Se miden dos estados y no uno.** Sin iconos el más justo es el primero,
//     con el montón lleno, y eso está medido desde la Fase 4. Con iconos ese
//     argumento deja de valer: con el montón lleno los huecos del armario están
//     vacíos y no llevan dibujo, y es al llenar el armario cuando cada hueco
//     pasa a costar un icono. Cuál de los dos aprieta es la pregunta, así que
//     se ordena el tablero y se vuelve a medir.

import { cargarTodo, disponiblesPara } from '../js/datos.js';
import { generar } from '../js/generador.js';
import { pantallaTablero } from '../js/pantalla_tablero.js';
import { marco } from './marco.js';
import { ordenarColocando, ordenarIntercambiando } from './jugadas.js';
import { TELEFONOS, medir } from './medidas.js';

const TOLERANCIA = 0.5; // píxeles, por el redondeo de los rectángulos

// De menos a más, y hasta pasarse. El 60 del enunciado de la fase está dentro
// para que el informe diga en voz alta si llega o no llega.
const TAMANOS = [10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 56, 60, 64];

// Las cuatro formas de meter un dibujo en una ficha que tienen sentido. La
// primera es la de hoy y está para tener con qué comparar: sin ella los
// números de las otras tres no dicen si el precio es caro.
const DISPOSICIONES = [
  ['sin', 'como está hoy, solo el nombre'],
  ['apilado', 'el dibujo encima del nombre'],
  ['fila', 'el dibujo a la izquierda del nombre'],
  ['solo', 'solo el dibujo; el nombre se va al aria-label'],
];

// La ropa de la prueba. Va aparte de `armario.css` a propósito: esta hoja no es
// una propuesta de estética, es lo justo para que el dibujo ocupe sitio y se
// pueda medir cuánto. `.ficha` es hoy un `-webkit-box` con `line-clamp`, que
// sirve para recortar un texto a dos líneas y no para colocar dos cosas, así
// que la ficha con dibujo pasa a ser un flex y el recorte se lo queda el
// nombre, que es de quien era.
//
// Aquí dentro no van comillas invertidas ni en los comentarios: esto es una
// plantilla de JavaScript y una comilla invertida la parte por la mitad. Ha
// pasado dos veces y las dos el fallo fue el mismo, un «Unexpected identifier»
// en la primera regla que no tenía nada que ver.
const ROPA = `
.ficha.con-recurso {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  -webkit-line-clamp: none;
}
/* Sin min-width en cero, y costó verlo. Con él, la medida decía que en un
   móvil grande con el montón lleno un dibujo de diez píxeles cortaba los doce
   nombres, que es geométricamente imposible: lo que pasaba es que el nombre
   perdía su ancho mínimo, y entonces las fichas del montón —que se encogen—
   podían aplastarse unas a otras hasta caber todas en una línea. Hoy eso no
   pasa porque el texto va suelto en la ficha y su ancho mínimo es su palabra
   más larga. La ficha con dibujo tiene que heredar esa propiedad o no está
   midiendo la misma pantalla. */
.ficha.con-recurso .nombre {
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
/* Sin encoger, y no es un detalle: si el dibujo se dejara encoger, la medida
   diría que cabe un icono de 48 px que en pantalla se ve de 19. Encogerse es
   justo lo que hay que cazar, así que se le pide su tamaño y se mira si lo
   tiene. */
.ficha.con-recurso .dibujo {
  flex: 0 0 auto;
  width: var(--icono);
  height: var(--icono);
}
/* Apilado, el nombre no se encoge. Sin esto se encogía **en alto**, porque un
   item de una columna flexible cede altura antes que quejarse, y el texto se
   recortaba por debajo con el overflow de la ficha: la medida decía «se cortan
   nombres» cuando lo que pasaba de verdad es que no había sitio.
   Que no quepa tiene que salir por donde salen las cosas que no caben, que es
   la pantalla pidiendo más alto. */
.disp-apilado .ficha.con-recurso { flex-direction: column; gap: 0.1rem; }
.disp-apilado .ficha.con-recurso .nombre { flex-shrink: 0; }
.disp-fila .ficha.con-recurso { flex-direction: row; }
.disp-solo .ficha.con-recurso .nombre { display: none; }
`;

// --------------------------------------------------------------------------
// El icono de mentira
// --------------------------------------------------------------------------

// Un dibujo cualquiera con la densidad de trazo que tendría un instrumento:
// un cuerpo, un mango y dos detalles. No es una propuesta de estilo y no hay
// que discutirlo — de dónde salen los dibujos de verdad es la conversación
// siguiente—. Está aquí para dos cosas: ocupar exactamente su tamaño, que es
// lo que se mide, y dejar algo que mirar con los ojos en los marcos de abajo,
// porque «cabe» y «se reconoce» son dos preguntas y esta página solo contesta
// la primera.
const SVG = 'http://www.w3.org/2000/svg';

function dibujo(documento) {
  const svg = documento.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'dibujo');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of [
    'M8 21c3.3 0 6-2.7 6-6 0-2.2 1-3.4 2.4-4.4',
    'M8 21c-2.2 0-4-1.8-4-4s1.8-3.6 4-3.6 3.6 1.6 3.6 3.6S10.2 21 8 21z',
    'M16.4 10.6 20 4l-6.2 3.8',
    'M8 17.2h.01',
  ]) {
    const trazo = documento.createElementNS(SVG, 'path');
    trazo.setAttribute('d', d);
    svg.append(trazo);
  }
  return svg;
}

/**
 * Le pone dibujo a cada ficha del documento ya pintado.
 *
 * Hay que llamarlo otra vez después de jugar: la pantalla se repinta entera en
 * cada movimiento y los dibujos se van con el repintado. Eso no es un problema
 * de la prueba, es lo que hace que lo medido sea la pantalla de verdad.
 */
function ponerDibujos(nodo, documento) {
  for (const ficha of nodo.querySelectorAll('.ficha')) {
    if (ficha.classList.contains('con-recurso')) continue;
    const nombre = ficha.textContent;
    // El nombre se va al aria-label para que la disposición «solo» no sea
    // además una pantalla que un lector no puede usar: sin esto, la ficha del
    // montón se quedaría sin decir de qué pieza es.
    if (!ficha.hasAttribute('aria-label')) ficha.setAttribute('aria-label', nombre);
    ficha.textContent = '';
    ficha.classList.add('con-recurso');
    const texto = documento.createElement('span');
    texto.className = 'nombre';
    texto.textContent = nombre;
    ficha.append(dibujo(documento), texto);
  }
}

// --------------------------------------------------------------------------
// Que el dibujo esté entero
// --------------------------------------------------------------------------

/**
 * El peor de los dibujos de esta pantalla: cuánto se ha quedado por debajo del
 * tamaño que se le pidió, o cuánto se le ha salido a su ficha.
 *
 * Las dos cosas son la misma noticia con dos causas: encogido por el flex, o
 * cortado por el `overflow: hidden` de la ficha. Ninguna de las dos se ve desde
 * `medir()`, que solo sabe de la pantalla.
 */
function dibujosMal(nodo, pedido) {
  let encogido = 0;
  let cortado = 0;

  for (const svg of nodo.querySelectorAll('.dibujo')) {
    const caja = svg.getBoundingClientRect();
    const ficha = svg.parentElement.getBoundingClientRect();
    encogido = Math.max(encogido, pedido - Math.min(caja.width, caja.height));
    cortado = Math.max(
      cortado,
      ficha.top - caja.top,
      caja.bottom - ficha.bottom,
      ficha.left - caja.left,
      caja.right - ficha.right,
    );
  }

  const problemas = [];
  if (encogido > TOLERANCIA) {
    problemas.push(`un dibujo se queda en ${Math.round(pedido - encogido)} px`);
  }
  if (cortado > TOLERANCIA) problemas.push(`un dibujo se sale ${Math.ceil(cortado)} px de su ficha`);
  return problemas;
}

/**
 * Cuántos nombres se están cortando, de cuántos hay.
 *
 * El primer intento de esto medía el ancho del nombre más estrecho, y ese
 * número **no medía lo que parecía**: en el montón cada ficha mide lo que su
 * texto, así que el más estrecho era siempre «Gong» y salían dieciocho píxeles
 * dijera lo que dijera el resto. Lo que hay que contar es cuántos se cortan, y
 * eso se lee comparando lo que el texto pide con lo que tiene: `.ficha` recorta
 * a dos líneas con `line-clamp`, y un texto recortado deja `scrollHeight` por
 * encima de `clientHeight`.
 *
 * Va con su referencia de hoy —los nombres que ya se cortan sin dibujo
 * ninguno— porque el número solo, sin con qué compararlo, no dice si el precio
 * lo ha puesto el icono.
 */
function nombresCortados(nodo) {
  const cajas = nodo.querySelectorAll('.ficha.con-recurso .nombre, .ficha:not(.con-recurso)');
  let cortados = 0;
  let cual = null;
  for (const caja of cajas) {
    // Un píxel de margen y no medio, porque estas dos propiedades son enteras
    // y las de los rectángulos no: una línea de 11,15 px deja `clientHeight` en
    // 11 y `scrollHeight` en 12 sin que se haya cortado nada. Con medio píxel,
    // la medida decía que en un móvil grande un dibujo de 10 px cortaba los
    // doce nombres del montón, que es imposible, y lo que estaba contando eran
    // redondeos.
    if (caja.scrollHeight > caja.clientHeight + 1 || caja.scrollWidth > caja.clientWidth + 1) {
      cortados++;
      // Cuál se corta, con sus números, y no solo cuántos: un número frágil se
      // comprueba mirando la pieza, y si el nombre que sale no es de los
      // largos es que lo que falla es la medida y no la ficha.
      cual =
        cual ??
        `${caja.textContent} (${Math.round(caja.scrollWidth)}/${Math.round(caja.clientWidth)} ` +
          `de ancho, ${Math.round(caja.scrollHeight)}/${Math.round(caja.clientHeight)} de alto)`;
    }
  }
  return { cortados, total: cajas.length, cual };
}

// --------------------------------------------------------------------------
// El barrido
// --------------------------------------------------------------------------

/**
 * Prueba todos los tamaños sobre una pantalla ya pintada, y devuelve el mayor
 * que pasa y por qué se paró.
 *
 * El tablero no se vuelve a pintar para cada tamaño: se le cambia `--icono` y
 * se vuelve a medir, que cuesta lo que cuesta una relectura de rectángulos. Es
 * lo que hace asumible probar cuatro disposiciones por diecisiete tamaños.
 */
function barrer(nodo, dentro, disposicion, base) {
  const raiz = dentro.document.documentElement;
  raiz.classList.remove(...[...raiz.classList].filter((c) => c.startsWith('disp-')));
  raiz.classList.add(`disp-${disposicion}`);

  let mayor = null;
  let legible = null;
  let motivo = 'no cabe ni el más pequeño';
  let legibleMotivo = null;
  let nombres = null;

  for (const tamano of TAMANOS) {
    raiz.style.setProperty('--icono', `${tamano}px`);
    const problemas = [...medir(nodo, dentro).problemas, ...dibujosMal(nodo, tamano)];
    if (problemas.length) {
      motivo = problemas[0];
      break;
    }
    mayor = tamano;
    nombres = nombresCortados(nodo);
    // Dos techos y no uno, porque «cabe» y «se puede leer» resultaron ser
    // números distintos: hay tamaños en los que la pantalla sigue entrando
    // entera y **todos** los nombres están cortados. Un icono que se come el
    // nombre no es un icono que quepa: en este juego el nombre es lo único que
    // sale del catálogo a la pantalla.
    //
    // Y se compara contra lo que se corta **en este mismo estado sin dibujo**,
    // que no es cero en todas partes: con el armario lleno hay nombres que ya
    // se cortan hoy, en las celdas estrechas del tablero de dos ejes. Medirlo
    // contra cero echaría al icono la culpa de un recorte que ya estaba.
    if (nombres.cortados <= base) legible = tamano;
    else if (!legibleMotivo) {
      legibleMotivo =
        `a ${tamano} px se cortan ${nombres.cortados} de ${nombres.total}` +
        `, el primero «${nombres.cual}»`;
    }
    motivo = `no se ha probado más de ${tamano}`;
  }
  return { mayor, legible, motivo, legibleMotivo, nombres };
}

/** La ficha de hoy, que es con lo que hay que comparar todo lo demás. */
function sinDibujo(nodo, dentro) {
  const raiz = dentro.document.documentElement;
  raiz.classList.remove(...[...raiz.classList].filter((c) => c.startsWith('disp-')));
  return { sobra: medir(nodo, dentro).sobra, nombres: nombresCortados(nodo) };
}

// --------------------------------------------------------------------------
// Qué tableros se miden
// --------------------------------------------------------------------------

/**
 * Los tableros que peor lo llevan, que son los que deciden el techo.
 *
 * Medir los 1440 por cuatro disposiciones y dos estados no es asumible, y
 * tampoco hace falta: el techo lo pone el peor. «Peor» aquí son dos cosas
 * distintas y se cogen las dos, porque con dibujos no tienen por qué coincidir:
 * el que menos sitio libre deja hoy, y el que más piezas reparte —que es el que
 * más dibujos va a tener que pintar—.
 *
 * Se eligen en 320x568, que es el suelo del proyecto, y se usan los mismos en
 * los cuatro teléfonos. Lo que esto no demuestra es que no haya un tablero
 * peor entre los que no se han mirado; eso lo dirá `comprobar_pantalla.py`
 * sobre los 1440 cuando el icono esté dentro del juego, que es donde tiene que
 * decirlo.
 */
async function elegirTableros(datos, cuantasSemillas) {
  const ventana = await marco(320, 568, 'la criba', 'criba');
  const dentro = ventana.contentWindow;
  const juego = dentro.document.getElementById('juego');
  const elegidos = [];

  for (const plantilla of Object.values(datos.plantillas)) {
    for (const idArmario of plantilla.armarios) {
      const armario = datos.armarios[idArmario];
      const filas = [];
      const hasta = Math.min(plantilla.semillas, cuantasSemillas);
      for (let semilla = 0; semilla < hasta; semilla++) {
        juego.replaceChildren();
        const nodo = pantallaTablero({
          plantilla,
          armario,
          semilla,
          instrumentos: datos.instrumentos,
          ir: () => {},
          atras: () => {},
        });
        juego.append(nodo);
        filas.push({
          semilla,
          sobra: medir(nodo, dentro).sobra,
          piezas: nodo.querySelectorAll('[data-pieza]').length,
        });
      }
      const porSitio = [...filas].sort((a, b) => a.sobra - b.sobra)[0];
      const porPiezas = [...filas].sort((a, b) => b.piezas - a.piezas)[0];
      for (const cual of new Set([porSitio.semilla, porPiezas.semilla])) {
        elegidos.push({ plantilla, armario, semilla: cual });
      }
    }
  }
  return elegidos;
}

// --------------------------------------------------------------------------

async function medirTelefono(ancho, alto, etiqueta, datos, tableros) {
  const ventana = await marco(ancho, alto, etiqueta);
  const dentro = ventana.contentWindow;
  const hoja = dentro.document.createElement('style');
  hoja.textContent = ROPA;
  dentro.document.head.append(hoja);
  const juego = dentro.document.getElementById('juego');

  // El techo de una disposición es **el menor de los mayores**: el tamaño que
  // aguanta el peor tablero. Y se guarda además por plantilla, porque medir
  // solo el mínimo global escondería lo que aquí resultó ser el hecho
  // importante: que el techo lo pone un tablero de los ocho, siempre el mismo.
  // Los dos techos se acumulan por separado y no viajan juntos: el tablero que
  // pone el techo de lo que cabe no tiene por qué ser el que pone el de lo que
  // deja leer el nombre, y quedarse con los dos números del mismo tablero daría
  // un «y legible» más alto de lo que aguanta el peor.
  const anotar = (mapa, clave, disposicion, r) => {
    if (!mapa.has(clave)) mapa.set(clave, new Map());
    const suyo = mapa.get(clave);
    const antes = suyo.get(disposicion);
    const dedonde = `${r.donde}, ${r.estado}, donde sin dibujo se cortaban ${r.base}`;
    // El primero se guarda entero, testigo incluido. Sin esto, un primer
    // tablero que ya diera «ninguno» dejaba la casilla sin de dónde sale para
    // siempre, porque después ningún otro puede bajar de ahí: salía un «—» sin
    // nada al lado con que comprobarlo.
    if (!antes) return void suyo.set(disposicion, { ...r, legibleDonde: dedonde });
    if ((r.mayor ?? 0) < (antes.mayor ?? 0)) {
      Object.assign(antes, {
        mayor: r.mayor,
        motivo: r.motivo,
        donde: r.donde,
        estado: r.estado,
        nombres: r.nombres,
        base: r.base,
      });
    }
    if ((r.legible ?? 0) < (antes.legible ?? 0)) {
      Object.assign(antes, {
        legible: r.legible,
        legibleMotivo: r.legibleMotivo,
        legibleDonde: dedonde,
      });
    }
  };
  const techo = new Map();
  const porPlantilla = new Map();
  let sobra = Infinity;
  let sobraDonde = '';
  let cortadosHoy = null;

  for (const { plantilla, armario, semilla } of tableros) {
    juego.replaceChildren();
    const nodo = pantallaTablero({
      plantilla,
      armario,
      semilla,
      instrumentos: datos.instrumentos,
      ir: () => {},
      atras: () => {},
    });
    juego.append(nodo);
    const donde = `${plantilla.id} / ${armario.id} / ${semilla}`;

    const hoy = sinDibujo(nodo, dentro);
    if (hoy.sobra < sobra) {
      sobra = hoy.sobra;
      sobraDonde = donde;
      cortadosHoy = hoy.nombres;
    }

    // Los dos estados. El segundo se consigue jugando, que es la única forma
    // de llenar un armario: es la misma mano de `jugar.js` y de `pantalla.js`.
    for (const estado of ['con el montón lleno', 'con el armario lleno']) {
      if (estado === 'con el armario lleno') {
        const tablero = generar(
          plantilla,
          armario,
          disponiblesPara(plantilla, datos.instrumentos),
          semilla,
        );
        const fallos = [];
        if (tablero.inicial) ordenarIntercambiando(nodo, tablero, fallos);
        else ordenarColocando(nodo, tablero, fallos);
        if (fallos.length) continue;
      }
      // Lo que ya se corta aquí sin dibujo ninguno, que es contra lo que hay
      // que comparar. Se mide en cada estado porque cambia con el estado.
      const base = sinDibujo(nodo, dentro).nombres.cortados;
      ponerDibujos(nodo, dentro.document);
      for (const [disposicion] of DISPOSICIONES.slice(1)) {
        const resultado = { ...barrer(nodo, dentro, disposicion, base), donde, estado, base };
        anotar(techo, 'todas', disposicion, resultado);
        anotar(porPlantilla, plantilla.id, disposicion, resultado);
      }
    }
  }

  // El marco se queda con el último tablero medido y con el mayor icono que le
  // cabía, para que se pueda mirar con los ojos lo que los números acaban de
  // decir. Es lo mismo que hace `pantalla.js` y por lo mismo.
  const paraMirar = techo.get('todas')?.get('apilado');
  dentro.document.documentElement.classList.add('disp-apilado');
  dentro.document.documentElement.style.setProperty('--icono', `${paraMirar?.mayor ?? 16}px`);

  // Cinco columnas: cada disposición con nombre lleva dos, la de lo que cabe y
  // la de lo que cabe **dejando leer el nombre**. La de «solo» no tiene la
  // segunda porque allí no hay nombre que leer, y eso es la mitad de su precio.
  const COLUMNAS = [
    ['apilado', 'apilado', (r) => r?.mayor],
    ['apilado', ' y legible', (r) => r?.legible],
    ['fila', 'fila', (r) => r?.mayor],
    ['fila', ' y legible', (r) => r?.legible],
    ['solo', 'solo', (r) => r?.mayor],
  ];
  const columna = (fila) =>
    COLUMNAS.map(([id, , cual]) => {
      const cuanto = cual(fila?.get(id));
      return (cuanto ? `${cuanto} px` : '—').padStart(11);
    }).join('');

  const lineas = [`  ${ancho}×${alto}, ${etiqueta}`];
  lineas.push(
    `    hoy, sin dibujo: sobran ${sobra} px en el peor (${sobraDonde}), y ` +
      `se cortan ${cortadosHoy.cortados} nombres de ${cortadosHoy.total}`,
  );
  lineas.push('');
  lineas.push(
    `    ${'el mayor que cabe'.padEnd(16)}${COLUMNAS.map(([, t]) => t.padStart(11)).join('')}`,
  );
  // Las dos columnas no valen lo mismo y hay que decirlo donde se leen. «Cabe»
  // es geometría y no depende de nada que esté por decidir; «y legible»
  // depende de cómo se rehaga la ficha, que es exactamente la decisión que
  // esta medición no toma.
  for (const id of [...porPlantilla.keys()].sort()) {
    lineas.push(`    ${id.padEnd(16)}${columna(porPlantilla.get(id))}`);
  }
  lineas.push(`    ${'TODAS'.padEnd(16)}${columna(techo.get('todas'))}`);
  lineas.push('');
  for (const [id, que] of DISPOSICIONES.slice(1)) {
    const r = techo.get('todas')?.get(id);
    lineas.push(`    ${id} — ${que}`);
    lineas.push(`      lo para ${r?.motivo ?? '?'}`);
    lineas.push(`      en ${r?.donde ?? '?'}, ${r?.estado ?? '?'}`);
    if (r?.nombres) {
      lineas.push(
        `      y ahí se cortan ${r.nombres.cortados} nombres de ${r.nombres.total}, ` +
          `cuando sin dibujo se cortaban ${r.base}`,
      );
    }
    if (id !== 'solo') {
      lineas.push(
        `      con el nombre entero solo llega a ${r?.legible ? `${r.legible} px` : 'ninguno'}: ` +
          `${r?.legibleMotivo ?? 'ningún nombre se corta; lo que para es el sitio'}`,
      );
      lineas.push(`      en ${r?.legibleDonde ?? '?'}`);
    }
  }
  lineas.push('');
  return lineas;
}

async function arrancar() {
  const salida = document.getElementById('informe');
  const parametros = new URLSearchParams(location.search);
  // Dos formas de acortar la medición mientras se itera. `semillas` es cuántas
  // se criban por plantilla y armario —con 60 se miran los 1440— y `solo` es un
  // teléfono. Se escriben en el informe: una medición hecha a medias que no
  // dice que lo está es peor que no tenerla.
  const cuantas = Number(parametros.get('semillas')) || 60;
  const soloEste = parametros.get('solo');

  const lineas = [];
  const escribir = (...nuevas) => {
    lineas.push(...nuevas);
    salida.textContent = lineas.join('\n');
  };

  escribir('Cribando los tableros…');
  const datos = await cargarTodo();
  const tableros = await elegirTableros(datos, cuantas);

  lineas.length = 0;
  escribir(
    `Cuánto icono cabe en una ficha, sobre ${tableros.length} tableros de los que peor lo llevan,`,
    `cribados entre las ${cuantas} primeras semillas de cada plantilla y armario.`,
    'Un tamaño «pasa» si la pantalla sigue cabiendo Y el dibujo se pinta entero.',
    '',
    'La columna «cabe» es geometría y vale tal cual. La de «y legible» vale menos:',
    'depende de cómo se maquete la ficha, que es la decisión que esto no toma.',
    '',
  );
  for (const [ancho, alto, etiqueta] of TELEFONOS) {
    if (soloEste && soloEste !== `${ancho}x${alto}`) continue;
    escribir(...(await medirTelefono(ancho, alto, etiqueta, datos, tableros)));
  }
  escribir('ESTADO: MEDIDO');
}

// Lo que reviente aquí tiene que salir escrito y no quedarse en la consola: la
// página la abre un script sin ventana, que solo lee este <pre>.
function morir(mensaje) {
  const salida = document.getElementById('informe');
  salida.textContent = `${salida.textContent}\n\n${mensaje}\n\nESTADO: NO MEDIDO`;
}

window.addEventListener('error', (e) => morir(`se ha roto: ${e.message}`));
arrancar().catch((fallo) => morir(`se ha roto: ${fallo.message}\n${fallo.stack ?? ''}`));
