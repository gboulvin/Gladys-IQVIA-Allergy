# IQVIA Allergy

Esta integración lleva a Gladys las previsiones de salud de **IQVIA**:
alergia (polen), asma y resfriado/gripe, para uno o varios lugares de
Estados Unidos. IQVIA las publica cada día en
[pollen.com](https://www.pollen.com),
[asthmaforecast.com](https://www.asthmaforecast.com) y
[flustar.com](https://www.flustar.com), por código postal (ZIP code).

> IQVIA no vende dispositivos conectados: la integración crea un dispositivo
> «previsión» de solo lectura por previsión y lugar, que se usa como
> cualquier sensor (paneles, gráficos, escenas).

## Qué obtiene

Para cada código postal aparecen tres dispositivos en la pestaña
**Descubrimiento**:

| Dispositivo            | Funciones                                                                  |
| ---------------------- | -------------------------------------------------------------------------- |
| IQVIA pollen `ZIP`     | índice hoy, índice mañana, alérgenos de hoy, temporada de polen, tendencia |
| IQVIA asthma `ZIP`     | índice hoy, índice mañana, factores de hoy (ozono, partículas finas…)      |
| IQVIA cold & flu `ZIP` | índice hoy, índice mañana                                                  |

Cada índice va de **0 a 12**, en cinco niveles:

| Índice    | Nivel      |
| --------- | ---------- |
| 0 – 2,4   | Bajo       |
| 2,5 – 4,8 | Bajo-medio |
| 4,9 – 7,2 | Medio      |
| 7,3 – 9,6 | Medio-alto |
| 9,7 – 12  | Alto       |

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. Introduzca uno o varios **códigos postales** estadounidenses de 5
   dígitos, separados por comas (5 como máximo), p. ej. `10001, 80238`.
3. Cambie si lo desea el **intervalo de actualización** (una hora por
   defecto, 15 minutos como mínimo): IQVIA publica una nueva previsión una
   vez al día.
4. Guarde y añada los dispositivos desde la pestaña **Descubrimiento**.

El estado de conexión de la pantalla de configuración indica si IQVIA
respondió. Cada dispositivo muestra una insignia **nube**, o **inaccesible**
cuando su última lectura falló (se conservan los valores anteriores).

Al quitar un código postal, sus dispositivos dejan de actualizarse:
elimínelos de Gladys si ya no los necesita.

## Acciones

- **Probar la conexión** — lee en directo la previsión de polen de hoy de
  cada código postal y muestra el lugar y el nivel bajo el botón.
- **Actualizar las previsiones** — lee todas las previsiones ahora.

## Escenas

La integración añade sus propias tarjetas al editor de escenas (Gladys 5.1
o posterior):

**Disparadores**

- **Nivel de alergia modificado** — el nivel de hoy de una previsión cambió
  de tramo. Opcionalmente, elija el dispositivo de previsión y los nuevos
  niveles a los que reaccionar. Variables: `level`, `previous_level`,
  `index`, `forecast`, `zip_code`.
- **Nueva previsión diaria** — IQVIA publicó la previsión de un nuevo día:
  el momento de enviar una notificación matinal. Variables: `location`,
  `index_today`, `level_today`, `index_tomorrow`, `level_tomorrow`,
  `triggers`, `forecast`, `zip_code`.

Ninguno se dispara en la primera lectura tras el arranque de la
integración: todavía no hay nada con qué comparar.

**Acciones**

- **Obtener una previsión de alergia** — lee una previsión (hoy o mañana) y
  pasa `index`, `level`, `level_label` (en el idioma elegido), `triggers` y
  `location` a las acciones siguientes, p. ej. un mensaje «Polen hoy:
  {{level_label}} ({{index}}/12) — {{triggers}}».
- **Actualizar las previsiones de alergia** — lee todas las previsiones
  ahora; devuelve el número de previsiones actualizadas (`refreshed`) y
  fallidas (`failed`).

## Panel

Añada el widget **Previsión de alergia** a un panel: los índices de polen,
asma y resfriado/gripe de hoy (en directo), un gráfico de los próximos días,
los niveles, los principales alérgenos y la temporada de polen, y un botón
**Actualizar**. Su ajuste **Lugar** elige el código postal (seleccione
cualquier dispositivo de previsión del lugar); si se deja vacío, muestra el
primer código postal de la configuración.

## Solución de problemas

- **«Introduzca al menos un código postal estadounidense válido de 5
  dígitos»** — el campo está vacío o no contiene ningún código válido. IQVIA
  solo cubre Estados Unidos.
- **«ninguna previsión para este código postal»** — IQVIA respondió sin
  datos: compruebe el código en [pollen.com](https://www.pollen.com).
- **Insignia inaccesible** — IQVIA no respondió; la integración vuelve a
  intentarlo en la siguiente actualización. Consulte los registros de la
  integración (`LOG_LEVEL=debug` para el detalle de cada petición).

Las previsiones son las de los sitios públicos de IQVIA; esta integración no
está afiliada a IQVIA.
