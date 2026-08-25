// Que cada dibujo quepa dentro de su caja, y que sea de alguien.
//
// Existe por el fallo más caro de esta fase, que es el que no se queja: la
// ficha lleva `overflow: hidden`, así que un trazo que se sale del viewBox no
// desborda a la vista, **se corta en silencio**. En la tanda 2 los nueve
// cordófonos se pasaban 0,2 px por abajo —la línea de suelo estaba en 39 y el
// medio trazo de 1,2 caía en 40,2— y eso no se vio en ninguna captura: se cazó
// recorriendo el trazado a mano. A mano, o sea una vez.
//
// Y esa es toda la razón de que esto sea una página y no un rato: la tanda 2 ya
// aprendió lo mismo con `--con-las-59`, que se montó a mano y por eso hubo que
// volver a montarlo en la tanda siguiente. Lo que dice `navegador.py` de una
// comprobación que hay que preparar es que no se pasa nunca.
//
// Tiene que correr en un navegador porque lo que mide es `getBBox`, y el
// rectángulo que ocupa de verdad un trazado curvo con `stroke-linejoin` no se
// saca de leer el atributo `d`: se saca de pintarlo. Con `{ stroke: true }`,
// que es lo que cuenta aquí —lo que se sale es el trazo, no la geometría—.
//
// Tres cosas se miden, y la tercera no es de tamaño:
//
//   1. Que el viewBox de cada símbolo sea exactamente `0 0 40 40`. Es la regla
//      3 del sprite: una unidad es un píxel, y en cuanto un símbolo tenga otra
//      caja «nada macizo por debajo de 1,8» deja de querer decir lo mismo en
//      todos.
//   2. Que el trazo entero quepa en esa caja.
//   3. Que el id de cada símbolo sea el de una pieza jugable. Un símbolo con
//      el id mal escrito no rompe nada: simplemente no lo enseña nadie, que es
//      la peor forma de entregar una tanda de dibujos.

import { cargarTodo } from '../js/datos.js';

const SPRITE = new URL('../datos/iconos.svg', import.meta.url);
const CAJA = { x: 0, y: 0, ancho: 40, alto: 40 };

// Una centésima, y **no medio píxel**, que es lo que se puso primero por
// analogía con iconos.html. Allí la tolerancia estaba para no contar como
// recorte el redondeo de `scrollHeight`, que es entero; aquí no hay redondeo
// que perdonar —getBBox da flotantes y los límites de una bézier son exactos—
// y sobre todo: **el desbordamiento de la tanda 2 fue de 0,2**. Cualquier
// margen por encima de eso deja pasar justo el fallo que esto existe para
// cazar, y lo dice el primero de los casos escritos a mano.
const TOLERANCIA = 0.01;

/** Un <svg> vivo y medible con el contenido de un símbolo dentro. */
function pintar(simbolo, dentro) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', simbolo.getAttribute('viewBox') || '0 0 40 40');
  svg.setAttribute('width', '200');
  svg.setAttribute('height', '200');
  const grupo = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  for (const hijo of simbolo.children) grupo.appendChild(hijo.cloneNode(true));
  svg.appendChild(grupo);
  dentro.appendChild(svg);
  return grupo;
}

/**
 * El rectángulo que ocupa de verdad, trazo incluido.
 *
 * `getBBox({ stroke: true })` está en la especificación de SVG 2 y **Chromium
 * no lo implementa**: no da error, ignora el argumento y devuelve la caja de la
 * geometría, que es medio trazo más pequeña por cada lado —o sea, exactamente
 * lo que esta página busca—. Se comprobó midiendo y no leyendo: una línea
 * horizontal de 2,4 de grosor tiene que dar 2,4 de alto y daba 0.
 *
 * Así que se suma a mano, y **elemento a elemento y no al grupo entero**, que
 * es la parte que importa: si se expandiera la caja del grupo, un relleno sin
 * trazo que estuviera en el borde —las teclas macizas, las sonajas— cargaría
 * con medio trazo que no tiene y saldría un fallo inventado.
 *
 * Lo que suma es medio grosor por lado, que es exacto con `stroke-linecap` y
 * `stroke-linejoin` redondos —que es lo que lleva todo este sprite— y con las
 * esquinas rectas de un `<rect>`, donde la punta del inglete crece en diagonal
 * pero no en x ni en y. Un ángulo agudo en inglete se saldría más, y por eso el
 * caso escrito a mano de aquí abajo no es decorativo: es lo único que separa
 * esta cuenta de una suposición.
 */
