# Plan de desarrollo – **Robotinto explorador**

Este documento está pensado para trabajar con **Codex** paso a paso.  
Cada sección tiene:

- 🎯 **Objetivo**
- 💻 **Prompt para Codex**
- ✅ **Pruebas manuales sugeridas**

> Supuestos:
> - Proyecto creado desde `phaserjs/template-nextjs` con TypeScript.
> - Assets ya existentes:
>   - Íconos para el menú: `public/assets/main screen/planets/*.png`
>   - Sprites para las escenas: `public/assets/planets/*.png`
>   - Fondo genérico: `public/assets/bg.png`
> - El juego se llama **"Robotinto explorador"**.


---

## 1. Limpieza inicial del template y renombrado del juego

### 🎯 Objetivo

Dejar el template funcionando con una sola escena básica y el nombre del juego correcto: **"Robotinto explorador"**.

### 💻 Prompt para Codex

> **Requerimiento 1 – Setup inicial y renombrado**  
> Estás trabajando en un proyecto basado en el template `phaserjs/template-nextjs` con TypeScript.  
> 1. Cambia el título de la app y del juego a **"Robotinto explorador"** en todos los lugares relevantes:
>    - Título del documento HTML.
>    - Cualquier texto visible inicial que diga el nombre del juego.
> 2. Deja solo una escena de Phaser principal (puede llamarse `RobotintoScene` o `MainScene`) y elimina escenas de demo que no se usen.  
> 3. Asegúrate de que el juego compile y la escena cargue sin errores, mostrando algo muy simple como el texto centrado `"Robotinto explorador"` en el canvas.  
> 4. No toques todavía la integración con React ni el `EventBus`, solo limpia y deja el template funcionando.

### ✅ Pruebas manuales

- Ejecutar `npm run dev`.
- Ver en el navegador:
  - Título de pestaña: “Robotinto explorador”.
  - Canvas de Phaser con un texto grande “Robotinto explorador”.
- Confirmar en consola que no hay errores de escenas faltantes.


---

## 2. Modelo de dominio: planetas, sensores y conocimiento (con `hasSurface`)

### 🎯 Objetivo

Definir tipos básicos y datos estáticos de los 8 planetas, incluyendo si tienen o no superficie sólida, y el modelo de “conocimiento” que Robotinto irá aprendiendo.

### 💻 Prompt para Codex

> **Requerimiento 2 – Dominio de planetas y conocimiento**  
> Crea un archivo `src/game/domain.ts` con lo siguiente:  
>   
> 1. Define un tipo `PlanetId` como unión literal:
>    ```ts
>    export type PlanetId =
>      | "MERCURY"
>      | "VENUS"
>      | "EARTH"
>      | "MARS"
>      | "JUPITER"
>      | "SATURN"
>      | "URANUS"
>      | "NEPTUNE";
>    ```  
> 2. Define una interfaz `Planet` con estos campos:
>    ```ts
>    export interface Planet {
>      id: PlanetId;
>      name: string;
>      temperatureC: number;
>      gravityG: number;
>      humidity: number;     // 0–100
>      radiation: number;    // 0–100
>      hasLife: boolean;
>      hasSurface: boolean;  // true si tiene superficie sólida, false si es gaseoso
>    }
>    ```  
> 3. Exporta un array `PLANETS: Planet[]` con valores razonables para cada planeta.  
>    - Mercurio, Venus, Tierra, Marte → `hasSurface: true`.  
>    - Júpiter, Saturno, Urano, Neptuno → `hasSurface: false`.  
> 4. Define una interfaz `PlanetKnowledge` para el aprendizaje:
>    ```ts
>    export interface PlanetKnowledge {
>      temperatureThreshold: number;
>      radiationThreshold: number;
>      gravityThreshold: number;
>      humidityThreshold: number;
>      failures: number;
>      successes: number;
>    }
>    ```  
> 5. Define:
>    ```ts
>    export type KnowledgeState = Record<PlanetId, PlanetKnowledge>;
>    ```  
> 6. Crea y exporta una función:
>    ```ts
>    export function createInitialKnowledgeState(): KnowledgeState { ... }
>    ```  
>    que inicialice el estado con:
>    - Umbrales **demasiado laxos** (por ejemplo, temperaturaThreshold altísimo, etc.) para que la primera generación tienda a fallar.
>    - `failures = 0`, `successes = 0` para todos los planetas.  
> 7. Asegúrate de que estos tipos funcionen bien con TypeScript y puedan importarse desde escenas de Phaser y componentes React.

