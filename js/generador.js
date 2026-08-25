// Generar un tablero. La otra mitad de `herramientas/resolver.py`.
//
// Un tablero no se guarda: se genera desde una plantilla, un armario y una
// semilla, y de nada más. Aquí está la versión que corre en el navegador; la
// que corre en Python está en resolver.py, y las dos tienen que dar el mismo
// tablero para la misma terna.
//
// Eso no se supone. Lo comprueba `python herramientas/comparar_generadores.py`,
// que genera todos los tableros por los dos lados y compara la huella de cada
// uno. Mientras esa comprobación no existió, este era el punto exacto por el
// que el contrato de datos se podía romper en silencio: el resolvedor
// demostrando solución única sobre unos tableros y el jugador viendo otros.
//
// Por eso este archivo se lee al lado del otro y se cambia al mismo tiempo.
// Tres sitios donde es fácil separarlos sin darse cuenta:
//
//   - el orden de `sorted()`, que aquí es `ordenados()` y nunca localeCompare;
//   - el orden de `itertools.combinations`, que aquí es `combinaciones()`;
//   - cuántas veces se llama al generador, que importa tanto como el resultado.

import { fnv1a, mulberry32, barajar, ordenados } from './nucleo/azar.js';

/** No se ha podido generar el tablero. Con el motivo, que suele ser de datos. */
export class Falla extends Error {}

// El sistema del nivel 2. Una balda no es una clase entera sino un prefijo del
// código de Hornbostel-Sachs, y una pieza va a la balda más concreta que la
// admita. Lo dice la dia. 46 del Tema 7: «es un sistema jerárquico: ordena de
// lo general a lo particular».
export const ARBOL = 'hs-arbol';

// --------------------------------------------------------------------------
// El armario decide los empates
// --------------------------------------------------------------------------

/** El uso que le toca a una pieza dentro de un armario. El primero que gane. */
export function usoEn(instrumento, armario) {
  for (const u of armario.prioridad) {
    if (instrumento.usos.includes(u)) return u;
  }
  return null;
}

/**
 * El valor que toma una pieza en un sistema, o null si no lo tiene.
 *
 * Devolver null es lo que deja fuera de un tablero por familia al órgano y a
 * las ondas Martenot —tocan en una orquesta y no son de ninguna de las cuatro
 * familias— sin necesidad de una lista de excepciones.
 */
export function claveDe(instrumento, sistema, armario) {
  if (sistema === 'hs') return instrumento.hs;
  // El código entero, y no el trozo que le toque. Quien decide la balda es el
  // prefijo de la balda y no el valor de la pieza, porque la respuesta depende
  // de qué baldas haya: ver `Tablero.indiceDe()`.
  if (sistema === ARBOL) return instrumento.hs_codigo;
  if (sistema === 'uso') return usoEn(instrumento, armario);
  const familia = instrumento.familia ?? null;
  return familia === 'ninguna' ? null : familia;
}

// --------------------------------------------------------------------------
// El tablero
// --------------------------------------------------------------------------

export class Tablero {
  constructor(plantilla, armario, semilla) {
    this.plantilla = plantilla;
    this.armario = armario;
    this.semilla = semilla;
    this.sistemas = [];   // los sistemas de los ejes, en orden
    this.valores = [];    // qué valores toma cada eje, en orden de balda
    this.casillas = [];   // { claves: [...], capacidad }
    this.piezas = [];     // los instrumentos que hay que colocar
    this.rotulos = plantilla.rotulos;
    // El mismo armario con los rótulos ya dados la vuelta, o null. Es otro
    // Tablero —mismas piezas, mismas baldas, mismos tamaños— y por eso todo lo
    // que sabe jugar un tablero sabe jugar también su recambio: la pantalla
    // cambia de tablero y no de pantalla.
    this.recambio = null;
    this.mover = null;    // cuántas piezas tienen que moverse al voltear
    // Con qué piezas empieza cada balda, o null si el armario empieza vacío.
    // Solo lo llena el nivel 7: ver `desordenar()`.
    this.inicial = null;
  }

  /** Dónde va esta pieza. Un array de claves, una por eje. */
  celdaDe(pieza) {
    return this.sistemas.map((s) => claveDe(pieza, s, this.armario));
  }

