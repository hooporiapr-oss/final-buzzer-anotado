# Hooporia

Manejo de promesas para retos con marcador automático.
Gostar Digital LLC · Puerto Rico

## Qué es, y en qué se diferencia de Cada Punto

Los dos son sistemas de manejo de promesas y los dos tienen la misma
posición: **nosotros manejamos las promesas, el programa maneja los
fondos.** Sin custodia, sin procesar pagos, licencia por evento.

La diferencia está en de dónde salen los puntos:

| | Cada Punto | Hooporia |
|---|---|---|
| Los puntos | del marcador de un juego de verdad | del juego, por jugador |
| Quién los anota | un representante del programa | el juego, mientras se juega |
| Cuándo | el día del partido | la ventana que ponga el programa |
| Dónde | en la cancha | en la cancha o en casa, desde el teléfono |
| La promesa | por punto del equipo | por punto de ese jugador |

Lo que el grupo focal prefirió de Hooporia: el marcador es automático
y por jugador. Nadie mete un número, así que no hay nada que
perseguir ni nada que discutir.

## Lo que NO cambia respecto a Cada Punto

- No recibimos dinero de nadie.
- No hay columna de pagado, y no la va a haber.
- Un solo aviso al padrino al cerrar: los puntos y su total. Sin
  enlace de pago y sin recordatorios.
- Licencia por evento, gratis hasta que cierra, facturada al cerrar y
  pagadera en siete días. Si no se paga, la licencia de ese evento
  caduca y los datos de promesas se eliminan.
- Nada de reclamos de deducibilidad de impuestos. Nunca.

## El precio

Un número, en `index.html`:

```js
const FEE = { team: 49, small: 29, under: 8 };
```

Las dos traducciones lo recogen de ahí. Cambiarlo es una línea.

## Estado

Las diecisiete páginas están hechas y desplegadas:

| | |
|---|---|
| Portada | `index.html` |
| El juego | `fortress.html`, `fortress131.html`, `fortress-vr.html` |
| El entrenador | `equipo.html`, `mi-equipo.html`, `plantilla.html` |
| El jugador y el padrino | `jugador.html`, `padrinos.html`, `prometer.html`, `tablero.html` |
| El cierre | `reporte.html`, `cobro.html` |
| Los documentos | `terms.html`, `privacy.html`, `custodia.html`, `ayuda.html` |

Todas con la piel nueva menos las tres del juego, que van oscuras a
propósito: ahí se juega.

(`scoring.html` se quitó: lo que explicaba lo dicen mejor la portada y
la ayuda, y no estaba enlazada desde ningún sitio.)

### Las pruebas

Siete suites, que se corren con `node <fichero>`:

| | |
|---|---|
| `prueba-marca.js` | que ninguna página nombre otra marca, y que todas nombren ésta |
| `prueba-index.js` | la portada |
| `prueba-documentos.js` | las cuatro hojas: custodia, términos, privacidad, cobro |
| `prueba-equipo.js` | la inscripción, con su licencia y su etiqueta de producto |
| `prueba-miequipo.js` | el panel del entrenador, en los dos idiomas |
| `prueba-ayuda.js` | las respuestas, y que no haya reclamos de impuestos |
| `prueba-reporte.js` | el reporte del evento y su CSV |

`prueba-marca.js` busca en tres vistas —lo que se ve en pantalla con
las etiquetas fuera, los valores de atributo, y el código— y comprueba
aparte que el elemento de marca de cada página diga HOOPORIA. Esa
última comprobación existe porque las otras dejaron pasar dos veces el
mismo día una marca ajena escrita en minúscula y pintada en versales
por el CSS.

`prueba-reporte-sql.sql` es el banco de pruebas del reporte contra un
Postgres de verdad, con las cifras esperadas en la cabecera.

### Lo que falta

- **El aviso al padrino.** Es lo único del flujo que no existe
  todavía. `/game-notices` en el servidor de pagos pide sesión de
  admin y un `game_id`, y no hay nada que lo llame: no hay botón en
  ninguna página. Y aunque lo hubiera, `sendGameNotice()` lee
  `game_pledges` y escribe sobre el marcador de un equipo contra un
  rival, que no es este modelo. Hace falta `/challenge-notices` y su
  remitente. Sin probar el envío de verdad: nunca se ha mandado uno.
- **`anotado-reporte.sql` sin correr.** Las dos funciones
  —`challenge_report` y `challenge_list`— están escritas y probadas
  contra un Postgres local, pero no se han creado en Supabase. Hasta
  que se corran, `reporte.html` no tiene a quién preguntar.
- **`fortress-vr.html` sin abrir en una conexión de verdad.** Carga
  THREE.js de un CDN que el contenedor donde se construyó no alcanza,
  así que esa página nunca se ha visto cargar.
- **El favicon y la imagen para compartir.** Cuando haya
  `hooporia.png` y `hooporia-share.jpg` se añaden al `<head>`; hasta
  entonces no apunta a ninguna de las dos a propósito, que un `<link>`
  a un fichero que no existe es un 404 en cada carga.

## La base de datos

El mismo proyecto de Supabase que Cada Punto: el mismo entrenador, la
misma plantilla, la misma tabla de licencias (`bw_requests`), y las
tablas de retos que ya estaban ahí con `record_official_run`.

Un jugador termina su corrida y el juego llama:

```
record_official_run(p_challenge, p_player, p_key, p_level, p_points,
                    p_time, p_game)
```

La clave de la corrida se comprueba dentro de la base de datos, así
que tener el enlace público no basta para cerrarle la corrida a otro.
