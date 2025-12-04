# Requerimientos de la aplicación de Robotinto

## 1. Contexto general
- La aplicación muestra un entorno con los 8 planetas del sistema solar.
- Robotinto viaja a los planetas, lee sensores, decide cómo protegerse y aprende entre generaciones para mejorar sus decisiones.

## 2. Actores principales
- **Usuario (estudiante / jugador):** observa misiones, elige planetas, inicia exploraciones y monitorea el aprendizaje.
- **Robotinto:** recibe datos de sensores, activa o no sistemas de protección, puede fallar si no se protege y registra todo en el LOG.
- **Entorno / Planetas:** cada planeta tiene temperatura (°C), gravedad (m/s² o escala), humedad (% o escala), radiación (baja/media/alta u otra unidad) y vida extraterrestre (sí/no).

## 3. Sensores de Robotinto (valores visibles por misión)
- **Temperatura:** muestra °C y se clasifica como baja/moderada/extrema.  
  Ejemplo LOG: `Temperatura detectada: 420°C (peligro extremo para las ruedas)`
- **Gravedad:** muestra valor relativo (m/s² o 0–10) y señala muy baja / normal / muy alta.  
  Ejemplo LOG: `Gravedad detectada: 3.2 g (riesgo de aplastamiento de la estructura)`
- **Vida extraterrestre (binario):** sí / no, con mensajes de protocolo.  
  Ejemplo LOG: `Vida extraterrestre: DETECTADA – recomendación: proceder con cautela`
- **Humedad:** muestra %, indica riesgo de corrosión/cortocircuitos/problemas en sensores.  
  Ejemplo LOG: `Humedad detectada: 95% (alto riesgo de condensación en circuitos)`
- **Radiación:** nivel en unidades o baja/media/alta/letal; indica si es segura o peligrosa.  
  Ejemplo LOG: `Radiación detectada: MUY ALTA – riesgo de destrucción de circuitos`

## 4. Sistemas de protección de Robotinto (estado visible en el LOG)
- **Protección térmica de ruedas:** sin protección en calor extremo, las ruedas se dañan y la misión puede fallar. Con protección activa a tiempo, las resiste.  
  - Sin protección: `Temperatura extrema detectada. Ruedas sin protección. Las ruedas se derriten. MISIÓN FALLIDA.`  
  - Con protección: `Sistema de protección térmica ACTIVADO. Las ruedas resisten la temperatura extrema.`
- **Protección contra radiación:** sin protección en radiación alta, los circuitos se destruyen. Con escudo activo, sobrevive.  
  - Sin protección: `Radiación letal detectada. Sin protección activa. Circuitos destruidos. MISIÓN FALLIDA.`  
  - Con protección: `Radiación alta detectada. Activando escudo anti-radiación. Sistemas protegidos.`
- **Adaptación a la gravedad:** ajusta a gravedades muy altas o muy bajas. Sin él, colapsa o pierde tracción; con él, se estabiliza.  
  - Sin protección: `Gravedad extrema sin adaptación. Robotinto pierde estabilidad. MISIÓN COMPLICADA.`  
  - Con protección: `Activando sistema de adaptación gravitacional. Movilidad estabilizada.`
- **Protección frente a humedad:** evita cortocircuitos en humedad crítica.  
  - Sin protección: `Humedad crítica sin sellado. Se produce cortocircuito. MISIÓN FALLIDA.`  
  - Con protección: `Sellado antihumedad activado. Componentes protegidos.`
- **Protocolo ante vida extraterrestre (comportamental):** si detecta vida, ajusta su conducta (p. ej., reduce movimiento, evita zonas).  
  - Ejemplo: `Vida extraterrestre detectada. Cambiando a protocolo de exploración pasiva.`

## 5. Mecanismo de aprendizaje por generaciones
- **Primeras generaciones (fallos):** Gen 1 llega sin experiencia, no activa protecciones adecuadas, sufre daños y falla. Registra la experiencia.  
  Ejemplo:  
  `GEN 1 – Llegando a Marte...`  
  `Temperatura detectada: 350°C. Protección térmica: DESACTIVADA.`  
  `Las ruedas se derriten. MISIÓN FALLIDA.`  
  `Guardando experiencia de la Gen 1...`
- **Generaciones siguientes (aprendizaje):** Gen 2+ usa historial, activa sistemas antes del aterrizaje y evita errores previos.  
  Ejemplo:  
  `GEN 2 – Llegando al mismo planeta que la Gen 1.`  
  `Historial indica temperatura extrema en este planeta.`  
  `Activando protección térmica ANTES del aterrizaje.`  
  `Las ruedas permanecen intactas. Exploración continua.`
- **Umbrales y decisiones:** Robotinto ajusta umbrales de peligro (temperatura, radiación, humedad, gravedad) y lo refleja en el LOG.  
  Ejemplo: `Actualizando umbral de radiación segura basado en experiencia previa. Nuevo umbral: radiación > 70 => activar escudo.`

## 6. Interfaz visual / pantalla del LOG
- **Estilo:** pantalla retro tipo terminal; fondo verde oscuro; fuente Google VT323; estética pixel art / consola.
- **Contenido del LOG:** línea por línea muestra planeta seleccionado, generación actual, valores de sensores al llegar, decisiones de protección, consecuencias (éxito/falla/daño), y mensajes de aprendizaje.  
  Ejemplo:  
  `GEN 3 | PLANETA: Júpiter`  
  `Sensores iniciales -> Temp: 200°C | Gravedad: 2.5g | Humedad: 30% | Radiación: alta`  
  `Decisión: Activar protección térmica y anti-radiación antes del aterrizaje.`  
  `Resultado: Robotinto aterriza con éxito y puede explorar.`  
  `Aprendizaje almacenado: Júpiter = alta radiación + alta gravedad.`
- **Evolución en el tiempo:** visualizar misiones consecutivas con GEN 1, GEN 2, GEN 3..., resultados y cambios de comportamiento.
- **Opciones mínimas para el usuario:** seleccionar planeta a explorar; lanzar nueva misión/nueva generación; (opcional) ver resumen de aprendizajes por planeta.

## 7. Historias de usuario resumidas
- Selección de planeta: elegir uno de los 8 planetas y lanzar misión para observar el comportamiento de Robotinto.
- Visualización de sensores: ver en el LOG los valores de temperatura, gravedad, humedad, radiación y vida.
- Fallo por falta de protección: primeras generaciones pueden fallar (ruedas derretidas, circuitos destruidos) para mostrar falta de experiencia.
- Aprendizaje inter-generacional: generaciones siguientes activan protecciones antes del aterrizaje basadas en experiencias previas.
- Umbrales de peligro: Robotinto ajusta umbrales de peligro para tomar decisiones de protección más acertadas.
- Pantalla tipo terminal retro: toda la información se muestra en pantalla retro con fondo verde y fuente VT323.
- Resumen de generaciones: ver en el LOG o en un resumen el resultado de cada generación (planeta, fallos, decisiones) para entender la evolución.