function cajaDe(elemento) {
  const b = elemento.getBBox();
  const estilo = getComputedStyle(elemento);
  const trazo = estilo.stroke && estilo.stroke !== 'none' ? parseFloat(estilo.strokeWidth) || 0 : 0;
  const m = trazo / 2;
  return { x: b.x - m, y: b.y - m, width: b.width + trazo, height: b.height + trazo };
}

const DIBUJABLES = 'path, rect, circle, ellipse, line, polyline, polygon';

function caja(grupo) {
  const cajas = [...grupo.querySelectorAll(DIBUJABLES)].map(cajaDe).filter((b) => b.width || b.height);
  if (!cajas.length) return { x: 0, y: 0, width: 0, height: 0 };
  const x1 = Math.min(...cajas.map((b) => b.x));
  const y1 = Math.min(...cajas.map((b) => b.y));
  const x2 = Math.max(...cajas.map((b) => b.x + b.width));
  const y2 = Math.max(...cajas.map((b) => b.y + b.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

function sobra(b) {
  return {
    izquierda: CAJA.x - b.x,
    arriba: CAJA.y - b.y,
    derecha: b.x + b.width - (CAJA.x + CAJA.ancho),
    abajo: b.y + b.height - (CAJA.y + CAJA.alto),
  };
}

function fuera(b) {
  const s = sobra(b);
  const partes = [];
  if (s.izquierda > TOLERANCIA) partes.push(`${s.izquierda.toFixed(2)} por la izquierda`);
  if (s.arriba > TOLERANCIA) partes.push(`${s.arriba.toFixed(2)} por arriba`);
  if (s.derecha > TOLERANCIA) partes.push(`${s.derecha.toFixed(2)} por la derecha`);
  if (s.abajo > TOLERANCIA) partes.push(`${s.abajo.toFixed(2)} por abajo`);
  return partes;
}

// --------------------------------------------------------------------------
// Que esta medición sabe fallar
// --------------------------------------------------------------------------
// La misma lección que `autoprueba()` en resolver.py, y aquí hace más falta que
// en ningún sitio: esta página sale en verde con un sprite vacío, con un
// navegador que no entienda `{ stroke: true }` y con un `getBBox` que devuelva
// ceros. Las tres se parecen a un aprobado.
//
// Los dos casos son los dos fallos de verdad: un trazo que se sale por abajo,
// que es literalmente lo de la tanda 2, y una caja que **solo** se sale contando
// el trazo, que es lo que se le escapa a quien mire la geometría.

const A_MANO = [
  {
    nombre: 'una línea de suelo en 39, como la tanda 2',
    marcado: '<path fill="none" stroke="#000" stroke-width="2.4" d="M6 39h28"/>',
    tieneQueFallar: true,
  },
  {
    nombre: 'un cuadro que cabe por geometría y no por trazo',
    marcado: '<rect x="0.4" y="8" width="39.2" height="20" fill="none" stroke="#000" stroke-width="2.4"/>',
    tieneQueFallar: true,
  },
  {
    nombre: 'la línea de suelo buena, en 37,8',
    marcado: '<path fill="none" stroke="#000" stroke-width="2.4" d="M6 37.8h28"/>',
    tieneQueFallar: false,
  },
];

function autoprueba(taller) {
  const lineas = [];
  let mal = 0;
  for (const caso of A_MANO) {
    const simbolo = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    simbolo.setAttribute('viewBox', '0 0 40 40');
    simbolo.innerHTML = caso.marcado;
    const partes = fuera(caja(pintar(simbolo, taller)));
    const falla = partes.length > 0;
    const bien = falla === caso.tieneQueFallar;
    if (!bien) mal += 1;
    lineas.push(
      `    ${bien ? 'ok' : 'x '} ${caso.nombre}: ` +
        (falla ? `se sale ${partes.join(', ')}` : 'cabe') +
        (bien ? '' : `, y tenía que ${caso.tieneQueFallar ? 'salirse' : 'caber'}`),
    );
  }
  return { lineas, mal };
}

/**
 * Que lo que se está midiendo lleve el trazo dentro.
 *
 * Una línea horizontal de 2,4 de grosor tiene 0 de alto de geometría y 2,4
 * contando el trazo. Es la comprobación que cazó que Chromium ignora
 * `{ stroke: true }`, y se queda puesta: si algún día `caja()` se «simplifica»
 * a un `getBBox()` pelado, todos los dibujos pasarían y ninguno estaría medido.
 */
function sabeContarElTrazo(taller) {
  const simbolo = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  simbolo.setAttribute('viewBox', '0 0 40 40');
  simbolo.innerHTML = '<path fill="none" stroke="#000" stroke-width="2.4" d="M10 20h20"/>';
  return Math.abs(caja(pintar(simbolo, taller)).height - 2.4) < 0.01;
}

// --------------------------------------------------------------------------

function informe(sprite, instrumentos, taller) {
  const lineas = [];
  let mal = 0;

  lineas.push('Que esta medición sabe fallar:');
  const auto = autoprueba(taller);
  lineas.push(...auto.lineas);
  mal += auto.mal;
  lineas.push('');

  if (!sabeContarElTrazo(taller)) {
    lineas.push('x lo que se está midiendo no lleva el trazo dentro: una línea de 2,4 de');
    lineas.push('  grosor no mide 2,4 de alto. Así se dejaría pasar justo lo que esto busca.');
    lineas.push('');
    lineas.push('ESTADO: NO PASA');
    return lineas.join('\n');
  }

  const simbolos = [...sprite.querySelectorAll('symbol')];
  const conocidos = new Set(instrumentos.map((i) => i.id));

  if (simbolos.length === 0) {
    lineas.push('x el sprite no trae ni un símbolo, así que aquí no se ha medido nada.');
    lineas.push('');
    lineas.push('ESTADO: NO PASA');
    return lineas.join('\n');
  }

  lineas.push(`Los ${simbolos.length} dibujos, dentro de su caja de 40 × 40:`);
  const anchos = simbolos.map((s) => (s.id || '').length);
  const ancho = Math.max(...anchos, 12);

  for (const simbolo of simbolos) {
    const id = simbolo.id || '(sin id)';
    const pega = [];

    if (!id.startsWith('i-')) {
      pega.push('el id no empieza por «i-»');
    } else if (!conocidos.has(id.slice(2))) {
      pega.push(`«${id.slice(2)}» no es ninguna pieza jugable, así que no lo enseña nadie`);
    }

    if ((simbolo.getAttribute('viewBox') || '').trim() !== '0 0 40 40') {
      pega.push(`su viewBox es «${simbolo.getAttribute('viewBox')}» y tiene que ser «0 0 40 40»`);
    }

    const b = caja(pintar(simbolo, taller));
    const partes = fuera(b);
    if (partes.length) pega.push(`se sale ${partes.join(', ')}`);

    const suelo = (b.y + b.height).toFixed(1);
    if (pega.length) {
      mal += pega.length;
      lineas.push(`  x ${id.padEnd(ancho)}  ${pega.join('; ')}`);
    } else {
      lineas.push(
        `  ok ${id.padEnd(ancho)}  ${b.width.toFixed(1)} × ${b.height.toFixed(1)}, ` +
          `apoya en ${suelo}`,
      );
    }
  }

  lineas.push('');
  lineas.push(`ESTADO: ${mal === 0 ? 'PASA' : 'NO PASA'}`);
  return lineas.join('\n');
}

async function arrancar() {
  const salida = document.getElementById('informe');
  const taller = document.getElementById('taller');
  try {
    const respuesta = await fetch(SPRITE);
    if (!respuesta.ok) throw new Error(`no se puede leer datos/iconos.svg (${respuesta.status})`);
    const sprite = new DOMParser().parseFromString(await respuesta.text(), 'image/svg+xml');
    if (sprite.querySelector('parsererror')) throw new Error('datos/iconos.svg no se puede leer');
    const datos = await cargarTodo();
    salida.textContent = informe(sprite.documentElement, datos.instrumentos, taller);
  } catch (fallo) {
    salida.textContent = `${fallo.message}\n\nESTADO: NO PASA`;
  }
  salida.dataset.estado = salida.textContent.trimEnd().endsWith('ESTADO: PASA') ? 'pasa' : 'no-pasa';
}

arrancar();
