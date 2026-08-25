// Las dos reglas que cumple **cualquier** pantalla de este juego, y cómo se
// miden. Las usan `pantalla.js` —todos los tableros— y `armazon.js` —el menú, los
// ajustes y los créditos—, y están aquí para que las dos midan lo mismo: una
// segunda copia de esto acabaría siendo una segunda definición de «cabe».
//
//   1. Que quepa. Ninguna pantalla se desplaza, y el suelo es un teléfono de
//      320 px de ancho. Es la regla que más caro salió en el proyecto hermano
//      y la que más se agradece. Se mide de dos maneras a la vez: si algún nodo
//      se sale de la caja de la pantalla, y cuánto alto pediría la pantalla si
//      no se le hubiera dicho que mida lo que la ventana. El segundo número es
//      el que dice si va justo o sobra, y es el que hay que mirar al tocar CSS.
//
//   2. Que no se escape nada. De `web/datos/` solo sale a la pantalla el campo
//      `nombre`. Lo demás es cocina, y contarlo en la interfaz es el error que
//      el proyecto hermano pagó cuatro veces. El campo peligroso es `revisar`,
//      que es una duda del profesor escrita en primera persona.
//
// Lo segundo se mira también en los atributos, y no solo en el texto: una ficha
// con su grupo en un `data-` es la respuesta escrita en el propio tablero para
// cualquiera que abra las herramientas del navegador. Y se mira leyendo el
// documento pintado y nada más —ni una variable de dentro del juego—, que es la
// única forma de que la comprobación no se crea lo que el juego dice de sí
// mismo.

const TOLERANCIA = 0.5; // píxeles, por el redondeo de los rectángulos

// El suelo tiene un número, y son estos. 320x568 es el iPhone SE de primera
// generación, que sigue siendo la pantalla más estrecha que aparece en un aula.
export const TELEFONOS = [
  [320, 568, 'el teléfono más pequeño que se sigue viendo'],
  [360, 640, 'el Android de gama baja de siempre'],
  [390, 844, 'un móvil moderno normal'],
  [414, 736, 'un móvil grande, en vertical'],
];

// Los nombres de los grupos, crudos y rotulados. Son lo que no puede aparecer
// en un tablero con las baldas sin rótulo: ahí el grupo es lo que hay que
// deducir, y escribirlo en algún sitio regala el nivel entero.
const GRUPOS_HS = [
  'idiofono',
  'membranofono',
  'cordofono',
  'aerofono',
  'electrofono',
  'Idiófonos',
  'Membranófonos',
  'Cordófonos',
  'Aerófonos',
  'Electrófonos',
];

// Campos del catálogo que no pueden viajar en un atributo, ni con buena
// intención: son la respuesta.
const ATRIBUTOS_PROHIBIDOS = [
  'data-hs',
  'data-usos',
  'data-uso',
  'data-familia',
  'data-dia',
  'data-porque',
  'data-revisar',
  'data-hs-codigo',
  'data-hs-fuente',
];

// --------------------------------------------------------------------------
// 1. Que quepa
// --------------------------------------------------------------------------

/** Cuánto se sale de su pantalla el nodo que más se sale, por cada lado. */
function desborde(pantalla) {
  const caja = pantalla.getBoundingClientRect();
  const fuera = { arriba: 0, abajo: 0, izquierda: 0, derecha: 0 };
  for (const nodo of pantalla.querySelectorAll('*')) {
    const r = nodo.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    fuera.arriba = Math.max(fuera.arriba, caja.top - r.top);
    fuera.abajo = Math.max(fuera.abajo, r.bottom - caja.bottom);
    fuera.izquierda = Math.max(fuera.izquierda, caja.left - r.left);
    fuera.derecha = Math.max(fuera.derecha, r.right - caja.right);
  }
  return fuera;
}

/**
 * Lo que la pantalla pediría si no se le hubiera dicho que mida lo que la
 * ventana. Mientras la diferencia con la ventana sea positiva, cabe; en cuanto
 * sea negativa, algo se aplasta o se sale.
 */
function altoNatural(pantalla) {
  const antes = pantalla.style.height;
  pantalla.style.height = 'auto';
  const alto = pantalla.getBoundingClientRect().height;
  pantalla.style.height = antes;
  return alto;
}