  /**
   * En qué balda va esta pieza, o -1 si en ninguna.
   *
   * Se le pregunta al tablero y no a la pieza, y esa es toda la diferencia. Con
   * los demás sistemas daría igual —la clave de la pieza ya dice su balda—,
   * pero en un tablero de subniveles la respuesta depende de qué baldas haya
   * puestas: el oboe va a «De lengüeta» si esa balda está, y a «Aerófonos» si
   * no. Por eso lo que se compara no es la clave con la clave sino la pieza con
   * el tablero.
   *
   * Manda la balda más concreta, que es la del prefijo más largo. Los niveles
   * de Hornbostel-Sachs son de una cifra —111.142 es 1, luego 11, luego 111—,
   * así que un prefijo encaja si el código empieza por él, sin ambigüedad
   * posible. De eso responde `validar_catalogo.py`, que exige que la cabeza del
   * código sea cifras y puntos: lo que va detrás de un `-` o de un `+` son
   * sufijos —la gaita es `422.112-7+422.22-62`— y quedan fuera de la cuenta
   * porque van después.
   */
  indiceDe(pieza) {
    if (this.esArbol) {
      const codigo = claveDe(pieza, ARBOL, this.armario);
      let mejor = -1;
      this.casillas.forEach((casilla, i) => {
        if (!codigo.startsWith(casilla.claves[0])) return;
        if (mejor < 0 || casilla.claves[0].length > this.casillas[mejor].claves[0].length) {
          mejor = i;
        }
      });
      return mejor;
    }
    const celda = this.celdaDe(pieza).join(' ');
    return this.casillas.findIndex((c) => c.claves.join(' ') === celda);
  }

  /** ¿Este tablero rotula sus baldas con prefijos del código? */
  get esArbol() {
    return this.sistemas.length === 1 && this.sistemas[0] === ARBOL;
  }

  /**
   * ¿Está esta pieza en la balda que le toca, mirando un solo eje?
   *
   * El progreso anota por eje porque una pieza puede estar en la fila que le
   * toca y en la columna que no, que es la fricción que este juego enseña. En
   * un árbol no hay dos ejes que separar: la balda es una, y se acierta o no.
   */
  aciertaEn(pieza, iCasilla, eje) {
    if (this.esArbol) return this.indiceDe(pieza) === iCasilla;
    return this.celdaDe(pieza)[eje] === this.casillas[iCasilla].claves[eje];
  }
}

// --------------------------------------------------------------------------

/**
 * `itertools.combinations`, con su mismo orden.
 *
 * El orden importa porque el índice que sale del generador se usa para elegir
 * una subrejilla: otra enumeración daría otro tablero para la misma semilla.
 */
export function* combinaciones(lista, k) {
  const n = lista.length;
  if (k < 0 || k > n) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  yield idx.map((i) => lista[i]);
  for (;;) {
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    yield idx.map((p) => lista[p]);
  }
}

/**
 * `itertools.permutations(range(n))`, con su mismo orden.
 *
 * Deshace los empates al repartir los rótulos nuevos, así que dos órdenes
 * distintos darían dos notas distintas para el mismo tablero.
 */
export function* permutaciones(n) {
  const usados = new Array(n).fill(false);
  const actual = [];
  function* rec() {
    if (actual.length === n) {
      yield [...actual];
      return;
    }
    for (let i = 0; i < n; i++) {
      if (usados[i]) continue;
      usados[i] = true;
      actual.push(i);
      yield* rec();
      actual.pop();
      usados[i] = false;
    }
  }
  yield* rec();
}

/** Agrupa en un Map, conservando el orden de llegada como hace un dict. */
function agrupar(instrumentos, clave) {
  const grupos = new Map();
  for (const ins of instrumentos) {
    const k = clave(ins);
    if (k === null || k === undefined) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(ins);
  }
  return grupos;
}