### ✅ Pruebas manuales

- Importar `PLANETS` y `createInitialKnowledgeState()` temporalmente en algún archivo y hacer un `console.log`.
- Verificar que:
  - Hay 8 planetas.
  - Los gigantes gaseosos tienen `hasSurface: false`.
  - La función de conocimiento devuelve un objeto con 8 claves, una por planeta.


---

## 3. Escena `RobotintoScene`: simulación básica de misiones

### 🎯 Objetivo

Crear la escena principal que simula una misión de Robotinto en un planeta, con generación y conocimiento interno (por ahora solo usando `console.log`).

### 💻 Prompt para Codex

> **Requerimiento 3 – Escena RobotintoScene y ciclo de misión**  
> Crea una escena de Phaser llamada `RobotintoScene` en `src/game/scenes/RobotintoScene.ts` con estos requisitos:  
> 1. Importa desde `src/game/domain.ts`: `PLANETS`, `Planet`, `PlanetId`, `KnowledgeState`, `createInitialKnowledgeState`.  
> 2. La escena debe tener propiedades:
>    ```ts
>    private currentPlanet: Planet | null;
>    private currentGeneration: number;
>    private knowledge: KnowledgeState;
>    ```  
>    Inicializa `currentGeneration` en 0 y `knowledge` con `createInitialKnowledgeState()`.  
> 3. Implementa un método público:
>    ```ts
>    public startMission(planetId: PlanetId): void
>    ```  
>    que:
>    - Busque el planeta correspondiente en `PLANETS`.
>    - Aumente `currentGeneration`.
>    - Llame a un método privado `runMissionForPlanet(planet: Planet)`.  
> 4. En `runMissionForPlanet(planet)`:
>    - Lee los “sensores” usando directamente las propiedades del planeta.  
>    - Recupera el objeto `PlanetKnowledge` correspondiente.  
>    - Genera un resultado simple:
>      - Si la temperatura del planeta > `temperatureThreshold` y **no hay lógica de protección aún**, considera que la misión falla por temperatura.  
>      - Similar para radiación, gravedad y humedad.  
>    - Actualiza `failures` o `successes` según corresponda.  
>    - Por ahora usa `console.log` para mostrar:
>      - Generación.
>      - Planeta.
>      - Lectura de sensores.
>      - Motivo de fallo o éxito.  
> 5. Integra esta escena en el sistema de escenas de Phaser para que se cargue como escena principal.

### ✅ Pruebas manuales

- Hacer una llamada manual a `startMission("MARS")` desde donde sea posible (por ejemplo, temporalmente en `create`).
- Ver en consola:
  - El número de generación incrementándose.
  - Los logs de sensores y resultado.
- Ejecutar varias misiones seguidas al mismo planeta y confirmar que `failures` o `successes` cambian.


---

## 4. Integración con EventBus: LOG en lugar de `console.log`

### 🎯 Objetivo

Usar `EventBus` para mandar mensajes a React en lugar de `console.log`, y notificar cambios de generación y planeta.

### 💻 Prompt para Codex

> **Requerimiento 4 – EventBus y eventos de log**  
> Modifica `RobotintoScene` para usar el `EventBus`:  
> 1. Importa `EventBus` desde el archivo correspondiente del template (normalmente `src/game/EventBus.ts`).  
> 2. Crea un método privado:
>    ```ts
>    private log(message: string): void {
>      EventBus.emit("log-line", message);
>    }
>    ```  
> 3. Sustituye todos los `console.log` de la misión por llamadas a `this.log(...)`.  
> 4. Cuando cambie la generación (en `startMission`), emite además:
>    ```ts
>    EventBus.emit("generation-changed", this.currentGeneration);
>    ```  
> 5. Cuando comience misión para un planeta, emite:
>    ```ts
>    EventBus.emit("planet-changed", planet.id);
>    ```  
> 6. No elimines aún todos los `console.log` si son necesarios para depuración, pero prioriza el uso del `log()`.