/**
 * Que ningún recurso se haya quedado más pequeño de lo que se dibujó.
 *
 * Un recurso lleva `max-width: 100%` para no ponerle un suelo de ancho a la
 * rejilla de dos ejes, y el precio de eso es que **puede encogerse**. Encogerse
 * no rompe la pantalla y no lo caza ninguna de las otras medidas: el tablero
 * cabe, no se sale nada, y los dibujos se ven un poco más pequeños. O sea que
 * es exactamente la forma de fallo cara de este proyecto, la que no se queja.
 * Por eso se compara contra `--ficha-recurso`, que es el tamaño decidido, y no
 * contra un número escrito aquí: si algún día ese tamaño cambia, esta medida
 * cambia con él.
 *
 * Desde la 6.4 mira también los `<img>`, y no por simetría: la fotografía es
 * justo la que puede encogerse por un motivo nuevo —traer tamaño propio— y
 * dejarla fuera habría dejado sin vigilar la mitad que se acaba de conectar.
 */
function recursosEncogidos(pantalla, ventana) {
  const problemas = [];
  const quiere = parseFloat(
    ventana.getComputedStyle(pantalla).getPropertyValue('--ficha-recurso'),
  );
  if (!quiere) return problemas;

  let peor = null;
  for (const nodo of pantalla.querySelectorAll('.ficha.con-recurso svg, .ficha.con-recurso img')) {
    const ancho = nodo.getBoundingClientRect().width;
    if (ancho < quiere - TOLERANCIA && (!peor || ancho < peor.ancho)) {
      peor = { ancho, pieza: nodo.closest('[data-pieza]')?.dataset.pieza ?? '?' };
    }
  }
  if (peor) {
    problemas.push(
      `el recurso de ${peor.pieza} se ha encogido a ${peor.ancho.toFixed(1)} px de ${quiere}`,
    );
  }
  return problemas;
}

// Lo ya medido en cada teléfono. El min-content de una ficha no depende del
// tablero: lo ponen el nombre de la pieza, si lleva recurso y en qué sitio del
// armario está. Sin esto, medirlo en los 1440 tableros por tres estados serían
// cuatrocientas mil reflows para responder cincuenta y nueve veces lo mismo, y
// una comprobación que tarda es una comprobación que se acaba quitando.
const medidos = new WeakMap();

function yaMedido(ventana, clave) {
  let vistas = medidos.get(ventana.document);
  if (!vistas) medidos.set(ventana.document, (vistas = new Set()));
  if (vistas.has(clave)) return true;
  vistas.add(clave);
  return false;
}

/**
 * Que meter el recurso en la ficha **no le suba el min-content**.
 *
 * Es la comprobación que la entrega 6.4 no podía no traer, porque es el fallo
 * que este proyecto ya ha pagado dos veces y las dos **sin que nada se quejara**:
 * la ficha lleva `overflow: hidden`, así que lo que sobra se recorta en
 * silencio, y lo único que se ve es que un tablero de dos ejes pide más ancho
 * del que hay. En la tanda 1 fueron 330 px de los 320, y la causa —el texto
 * «[object SVGSVGElement]» metido en la ficha— se encontró **midiendo el
 * min-content de cada trozo**, después de dos hipótesis falsas.
 *
 * Y vuelve a hacer falta ahora porque **un `<img>` sí trae tamaño propio**: sin
 * `width`, una fotografía mide 512 px, y en la rejilla el mínimo de una columna
 * `1fr` es el min-content de su celda. El síntoma sería el mismo de la tanda 1 y
 * la causa otra.
 *
 * Se mide comparando la ficha consigo misma: una copia con el recurso dentro y
 * otra sin él, las dos a `width: min-content`. Contra un número escrito aquí no
 * valdría —el min-content de una ficha lo pone el nombre más largo que le toque—
 * y contra la ficha de al lado tampoco. Contra sí misma, la pregunta es
 * exactamente la que hay que hacer: **¿el recurso ensancha la ficha?**
 *
 * La copia va en un contenedor absoluto dentro de la misma pantalla para que
 * herede las mismas variables y la misma fuente, y se saca de ahí en cuanto se
 * ha leído: medir no puede cambiar lo que se está midiendo.
 */