// --------------------------------------------------------------------------
// El recambio de rótulos
// --------------------------------------------------------------------------
// La mecánica central del juego, y la única que obliga a generar de otra
// manera. Esta parte también tiene su mitad en `herramientas/resolver.py`, en
// el bloque con este mismo título.
//
// Un tablero de recambio se juega dos veces con las mismas piezas: primero con
// las baldas rotuladas por un sistema y después con **las mismas baldas**
// rotuladas por otro. Y una balda no cambia de tamaño porque le cambien la
// etiqueta, así que de ahí sale la única condición dura de esta generación:
//
//     el mismo montón tiene que agruparse en los mismos tamaños por los dos
//     sistemas, y en el mismo número de grupos.
//
// No es una limitación del código: es lo que significa que las etiquetas se den
// la vuelta. Y tiene una consecuencia buena que no se buscaba: la segunda
// vuelta no tiene montón, o sea que **cada movimiento es un intercambio**, y
// eso es lo que hace que «cuántas piezas has movido» sea un número honrado
// —quien sabe cuáles chirrían toca solo esas—.

const FORMAS = new Map();

/**
 * Las formas de llenar una balda repartiéndola entre las columnas.
 *
 * El orden es el de los bucles anidados, y tiene que ser el mismo en Python: de
 * él sale el orden de `formasDeRecambio()`, y de ese orden sale qué semilla da
 * qué tablero.
 */
export function vectoresDeBalda(disponibles, minimo, maximo) {
  const k = disponibles.length;
  const salida = [];
  const acumulado = [];
  const rec = (j, suma) => {
    if (j === k) {
      if (suma >= minimo) salida.push([...acumulado]);
      return;
    }
    for (let v = 0; v <= Math.min(disponibles[j], maximo - suma); v++) {
      acumulado.push(v);
      rec(j + 1, suma + v);
      acumulado.pop();
    }
  };
  rec(0, 0);
  return salida;
}

/**
 * Qué rótulo nuevo le toca a cada balda, y cuántas piezas se quedan quietas.
 *
 * Una balda no cambia de tamaño al cambiarle el rótulo, así que el rótulo nuevo
 * de una balda solo puede ser el de un grupo que ocupe exactamente sus huecos.
 * De los repartos que cumplen eso se coge **el que deja quietas más piezas**, y
 * de ahí sale el número con el que se puntúa este nivel: cuántas tenían que
 * moverse es el total menos ese máximo.
 *
 * Que sea el máximo no es un detalle: repartiendo los rótulos de cualquier otra
 * manera, «cuántas piezas hay que mover» mediría la etiqueta que le tocó a cada
 * balda y no dónde se contradicen los dos sistemas, que es lo único que este
 * nivel existe para enseñar.
 */
export function repartoDeRotulos(matriz, filas, columnas) {
  const k = filas.length;
  let mejor = null;
  let quietas = -1;
  for (const perm of permutaciones(k)) {
    let vale = true;
    for (let i = 0; i < k; i++) if (filas[i] !== columnas[perm[i]]) vale = false;
    if (!vale) continue;
    let cuantas = 0;
    for (let i = 0; i < k; i++) cuantas += matriz[i][perm[i]];
    if (cuantas > quietas) {
      quietas = cuantas;
      mejor = perm;
    }
  }
  return { perm: mejor, quietas };
}

const sumar = (xs) => xs.reduce((a, b) => a + b, 0);
const creciente = (xs) => [...xs].sort((a, b) => a - b);

/**
 * Todos los tableros de recambio posibles de esta plantilla y este armario.
 *
 * No depende de la semilla: la semilla solo elige uno de estos y después qué
 * piezas concretas se cogen de cada cruce. Por eso se calcula una vez por
 * pareja y se guarda —son doce en todo el juego y salen mil ochenta tableros de
 * ellas—, y por eso el orden de esta lista es parte del contrato.
 *
 * Se descarta lo que no enseña nada: un tablero donde no se quede quieta
 * ninguna pieza —los dos sistemas no coincidirían en nada— y uno donde no haya
 * que mover ninguna —coincidirían en todo—. De propina, mover una sola es
 * imposible y no hace falta prohibirlo: sin montón, la vuelta es una
 * permutación y el ciclo más corto tiene dos piezas.
 */