### ✅ Pruebas manuales

- Confirmar en consola de React (cuando tengamos UI) que se reciben eventos.
- De momento, verificar que el juego sigue corriendo sin errores al usar `EventBus`.


---

## 5. Panel de LOG retro en React + fuente VT323

### 🎯 Objetivo

Mostrar en la pantalla un panel de LOG con fondo verde y fuente VT323, alimentado por los eventos `log-line`.

### 💻 Prompt para Codex

> **Requerimiento 5 – Componente LogPanel**  
> En la parte React del proyecto:  
> 1. Crea un componente `LogPanel` en `src/components/LogPanel.tsx` que:  
>    - Importe `EventBus`.  
>    - Mantenga un estado `lines: string[]`.  
>    - Se suscriba a `EventBus.on("log-line", (msg) => ...)` en un `useEffect`.  
>    - Agregue cada nuevo mensaje al final del array `lines`.  
>    - Muestre las líneas dentro de un `<div>` con overflow vertical (scroll) y altura fija.  
>    - Desuscriba el listener en cleanup del `useEffect`.  
> 2. En el CSS global, importa la fuente `VT323` desde Google Fonts y crea una clase `.retro-log` con:  
>    - `background-color` verde oscuro.  
>    - `color` verde claro.  
>    - `font-family: "VT323", monospace;`  
>    - padding y line-height cómodo.  
> 3. Aplica la clase `.retro-log` al `<div>` principal del `LogPanel`.  
> 4. En la página principal (ej. `src/pages/index.tsx`), muestra:  
>    - El componente `<PhaserGame />` con el canvas.  
>    - El `<LogPanel />` al lado o abajo (por ejemplo, usando un layout con flexbox).

### ✅ Pruebas manuales

- Lanzar una misión (aunque sea programáticamente).
- Ver que las líneas del LOG aparecen en el panel con estilo terminal verde.
- Confirmar que al recargar la página, el panel se reinicia.


---

## 6. Menú de selección de planetas (con íconos) + envío de evento a Phaser

### 🎯 Objetivo

Permitir al usuario elegir un planeta con un menú visual de planetas clickeables, usando los assets ya existentes.

### 💻 Prompt para Codex

> **Requerimiento 6 – PlanetSelector y comunicación con la escena**  
> 1. Crea un componente `PlanetSelector` en `src/components/PlanetSelector.tsx`.  
> 2. Importa `PLANETS` desde `src/game/domain.ts`.  
> 3. Muestra los planetas en un grid (por ejemplo 2 filas x 4 columnas).  
>    - Para cada planeta, muestra:
>      - Un `<button>` o `<div>` clickeable.
>      - La imagen correspondiente desde: `"/assets/main screen/planets/{nombre-en-minusculas}.png"` (puedes mapear `PlanetId` a nombre de archivo).  
>      - El nombre del planeta abajo.  
> 4. Al hacer click en un planeta, emite:
>    ```ts
>    EventBus.emit("start-mission", planet.id);
>    ```  
> 5. En la parte Phaser, modifica donde se crea `RobotintoScene` para que escuche este evento:
>    ```ts
>    EventBus.on("start-mission", (planetId: PlanetId) => {
>      scene.startMission(planetId);
>    });
>    ```  
> 6. Integra `<PlanetSelector />` en la página principal junto a `<PhaserGame />` y `<LogPanel />`.

### ✅ Pruebas manuales

- Ver el menú con los 8 planetas y sus íconos.
- Clicar en un planeta y comprobar que:
  - Se lanza una misión (ver en LOG).
  - Cambia la generación y el planeta.


---

## 7. Lógica de aprendizaje por generaciones (incluyendo planetas sin superficie)

### 🎯 Objetivo

Mejorar `runMissionForPlanet` para que:

- Use umbrales de `PlanetKnowledge`.
- Tenga en cuenta `hasSurface`.
- Ajuste umbrales según fallos.

### 💻 Prompt para Codex

