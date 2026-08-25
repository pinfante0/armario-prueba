// Guardar en este navegador lo poco que el juego recuerda, y seguir jugándose
// cuando no se puede guardar.
//
// El progreso vive aquí porque el juego se publica como archivos estáticos: no
// hay servidor donde guardar nada, y no haberlo es una decisión —sin
// instalación, sin cuentas y sin datos de nadie— y no una carencia.
//
// Lo que no es evidente es cuánto falla `localStorage`. Safari en navegación
// privada deja el objeto en su sitio y lanza al escribir; un navegador con el
// almacenamiento bloqueado lanza al leerlo desde dentro de un marco; y un
// equipo de aula puede tener la cuota a cero. En los tres casos el juego tiene
// que seguir jugándose, así que aquí la avería no se propaga: se degrada a
// memoria —dura lo que dure la pestaña— y **se dice**, porque `persiste` en
// false es lo que deja a la pantalla de ajustes avisar de que lo de hoy no va a
// estar mañana. Un progreso que se pierde sin avisar es peor que no tenerlo.
//
// Esto no sabe qué se guarda. Quien conoce el esquema es `progreso.js`.

const SONDA = '__armario_sonda__';

/**
 * El `localStorage` de este navegador, si de verdad se puede usar.
 *
 * Se escribe de verdad para averiguarlo: en Safari privado el objeto existe y
 * preguntar por él no falla; lo que falla es usarlo.
 */
export function almacenDelNavegador() {
  try {
    const bruto = globalThis.localStorage;
    bruto.setItem(SONDA, '1');
    bruto.removeItem(SONDA);
    return bruto;
  } catch {
    return null;
  }
}

export class Almacen {
  #prefijo;
  #bruto;
  #memoria = new Map();

  /**
   * El segundo parámetro existe para poder pasarle uno roto desde las pruebas.
   * Un almacén que solo se degrada en el navegador de otra persona es un
   * almacén cuya degradación no ha comprobado nadie.
   */
  constructor(prefijo = 'armario.', bruto = almacenDelNavegador()) {
    this.#prefijo = prefijo;
    this.#bruto = bruto;
  }

  /** ¿Lo que se guarde hoy seguirá aquí mañana? */
  get persiste() {
    return this.#bruto !== null;
  }

  leer(clave, porDefecto = null) {
    const texto = this.#texto(clave);
    if (texto === null || texto === undefined) return porDefecto;
    try {
      return JSON.parse(texto);
    } catch {
      // Un JSON roto no se arrastra: se tira. Nadie va a poder leerlo nunca, y
      // dejarlo puesto convierte un fallo de una vez en un fallo de siempre.
      console.warn(`lo guardado en '${clave}' no se entiende; se empieza de cero`);
      this.borrar(clave);
      return porDefecto;
    }
  }

  escribir(clave, valor) {
    const texto = JSON.stringify(valor);
    if (this.#bruto) {
      try {
        this.#bruto.setItem(this.#prefijo + clave, texto);
        return true;
      } catch {
        // Cuota llena o permiso retirado a mitad de partida. Se degrada aquí
        // mismo, y a partir de ahora `persiste` dice que no.
        this.#bruto = null;
      }
    }
    this.#memoria.set(clave, texto);
    return false;
  }

  borrar(clave) {
    this.#memoria.delete(clave);
    try {
      this.#bruto?.removeItem(this.#prefijo + clave);
    } catch {
      this.#bruto = null;
    }
  }

  #texto(clave) {
    if (this.#bruto) {
      try {
        return this.#bruto.getItem(this.#prefijo + clave);
      } catch {
        this.#bruto = null;
      }
    }
    return this.#memoria.get(clave) ?? null;
  }
}