export function formasDeRecambio(plantilla, armario, instrumentos) {
  const sa = plantilla.ejes[0].sistema;
  const sb = plantilla.recambio;
  const baldas = plantilla.ejes[0].baldas;
  const [minimo, maximo] = plantilla.por_casilla;
  // La memoria va por lo que de verdad entra aquí y no por el id de la
  // plantilla. Con el id bastaría en el juego —una plantilla no cambia de
  // forma—, pero no en las pruebas, donde dos plantillas trucadas con el mismo
  // id se daban la misma respuesta. Una memoria cuya clave no dice de qué
  // depende acaba mintiendo.
  const memoria = `${sa}|${sb}|${baldas}|${minimo}|${maximo}|${armario.id}|${instrumentos.length}`;
  if (FORMAS.has(memoria)) return FORMAS.get(memoria);

  const cruces = new Map();
  for (const ins of instrumentos) {
    const ka = claveDe(ins, sa, armario);
    const kb = claveDe(ins, sb, armario);
    if (ka === null || kb === null) continue;
    const k = `${ka} ${kb}`;
    if (!cruces.has(k)) cruces.set(k, []);
    cruces.get(k).push(ins);
  }
  const cuantas = (x, y) => (cruces.get(`${x} ${y}`) ?? []).length;

  const claves = [...cruces.keys()].map((k) => k.split(' '));
  const va = ordenados(new Set(claves.map((k) => k[0])));
  const vb = ordenados(new Set(claves.map((k) => k[1])));
  const salida = [];

  for (const filas of combinaciones(va, baldas)) {
    for (const columnas of combinaciones(vb, baldas)) {
      const opciones = filas.map((x) =>
        vectoresDeBalda(columnas.map((y) => cuantas(x, y)), minimo, maximo),
      );
      const matriz = [];
      const rec = (i, sumaColumnas) => {
        if (i === baldas) {
          if (sumaColumnas.some((c) => c < minimo)) return;
          const sumaFilas = matriz.map(sumar);
          const a = creciente(sumaFilas);
          const b = creciente(sumaColumnas);
          if (a.some((n, j) => n !== b[j])) return;
          const { perm, quietas } = repartoDeRotulos(matriz, sumaFilas, sumaColumnas);
          if (quietas < 1 || sumar(sumaFilas) - quietas < 2) return;
          salida.push({ filas, columnas, matriz: matriz.map((f) => [...f]), perm, quietas });
          return;
        }
        for (const vector of opciones[i]) {
          const nuevas = sumaColumnas.map((c, j) => c + vector[j]);
          if (nuevas.some((c) => c > maximo)) continue;
          matriz.push(vector);
          rec(i + 1, nuevas);
          matriz.pop();
        }
      };
      rec(0, new Array(baldas).fill(0));
    }
  }

  FORMAS.set(memoria, salida);
  return salida;
}

/** Llena el tablero y le cuelga su segunda vuelta. */
function repartirConRecambio(t, plantilla, armario, instrumentos, rng) {
  const sb = plantilla.recambio;
  const formas = formasDeRecambio(plantilla, armario, instrumentos);
  if (!formas.length) {
    throw new Falla(
      `no hay ningún reparto de ${plantilla.ejes[0].baldas} baldas que se agrupe igual ` +
        `por '${t.sistemas[0]}' y por '${sb}'`,
    );
  }

  const { filas, columnas, matriz, perm } = formas[Math.floor(rng() * formas.length)];

  const cruces = new Map();
  for (const ins of instrumentos) {
    const ka = claveDe(ins, t.sistemas[0], armario);
    const kb = claveDe(ins, sb, armario);
    if (ka === null || kb === null) continue;
    const k = `${ka} ${kb}`;
    if (!cruces.has(k)) cruces.set(k, []);
    cruces.get(k).push(ins);
  }

  t.valores = [[...filas]];
  filas.forEach((x, i) => {
    t.casillas.push({ claves: [x], capacidad: sumar(matriz[i]) });
    columnas.forEach((y, j) => {
      if (matriz[i][j]) t.piezas.push(...barajar(cruces.get(`${x} ${y}`), rng).slice(0, matriz[i][j]));
    });
  });

  // La segunda vuelta es otro Tablero con las mismas baldas: misma posición y
  // mismos huecos, otro rótulo. La balda i de aquí es la balda i de allí, y de
  // eso depende que las piezas se queden donde están al voltear.
  const otro = new Tablero(plantilla, armario, t.semilla);
  otro.sistemas = [sb];
  otro.valores = [filas.map((_, i) => columnas[perm[i]])];
  otro.casillas = filas.map((_, i) => ({
    claves: [columnas[perm[i]]],
    capacidad: t.casillas[i].capacidad,
  }));
  t.recambio = otro;
  t.mover = t.piezas.length - sumar(filas.map((_, i) => matriz[i][perm[i]]));
}

// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// Los subniveles, que es el nivel 2
// --------------------------------------------------------------------------
// El borrador lo llamaba «hueco limitado»: caben tres y tienes cinco, así que
// hace falta un segundo criterio. Lo que faltaba por decidir era a dónde va la
// pieza que no cabe, porque mientras tuviera dos sitios válidos el tablero no
// tenía solución única, y resulta que no había que mandarla a ninguna parte:
// **se la lleva la balda más concreta**. La balda «Aerófonos» tiene tres huecos
// y en el montón hay cinco aerófonos; los dos que no caben están en «De
// lengüeta», que es la balda de al lado.
//
// Y no es una regla inventada para que cuadre el puzle: es la que la dia. 46 del
// Tema 7 le atribuye a esta clasificación —«es un sistema jerárquico: ordena de
// lo general a lo particular»— y la que las dia. 48 y 49 recorren entera con el
// oboe y con los platillos.

/** Qué piezas le tocan a cada balda. Manda el prefijo más largo. */
export function repartirEntreBaldas(codigos, instrumentos) {
  const montones = codigos.map(() => []);
  for (const ins of instrumentos) {
    let mejor = -1;
    codigos.forEach((c, i) => {
      if (!ins.hs_codigo.startsWith(c)) return;
      if (mejor < 0 || c.length > codigos[mejor].length) mejor = i;
    });
    if (mejor >= 0) montones[mejor].push(ins);
  }
  return montones;
}

/**
 * Los juegos de baldas que valen para un tablero de subniveles.
 *
 * Aquí no se enumeran grupos sino **conjuntos de baldas**, porque una balda ya
 * no se basta a sí misma: lo que va dentro de «Aerófonos» depende de si «De
 * lengüeta» está al lado o no. Dos reglas, y las dos son de diseño:
 *
 *   - **una balda concreta no sale sin la de su clase.** «De lengüeta» junto a
 *     «Aerófonos» es de lo general a lo particular, que es lo que esta
 *     clasificación es; «De lengüeta» sola es un rótulo que no se entiende.
 *   - **y tiene que haber al menos una balda concreta.** Tres clases enteras es
 *     el nivel 1 con otro nombre: sin una balda dentro de otra no sobra ninguna
 *     pieza en ningún sitio, o sea que no hay hueco limitado y no hace falta
 *     ningún segundo criterio.
 *
 * El orden es el de `combinaciones()` sobre el orden del archivo, que es parte
 * del contrato: de él sale qué semilla da qué tablero.
 */
export function formasDeArbol(plantilla, instrumentos) {
  const baldas = plantilla.ejes[0].baldas;
  const minimo = plantilla.por_casilla[0];
  const salida = [];
  for (const eleccion of combinaciones(plantilla.subniveles ?? [], baldas)) {
    const codigos = eleccion.map((b) => b.codigo);
    if (codigos.every((c) => c.length === 1)) continue;
    if (codigos.some((c) => c.length > 1 && !codigos.includes(c[0]))) continue;
    const montones = repartirEntreBaldas(codigos, instrumentos);
    if (montones.some((m) => m.length < minimo)) continue;
    salida.push({ codigos, montones });
  }
  return salida;
}

/** Llena un tablero de subniveles. */
function repartirPorArbol(t, plantilla, instrumentos, rng) {
  const [minimo, maximo] = plantilla.por_casilla;
  const formas = formasDeArbol(plantilla, instrumentos);
  if (!formas.length) {
    throw new Falla(
      `no hay ningún juego de ${plantilla.ejes[0].baldas} baldas de subnivel donde todas ` +
        `lleguen a ${minimo} pieza(s)`,
    );
  }

  const { codigos, montones } = formas[Math.floor(rng() * formas.length)];
  t.valores = [[...codigos]];
  codigos.forEach((codigo, i) => {
    const tope = Math.min(maximo, montones[i].length);
    const cap = minimo + Math.floor(rng() * (tope - minimo + 1));
    t.casillas.push({ claves: [codigo], capacidad: cap });
    t.piezas.push(...barajar(montones[i], rng).slice(0, cap));
  });
}