> **Requerimiento 7 – Aprendizaje y protocolo para planetas sin superficie**  
> Mejora `runMissionForPlanet(planet: Planet)` en `RobotintoScene` con esta lógica:  
> 1. Obtén el `PlanetKnowledge` actual:  
>    ```ts
>    const k = this.knowledge[planet.id];
>    ```  
> 2. Si `planet.hasSurface === false`:  
>    - Emite un log tipo:
>      - `"Este planeta no tiene superficie sólida. Protocolo extremo activado."`  
>    - Considera la misión como fracaso por defecto **o** como un caso especial si quieres, pero registra al menos un fallo (`failures++`).  
>    - Ajusta algún umbral (por ejemplo, `gravityThreshold` o `radiationThreshold`) para que quede claro que es extremadamente hostil.  
>    - Retorna después de loguear, sin seguir el flujo normal.  
> 3. Si `planet.hasSurface === true`:  
>    - Decide activación de protecciones en base a los umbrales:
>      - Si `planet.temperatureC > k.temperatureThreshold` ⇒ **debería activar protección térmica**.  
>      - Igual para radiación, gravedad y humedad.  
>    - Genera logs describiendo estas decisiones:
>      - `"Temperatura detectada X°C > umbral Y°C. Activando protección térmica."`  
>      - `"Radiación dentro de rango seguro. No se activa escudo."`  
>    - Determina fallo si alguna condición es muy extrema y **no** estaba la protección “activa”.  
> 4. Si hay fallo:
>    - `k.failures++`.  
>    - Ajusta el umbral correspondiente acercándolo al valor del planeta (por ejemplo: nuevo umbral = `planet.temperatureC - 10`).  
>    - Emite log tipo:
>      - `"Misión fallida por temperatura. Ajustando umbral de temperatura para la próxima generación."`  
> 5. Si no hay fallo:
>    - `k.successes++`.  
>    - Emite log de misión exitosa.  
> 6. Asegúrate de que la escena use siempre `this.log(...)` para describir todo el flujo.

### ✅ Pruebas manuales

- Repetir varias misiones en el mismo planeta:
  - Confirmar que al principio falle.
  - Luego ver en el LOG cómo se ajustan umbrales y se empieza a tener éxito.
- Probar con Júpiter/Saturno/Urano/Neptuno:
  - Ver que el LOG indica que no hay superficie y se activa protocolo extremo.


---

## 8. Integrar fondos cenitales y sprites de planetas en la escena

### 🎯 Objetivo

Usar las imágenes cenitales y sprites ya existentes para que la escena muestre visualmente el planeta que se está explorando.

### 💻 Prompt para Codex

> **Requerimiento 8 – Fondos y sprites dentro de RobotintoScene**  
> 1. En `RobotintoScene`, en `preload()`, carga:
>    - Un fondo genérico desde `"/assets/bg.png"`.  
>    - Un fondo cenital por planeta, por ejemplo:
>      - `"/assets/planets/marte.png"` para Marte, etc. (ajusta los nombres de archivo reales).  
> 2. En `create()`, muestra el fondo genérico y guarda una referencia a un `Sprite` o `Image` para el “fondo de planeta actual”.  
> 3. Cuando empiece una misión (`startMission` / `runMissionForPlanet`), cambia la textura del fondo de planeta según el planeta seleccionado.  
> 4. Asegúrate de que:
>    - No crees múltiples sprites superpuestos sin destruir los anteriores.  
>    - El fondo cambie correctamente al cambiar de planeta.  

### ✅ Pruebas manuales

- Lanzar misiones a distintos planetas.
- Ver que el arte/fondo correspondiente cambia correctamente.
- Confirmar que no se acumulan sprites (no se ve más oscuro ni raro).


---

## 9. Persistencia con `localStorage` + botón para borrar datos

### 🎯 Objetivo

Guardar el **estado de conocimiento** (y generación si quieres) en `localStorage`, de modo que las generaciones aprendidas persistan entre recargas, y permitir **borrarlo con un botón**.

### 💻 Prompt para Codex