function minContenidoDeMas(pantalla, ventana) {
  const problemas = [];
  let peor = null;

  for (const ficha of pantalla.querySelectorAll('.ficha.con-recurso')) {
    const sitio = ficha.closest('.monton') ? 'monton' : ficha.closest('.rejilla') ? 'rejilla' : 'balda';
    const pieza = ficha.dataset.pieza ?? '?';
    const recurso = ficha.querySelector('img') ? 'img' : 'svg';
    if (yaMedido(ventana, `${pieza}|${sitio}|${recurso}`)) continue;

    // El banco va **dentro del padre de la ficha** y no colgando de la pantalla,
    // porque hay reglas que dependen de dónde está: `.monton .ficha` es una de
    // ellas. Absoluto y fuera de la vista, así que no mueve nada de lo que se
    // está midiendo.
    const banco = ventana.document.createElement('div');
    banco.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;';
    ficha.parentElement.append(banco);

    const ancho = (conRecurso) => {
      const copia = ficha.cloneNode(true);
      if (!conRecurso) copia.querySelectorAll('svg, img').forEach((n) => n.remove());
      copia.style.width = 'min-content';
      copia.style.flex = 'none';
      banco.replaceChildren(copia);
      return copia.getBoundingClientRect().width;
    };

    const con = ancho(true);
    const sin = ancho(false);
    banco.remove();

    if (con > sin + TOLERANCIA && (!peor || con - sin > peor.cuanto)) {
      peor = { cuanto: con - sin, con, sin, pieza, recurso };
    }
  }

  if (peor) {
    problemas.push(
      `${peor.recurso === 'img' ? 'la fotografía' : 'el dibujo'} de ${peor.pieza} le sube ` +
        `el min-content a la ficha: ${peor.con.toFixed(1)} px con el recurso y ` +
        `${peor.sin.toFixed(1)} px sin él`,
    );
  }
  return problemas;
}

/**
 * Que los recursos de una misma balda apoyen a la misma altura.
 *
 * Es la otra mitad de la línea de suelo común, y la mitad que no se ve desde el
 * preparador: de nada sirve que el archivo deje la pieza apoyada en el mismo
 * sitio de su lienzo si en la pantalla las cajas no están a la misma altura.
 *
 * Y no lo estaban. Las fichas de una balda se estiran todas al alto de la más
 * alta, y una ficha con recurso centraba su contenido, así que **una pieza con
 * el nombre en dos líneas bajaba su recurso media línea** respecto de la de al
 * lado. Medido en 320×568 eso son unos 5 px sobre una caja de 34, o sea **más
 * que los 3,8 px que separan al violín de la viola**: la escalera que la 6.2
 * midió para que los cuatro arcos se leyeran se la comía la maquetación.
 *
 * Se arregla anclando el recurso arriba en vez de centrar el contenido, y esta
 * medida es lo que impide que vuelva sin avisar.
 */
function recursosDesalineados(pantalla) {
  const problemas = [];
  let peor = null;

  for (const balda of pantalla.querySelectorAll('.huecos')) {
    const cajas = [...balda.querySelectorAll(':scope > .ficha.con-recurso > svg, :scope > .ficha.con-recurso > img')]
      .map((n) => ({ pieza: n.closest('[data-pieza]')?.dataset.pieza ?? '?', abajo: n.getBoundingClientRect().bottom }));
    if (cajas.length < 2) continue;
    // En la rejilla los huecos van en columna, así que ahí no hay ninguna línea
    // de suelo que compartir: cada ficha va debajo de la anterior.
    if (balda.closest('.rejilla')) continue;
    const alta = cajas.reduce((a, b) => (a.abajo < b.abajo ? a : b));
    const baja = cajas.reduce((a, b) => (a.abajo > b.abajo ? a : b));
    const cuanto = baja.abajo - alta.abajo;
    if (cuanto > TOLERANCIA && (!peor || cuanto > peor.cuanto)) {
      peor = { cuanto, alta: alta.pieza, baja: baja.pieza };
    }
  }

  if (peor) {
    problemas.push(
      `en una balda ${peor.alta} apoya ${peor.cuanto.toFixed(1)} px más arriba que ${peor.baja}`,
    );
  }
  return problemas;
}

export function medir(pantalla, ventana) {
  const caja = pantalla.getBoundingClientRect();
  const sobra = Math.round(ventana.innerHeight - altoNatural(pantalla));
  const fuera = desborde(pantalla);
  const problemas = [
    ...recursosEncogidos(pantalla, ventana),
    ...minContenidoDeMas(pantalla, ventana),
    ...recursosDesalineados(pantalla),
  ];

  if (caja.height > ventana.innerHeight + TOLERANCIA) {
    problemas.push(
      `la pantalla mide ${Math.round(caja.height)} px de alto y la ventana ${ventana.innerHeight}`,
    );
  }
  if (ventana.document.documentElement.scrollWidth > ventana.innerWidth + TOLERANCIA) {
    problemas.push(
      `el documento se desplaza de lado: ${ventana.document.documentElement.scrollWidth} px`,
    );
  }
  if (sobra < 0) problemas.push(`pide ${-sobra} px más de alto de los que hay`);
  for (const [lado, cuanto] of Object.entries(fuera)) {
    if (cuanto > TOLERANCIA) problemas.push(`se sale ${Math.ceil(cuanto)} px por ${lado}`);
  }
  return { problemas, sobra };
}