// --------------------------------------------------------------------------
// El armario que alguien ya ordenó, y mal: el nivel 7
// --------------------------------------------------------------------------
// «Es lo que pasa en un colegio real», decía el borrador. Y lo que le faltaba
// también lo decía `_pendientes`: es un tablero con estado inicial, no con las
// piezas fuera.
//
// Lo que no cambia es el puzle. La solución es la misma de siempre —cada pieza
// en su balda— y por tanto la demostración de solución única vale igual: lo que
// cambia es de dónde se parte. Por eso este nivel no toca `contarRazonando()`:
// el desorden se aplica al final, sobre un tablero ya repartido, y no puede
// convertir en dos lo que tenía una solución.
//
// Y de ahí sale lo que lo hace jugable: **el armario empieza lleno, así que no
// hay montón y cada movimiento es un intercambio**, que es exactamente la
// situación de la segunda vuelta del recambio. Se aprovecha entera, incluida la
// nota.
//
// El desorden es un ciclo entre baldas y no un revoltijo, y no es capricho: si
// dos piezas de la misma balda se cambian entre sí no ha pasado nada —siguen en
// su balda— y la nota contaría un error que no existe. Con un ciclo, cada pieza
// que se mueve acaba en una balda que no es la suya, así que «cuántas están
// mal» es exactamente cuántas se movieron.

/** Deja el armario ordenado por alguien que no sabía, y apunta cuántas falló. */
function desordenar(t, rng) {
  const inicial = t.casillas.map(() => []);
  for (const p of t.piezas) inicial[t.indiceDe(p)].push(p);

  const baldas = barajar(t.casillas.map((_, i) => i), rng);
  const cuantas = 2 + Math.floor(rng() * (t.casillas.length - 1));
  const ciclo = baldas.slice(0, cuantas);

  // Una pieza de cada balda del ciclo, y cada una a la siguiente
  const viajeras = ciclo.map((i) => barajar(inicial[i], rng)[0]);
  ciclo.forEach((i, k) => {
    inicial[i].splice(inicial[i].indexOf(viajeras[k]), 1);
  });
  for (let k = 0; k < cuantas; k++) {
    inicial[ciclo[(k + 1) % cuantas]].push(viajeras[k]);
  }

  t.inicial = inicial;
  t.mover = cuantas;
}

// --------------------------------------------------------------------------

/**
 * Un tablero sale de la plantilla, el armario y la semilla. Nada más.
 *
 * Determinista a propósito: el juego no guarda tableros, los vuelve a hacer.
 */