> **Requerimiento 9 – Persistencia con localStorage y reseteo**  
> Implementa persistencia del conocimiento y un botón para resetearlo:  
> 1. Crea un módulo `src/game/storage.ts` con funciones:
>    ```ts
>    const STORAGE_KEY = "robotinto-knowledge-v1";
>    
>    export function saveKnowledge(state: {
>      knowledge: KnowledgeState;
>      currentGeneration: number;
>    }): void { ... }
>    
>    export function loadKnowledge(): {
>      knowledge: KnowledgeState;
>      currentGeneration: number;
>    } | null { ... }
>    
>    export function clearKnowledge(): void { ... }
>    ```  
>    - `saveKnowledge` debe serializar el objeto a JSON y guardarlo en `localStorage`.  
>    - `loadKnowledge` debe leer de `localStorage`, parsear JSON y devolver el objeto o `null` si no existe o hay error.  
>    - `clearKnowledge` debe eliminar la clave de `localStorage`.  
> 2. En `RobotintoScene`, durante la inicialización:
>    - Intenta cargar el conocimiento con `loadKnowledge()`.  
>    - Si existe, úsalo para inicializar `this.knowledge` y `this.currentGeneration`.  
>    - Si no existe, usa `createInitialKnowledgeState()` y generación 0.  
> 3. Al final de cada misión (exitosa o fallida), llama a `saveKnowledge({ knowledge: this.knowledge, currentGeneration: this.currentGeneration })`.  
> 4. En la UI React, crea un botón “Resetear aprendizaje” (por ejemplo en la página principal o como componente `ResetKnowledgeButton`):  
>    - Al hacer click:
>      - Llama a `clearKnowledge()` (puede estar expuesto como una función importable en React).  
>      - Opcionalmente emite un evento `EventBus.emit("reset-knowledge")` para que la escena vuelva a crear un estado limpio.  
> 5. Maneja el evento `"reset-knowledge"` en `RobotintoScene` para:
>    - Resetear `this.knowledge` = `createInitialKnowledgeState()`.  
>    - Poner `this.currentGeneration = 0`.  
>    - Loguear `"Conocimiento reiniciado manualmente."`.

### ✅ Pruebas manuales

- Abrir DevTools → Application → Local Storage.
- Lanzar varias misiones, recargar la página:
  - Confirmar que los valores de `failures`, `successes` o generación persisten.
- Pulsar el botón “Resetear aprendizaje”:
  - Ver que la clave de `localStorage` se elimina.
  - Ver un log indicando que se reinició el conocimiento.
  - Confirmar que al lanzar una misión, vuelve a ser Gen 1 o 0.


---

## 10. README para la entrega

### 🎯 Objetivo

Dejar un README claro que explique el enfoque de aprendizaje, el entorno de planetas y cómo correr el juego.

### 💻 Prompt para Codex

> **Requerimiento 10 – README de "Robotinto explorador"**  
> Crea o edita `README.md` para que incluya:  
> 1. Título: **Robotinto explorador**.  
> 2. Descripción breve de la idea:
>    - Robot explorador que viaja por los 8 planetas del sistema solar.  
>    - Cada planeta tiene temperatura, gravedad, humedad, radiación, vida y un campo `hasSurface`.  
>    - Robotinto aprende por generaciones a activar sistemas de protección.  
> 3. Explicar el mecanismo de aprendizaje:
>    - Estado de conocimiento por planeta (`KnowledgeState`).  
>    - Primera generación con umbrales laxos ⇒ fallos frecuentes.  
>    - Ajuste de umbrales tras cada fallo ⇒ siguientes generaciones se protegen mejor.  
>    - Persistencia en `localStorage` para mantener el aprendizaje entre sesiones.  
> 4. Describir la interfaz:
>    - Menú de selección de planetas con íconos.  
>    - Canvas central con vista cenital del planeta.  
>    - Panel de LOG retro (VT323, fondo verde) que narra lo que le pasa a Robotinto.  
>    - Botón para resetear el aprendizaje (limpia `localStorage`).  
> 5. Incluir instrucciones para ejecutar el proyecto:
>    ```bash
>    npm install
>    npm run dev
>    ```  
> 6. Opcional: sección breve de “Trabajo futuro” (más sensores, más sistemas, etc.).

### ✅ Pruebas manuales

- Leer el README desde cero y ver si se entiende el flujo del juego.
- Confirmar que cualquier compañero pueda correr el proyecto solo con esas instrucciones.

---

Con esto tienes un **plan completo en 10 requerimientos** listo para ir pegando **prompt por prompt** en Codex.

Si quieres, después podemos hacer una pasada final de “pulido”:
- texto del LOG,
- mensajes más divertidos,
- pequeños efectos visuales para cuando Robotinto falla o tiene éxito.