// --------------------------------------------------------------------------
// 2. Que no se escape nada
// --------------------------------------------------------------------------

/**
 * El documento pintado, con los `src` reducidos a su nombre de archivo.
 *
 * Esto no es una comodidad: sin ello **esta comprobación es intermitente**, y se
 * descubrió al conectar las fotografías. El `src` de un `<img>` es una URL
 * absoluta, o sea que mete en el documento el origen entero —`http://localhost`
 * y **el puerto**, que aquí es aleatorio en cada pasada—; y `hs_codigo` se busca
 * como subcadena y el de las ondas Martenot y el theremín es **«53»**, el del
 * teclado **«54»**. Un puerto que lleve un 53 dentro hacía fallar los 1440
 * tableros diciendo que se escapa una clasificación que no se escapa. Pasó: dos
 * pasadas seguidas del mismo código, una en verde y otra en rojo.
 *
 * Antes de la 6.4 no había ni una URL en la pantalla —un dibujo se referencia
 * con `#i-violin`, que es un fragmento— así que la debilidad estaba y no la
 * tocaba nadie. Se queda el nombre del archivo, que es lo único del `src` que
 * habla de la pieza, y se van el origen y el resto de la ruta. Y esto hay que
 * tenerlo delante en la 6.8: si el archivo único incrusta las fotografías como
 * `data:`, el `src` pasa a ser un megabyte de base64 y **cualquier subcadena
 * corta aparece siempre**.
 */
function pintado(pantalla) {
  return pantalla.outerHTML.replace(
    /\ssrc="([^"]*)"/g,
    // En el archivo único una fotografía es un data: de base64. No habla de
    // la pieza ni puede entrar en la búsqueda de fugas: una subcadena corta
    // como «53» aparecería estadísticamente en cualquier bloque grande.
    (_, url) => ` src="${url.startsWith('data:') ? '[recurso-incrustado]' : url.split(/[/?#]/).pop()}"`,
  );
}

export function fugas(pantalla, instrumentos) {
  const html = pintado(pantalla);
  const problemas = [];

  for (const atributo of ATRIBUTOS_PROHIBIDOS) {
    if (html.includes(`${atributo}=`)) problemas.push(`hay un atributo ${atributo}`);
  }

  // Nada de la cocina del catálogo, de ninguna pieza. Da igual que la pieza
  // esté o no en esta pantalla: en la pantalla no pinta nada.
  for (const ins of instrumentos) {
    for (const campo of ['revisar', 'porque', 'hs_codigo', 'hs_fuente']) {
      const valor = ins[campo];
      if (typeof valor === 'string' && valor && html.includes(valor)) {
        problemas.push(`sale el '${campo}' de ${ins.nombre}: «${valor.slice(0, 50)}…»`);
      }
    }
  }

  // Y de las piezas que sí están, su clasificación no puede ir pegada a ellas.
  for (const nodo of pantalla.querySelectorAll('[data-pieza]')) {
    const pieza = instrumentos.find((i) => i.id === nodo.dataset.pieza);
    if (!pieza) {
      problemas.push(`hay una ficha '${nodo.dataset.pieza}' que no está en el catálogo`);
      continue;
    }
    for (const dato of [pieza.hs, ...pieza.usos, pieza.familia].filter(Boolean)) {
      if (pintado(nodo).includes(dato)) {
        problemas.push(`la ficha de ${pieza.nombre} lleva encima su '${dato}'`);
      }
    }
  }

  // Con las baldas sin rótulo, el grupo es lo que hay que deducir.
  const armario = pantalla.querySelector('.sin-rotulo') && pantalla.querySelector('.armario');
  if (armario) {
    for (const nombre of GRUPOS_HS) {
      if (pintado(armario).includes(nombre)) {
        problemas.push(`las baldas van sin rótulo y en el armario pone '${nombre}'`);
      }
    }
  }

  return problemas;
}