export function generar(plantilla, armario, instrumentos, semilla) {
  const rng = mulberry32(fnv1a(`${plantilla.id}|${armario.id}|${semilla}`));
  const [minimo, maximo] = plantilla.por_casilla;
  const t = new Tablero(plantilla, armario, semilla);
  t.sistemas = plantilla.ejes.map((e) => e.sistema);

  if (plantilla.recambio) {
    repartirConRecambio(t, plantilla, armario, instrumentos, rng);
    t.piezas = barajar(t.piezas, rng);
    t.recambio.piezas = t.piezas;
    return t;
  }

  if (t.esArbol) {
    repartirPorArbol(t, plantilla, instrumentos, rng);
  } else if (t.sistemas.length === 1) {
    const sistema = t.sistemas[0];
    const grupos = agrupar(instrumentos, (ins) => claveDe(ins, sistema, armario));
    const baldas = plantilla.ejes[0].baldas;
    let elegidos = [];

    if (plantilla.rotulos === 'ocultos') {
      // Sin rótulo, lo único que distingue una balda es cuántos huecos tiene,
      // así que las capacidades tienen que salir todas distintas. Dos baldas
      // del mismo tamaño se pueden intercambiar, y eso son dos soluciones.
      const capacidades = [];
      for (let c = maximo; c > maximo - baldas; c--) capacidades.push(c);
      const libres = barajar(ordenados(grupos.keys()), rng);
      for (const cap of capacidades) {
        // De los que quedan, el primero del orden barajado que llegue
        const i = libres.findIndex((g) => grupos.get(g).length >= cap);
        if (i < 0) {
          throw new Falla(
            `no hay grupo con ${cap} piezas para una balda; quedaban ${libres.join(', ')}`,
          );
        }
        elegidos.push([libres[i], cap]);
        libres.splice(i, 1);
      }
    } else {
      const candidatos = ordenados(grupos.keys()).filter((g) => grupos.get(g).length >= minimo);
      if (candidatos.length < baldas) {
        throw new Falla(
          `solo ${candidatos.length} grupos de '${sistema}' llegan a ${minimo} piezas ` +
            `y hacen falta ${baldas}`,
        );
      }
      for (const g of barajar(candidatos, rng).slice(0, baldas)) {
        const tope = Math.min(maximo, grupos.get(g).length);
        elegidos.push([g, minimo + Math.floor(rng() * (tope - minimo + 1))]);
      }
    }

    t.valores = [elegidos.map(([g]) => g)];
    for (const [g, cap] of elegidos) {
      t.casillas.push({ claves: [g], capacidad: cap });
      t.piezas.push(...barajar(grupos.get(g), rng).slice(0, cap));
    }
  } else {
    const [s1, s2] = t.sistemas;
    const b1 = plantilla.ejes[0].baldas;
    const b2 = plantilla.ejes[1].baldas;

    const celdas = new Map();
    for (const ins of instrumentos) {
      const k1 = claveDe(ins, s1, armario);
      const k2 = claveDe(ins, s2, armario);
      if (k1 === null || k2 === null) continue;
      const k = `${k1} ${k2}`;
      if (!celdas.has(k)) celdas.set(k, []);
      celdas.get(k).push(ins);
    }
    const dentro = (x, y) => celdas.get(`${x} ${y}`) ?? [];

    const claves = [...celdas.keys()].map((k) => k.split(' '));
    const v1 = ordenados(new Set(claves.map((k) => k[0])));
    const v2 = ordenados(new Set(claves.map((k) => k[1])));

    const posibles = [];
    for (const f of combinaciones(v1, b1)) {
      for (const c of combinaciones(v2, b2)) {
        if (f.every((x) => c.every((y) => dentro(x, y).length >= minimo))) posibles.push([f, c]);
      }
    }
    if (!posibles.length) {
      throw new Falla(`no hay ninguna subrejilla de ${b1}x${b2} con ${minimo} pieza(s) por casilla`);
    }

    const [f, c] = posibles[Math.floor(rng() * posibles.length)];
    t.valores = [[...f], [...c]];
    for (const x of f) {
      for (const y of c) {
        const disponibles = dentro(x, y);
        const tope = Math.min(maximo, disponibles.length);
        const cap = minimo + Math.floor(rng() * (tope - minimo + 1));
        t.casillas.push({ claves: [x, y], capacidad: cap });
        t.piezas.push(...barajar(disponibles, rng).slice(0, cap));
      }
    }
  }

  // Hasta aquí las piezas van agrupadas por casilla, o sea en el orden de la
  // solución, y eso en la pantalla es enseñar la respuesta: el montón saldría
  // con los aerófonos juntos. Se revuelven, y se revuelven al final para no
  // tocar la secuencia de azar de nada de lo anterior.
  t.piezas = barajar(t.piezas, rng);

  // Al final del todo, y por lo mismo que el barajado de arriba: así el
  // desorden no toca la secuencia de azar de nada de lo anterior y este nivel
  // no movió ni un tablero de los ya demostrados.
  if (plantilla.desordenado) desordenar(t, rng);
  return t;
}

// --------------------------------------------------------------------------
// Contar soluciones, sin explorar
// --------------------------------------------------------------------------

/**
 * El atajo de `contar_razonando()` en resolver.py, traducido.
 *
 * No lo necesita la partida —para eso está `corregir()`—, pero entra en la
 * huella que compara los dos generadores, y así el cruce no demuestra solo que
 * los dos reparten las mismas piezas, sino que las dos mitades están de acuerdo
 * en cuántas soluciones tiene lo que han repartido.
 */
export function contarRazonando(t) {
  if (t.rotulos === 'visibles') {
    // Cada pieza solo cabe en su casilla: o hay un reparto o no hay ninguno.
    // Se cuenta por índice de balda y no por clave, porque en un tablero de
    // subniveles la clave de una pieza no dice su balda: hay dos que le encajan
    // y manda la más concreta. Una pieza sin balda deja el tablero sin
    // solución, que es lo que tiene que pasar.
    const porBalda = new Map();
    for (const p of t.piezas) {
      const i = t.indiceDe(p);
      if (i < 0) return 0;
      porBalda.set(i, (porBalda.get(i) ?? 0) + 1);
    }
    let huecos = 0;
    for (const [i, { capacidad }] of t.casillas.entries()) {
      if ((porBalda.get(i) ?? 0) !== capacidad) return 0;
      huecos += capacidad;
    }
    return huecos === t.piezas.length ? 1 : 0;
  }

  // Sin rótulos, cada grupo entero tiene que caer en una balda, y dos baldas
  // del mismo tamaño se pueden intercambiar: eso son dos soluciones, y es justo
  // lo que hay que cazar. Aquí sí se agrupa por clave: sin rótulo no hay balda
  // a la que preguntarle, y lo que se empareja son grupos con tamaños.
  const cuenta = new Map();
  for (const p of t.piezas) {
    const k = t.celdaDe(p).join(' ');
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
  }
  const tamanosGrupo = [...cuenta.values()].sort((a, b) => a - b);
  const capacidades = t.casillas.map((c) => c.capacidad).sort((a, b) => a - b);
  if (tamanosGrupo.length !== capacidades.length) return 0;
  if (tamanosGrupo.some((n, i) => n !== capacidades[i])) return 0;

  const repetidos = new Map();
  for (const n of tamanosGrupo) repetidos.set(n, (repetidos.get(n) ?? 0) + 1);
  let total = 1;
  for (const cuantas of repetidos.values()) {
    for (let i = 2; i <= cuantas; i++) total *= i;
  }
  return total;
}

// --------------------------------------------------------------------------

/**
 * La huella de un tablero: todo lo que lo define, en una cadena.
 *
 * Existe para poder comparar el tablero de Python con el de JavaScript sin
 * depender de que los dos serialicen el JSON igual. `herramientas/resolver.py`
 * la escribe con este mismo formato, y si algún día hay que cambiarla, se
 * cambia en los dos sitios a la vez o la comparación deja de comparar.
 */
export function huella(t) {
  const casillas = t.casillas.map((c) => `${c.claves.join('+')}:${c.capacidad}`);
  const lineas = [
    `tablero=${t.plantilla.id}|${t.armario.id}|${t.semilla}`,
    `sistemas=${t.sistemas.join(',')}`,
    `rotulos=${t.rotulos}`,
    `valores=${t.valores.map((v) => v.join(',')).join(' / ')}`,
    `casillas=${casillas.join(' ')}`,
    `piezas=${t.piezas.map((p) => p.id).join(',')}`,
    `soluciones=${contarRazonando(t)}`,
  ];
  if (t.inicial) {
    // De dónde se parte es la mitad de este nivel, así que entra en la huella
    // con el orden de cada balda, y con él la nota. Un desorden que solo
    // cuadrara en Python dejaría al jugador buscando otras piezas.
    const puestas = t.inicial.map((balda) => balda.map((p) => p.id).join('+') || '-');
    lineas.push(`inicial=${puestas.join(' ')}`, `mover=${t.mover}`);
  }
  if (t.recambio) {
    // La segunda vuelta entra entera, y con ella `mover`, que es la nota de
    // este nivel. Un número que solo calculara Python no demuestra nada sobre
    // el que ve quien juega.
    const vuelta = t.recambio.casillas.map((c) => `${c.claves.join('+')}:${c.capacidad}`);
    lineas.push(
      `recambio=${t.recambio.sistemas.join(',')}`,
      `valores2=${t.recambio.valores.map((v) => v.join(',')).join(' / ')}`,
      `casillas2=${vuelta.join(' ')}`,
      `mover=${t.mover}`,
      `soluciones2=${contarRazonando(t.recambio)}`,
    );
  }
  return lineas.join('\n');
}
