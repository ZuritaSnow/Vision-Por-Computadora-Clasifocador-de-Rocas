<template>
  <!-- Canvas oculto para captura de frames — fuera del flujo visible -->
  <canvas ref="canvasRef" width="128" height="128" class="hidden" />

  <div class="h-full flex flex-col relative">

    <!-- ══ Header ══════════════════════════════════════════════ -->
    <header class="flex justify-between items-center px-gutter w-full z-50 h-16
             border-b border-outline-variant bg-surface/40 backdrop-blur-md">
      <div class="text-headline-sm font-headline-sm font-bold text-primary tracking-tighter">
        ASTRO-ROVER CLASSIFIER
      </div>

      <!-- Estado del modelo -->
      <div class="flex items-center gap-2 text-xs font-label-bold">
        <template v-if="modelLoading">
          <span class="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          <span class="text-yellow-400 uppercase">Cargando modelo…</span>
        </template>
        <template v-else-if="modelReady">
          <span class="w-2 h-2 bg-green-400 rounded-full" />
          <span class="text-green-400 uppercase">Modelo listo</span>
        </template>
        <template v-else>
          <span class="w-2 h-2 bg-red-400 rounded-full" />
          <span class="text-red-400 uppercase">Error de modelo</span>
        </template>
      </div>
    </header>

    <!-- ══ Main ════════════════════════════════════════════════ -->
    <main class="grow p-gutter flex flex-col md:flex-row gap-gutter
             overflow-hidden relative z-10">

      <!-- ── Panel izquierdo: Escáner ──────────────────────── -->
      <section class="flex-[0.65] flex flex-col polaroid-card rounded-xl p-6
               overflow-hidden transition-all duration-300">
        <div class="relative grow bg-[#E8E8D0] rounded-lg overflow-hidden
                 border-inset border-2 border-[#d4d4b8] group">
          <!-- Esquinas del visor -->
          <div class="absolute top-4 left-4  viewfinder-corner border-t-2 border-l-2 z-10" />
          <div class="absolute top-4 right-4 viewfinder-corner border-t-2 border-r-2 z-10" />
          <div class="absolute bottom-4 left-4  viewfinder-corner border-b-2 border-l-2 z-10" />
          <div class="absolute bottom-4 right-4 viewfinder-corner border-b-2 border-r-2 z-10" />

          <!-- Overlay de scanline -->
          <div class="absolute inset-0 scanline-overlay pointer-events-none opacity-40 z-10" />

          <!-- Video en vivo -->
          <video v-if="cameraActive" ref="videoRef" autoplay playsinline muted
            class="absolute inset-0 w-full h-full object-cover" />

          <!-- Placeholder / errores cuando la cámara está inactiva -->
          <div v-if="!cameraActive" class="w-full h-full flex items-center justify-center bg-black/5">
            <div class="flex flex-col items-center gap-4">
              <span class="material-symbols-outlined text-6xl text-[#0400ac]/20">
                photo_camera
              </span>

              <!-- Error de modelo -->
              <p v-if="modelError" class="text-red-500 text-sm text-center px-6 font-body-md max-w-xs">
                ⚠️ {{ modelError }}
              </p>

              <!-- Error de cámara -->
              <p v-if="cameraError" class="text-red-500 text-sm text-center px-6 font-body-md max-w-xs">
                {{ cameraError }}
              </p>

              <!-- Spinner mientras carga el modelo -->
              <div v-if="modelLoading" class="flex flex-col items-center gap-2">
                <div class="w-8 h-8 border-4 border-[#0400ac]/30 border-t-[#0400ac]
                         rounded-full animate-spin" />
                <span class="text-[#0400ac] text-xs font-label-bold">
                  CARGANDO MODELO…
                </span>
              </div>

              <!-- Botón Iniciar -->
              <button v-if="!modelLoading" :disabled="!modelReady" class="bg-[#0400ac] text-white px-6 py-2 rounded-lg font-label-bold
                       text-label-bold shadow-[0_4px_0_0_#02005a]
                       hover:translate-y-0.5 hover:shadow-[0_2px_0_0_#02005a]
                       active:translate-y-1 active:shadow-none transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed
                       disabled:translate-y-0 disabled:shadow-none" @click="startCamera">
                INICIAR CÁMARA
              </button>
            </div>
          </div>

          <!-- Overlay de análisis en tiempo real -->
          <div v-if="currentRock" class="absolute bottom-6 left-6 flex flex-col gap-2 z-20">
            <div class="bg-[#0400ac] text-white px-4 py-1 rounded-sm text-label-bold
                     font-label-bold inline-flex items-center gap-2">
              <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              LIVE SENSOR FEED
            </div>
            <div class="bg-[#F5F5DC]/90 p-4 border border-[#0400ac] rounded
                     shadow-lg backdrop-blur-sm">
              <p class="text-[#0400ac] font-label-bold text-xs uppercase
                       tracking-widest mb-1">
                Análisis Geológico
              </p>
              <h2 class="text-[#0400ac] font-headline-sm text-headline-sm">
                Rock Type:
                <span class="font-bold underline decoration-tertiary">
                  {{ currentRock.name }}
                </span>
              </h2>
              <p class="text-[#0400ac] font-body-md text-body-md mt-1 opacity-80">
                Confidence: {{ currentRock.confidence }}% Accuracy
              </p>
            </div>
          </div>

          <!-- Botón DETENER (visible sobre el video) -->
          <button v-if="cameraActive" class="absolute top-6 right-6 z-20 bg-red-600 text-white px-3 py-1
                   rounded-lg text-label-bold font-label-bold text-xs shadow-lg
                   hover:bg-red-700 active:scale-95 transition-all" @click="stopCamera">
            DETENER
          </button>
        </div>

        <div class="mt-8 flex justify-center">
          <h1 class="text-black font-label-bold text-xl tracking-[0.2em] uppercase">
            CÁMARA
          </h1>
        </div>
      </section>

      <!-- ── Panel derecho: Actividad y Logs ───────────────── -->
      <aside class="flex-[0.35] flex flex-col gap-gutter">

        <section class="grow flex flex-col polaroid-card rounded-xl p-6
                 overflow-hidden">
          <div class="grow flex flex-col overflow-hidden">

            <div class="flex justify-between items-end mb-4">
              <h3 class="text-[#0400ac] font-label-bold text-label-bold
                       tracking-widest uppercase">
                Database Logs
              </h3>
              <span class="material-symbols-outlined text-[#0400ac]">
                database
              </span>
            </div>

            <!-- Lista dinámica de logs -->
            <div class="grow overflow-y-auto custom-scrollbar pr-2 space-y-3">
              <div v-for="(log, i) in activityLogs" :key="i" class="group flex items-center justify-between p-3
                       border-b border-[#d4d4b8] hover:bg-[#0400ac]/5
                       transition-colors cursor-pointer">
                <div class="flex items-center gap-4">
                  <div class="w-3 h-3 rounded-full border border-black/10" :class="log.colorClass" />
                  <div class="flex flex-col">
                    <span class="font-label-bold text-[#0400ac] uppercase text-sm">
                      {{ log.name }}
                    </span>
                    <span class="text-xs text-black/60 font-body-md">
                      {{ log.desc }}
                    </span>
                  </div>
                </div>
                <span class="text-[10px] font-label-bold text-black/40">
                  {{ log.time }}
                </span>
              </div>

              <!-- Estado vacío -->
              <div v-if="activityLogs.length === 0" class="flex flex-col items-center gap-2 py-8 text-black/30">
                <span class="material-symbols-outlined text-3xl">search</span>
                <span class="text-xs font-label-bold">Sin registros aún</span>
              </div>
            </div>
          </div>

          <!-- Ilustración del rover -->
          <div class="mt-4 flex justify-center px-4">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBCd7v4khN2nfCmNsKbaNrLrm03O3w7t3L3dltiuKpoZEZGAKf_gkz3xbSuyl9oSV81iTlEGpoZf_oO4y_98Tl3jIyuzgGkAv3l-Mq90L8O1Lib52u4H9xOygvHqJE6U67TI625GgNv8tCHISMciXJjtt_dtxrqsLLkGOJzBnZLCAyGIj4F7gOYEJnmVn3ILb4kLAhfL_n2dNDWMgjpEtSrlfxysVWm0Ug-Pg4v4iXnNqPBhcPcA22V4Flp-hCDF0KfyZnQlDguAsaM"
              alt="Astro-Rover Illustration" class="w-full h-auto max-h-48 object-contain drop-shadow-lg
                     opacity-90 floating-rover" />
          </div>

          <div class="mt-8 flex justify-center">
            <h1 class="text-black font-label-bold text-xl tracking-[0.2em] uppercase">
              Panel de actividad
            </h1>
          </div>
        </section>

        <!-- Quick Controls -->
        <div class="polaroid-card rounded-xl p-4 flex gap-4">
          <button :disabled="modelLoading || (!modelReady && !cameraActive)" class="flex-1 text-white p-3 rounded-lg flex flex-col items-center
                   gap-1 transition-all disabled:opacity-40
                   disabled:cursor-not-allowed" :class="cameraActive
                      ? 'bg-red-600 shadow-[0_4px_0_0_#7f1d1d] hover:translate-y-1 hover:shadow-[0_2px_0_0_#7f1d1d]'
                      : 'bg-[#0400ac] shadow-[0_4px_0_0_#02005a] hover:translate-y-1 hover:shadow-[0_2px_0_0_#02005a]'
                    " @click="cameraActive ? stopCamera() : startCamera()">
            <span class="material-symbols-outlined">
              {{ cameraActive ? 'stop_circle' : 'photo_camera' }}
            </span>
            <span class="text-[10px] font-label-bold">
              {{ cameraActive ? 'STOP' : 'SCAN' }}
            </span>
          </button>

          <button class="flex-1 bg-tertiary text-on-tertiary p-3 rounded-lg flex
                   flex-col items-center gap-1 shadow-[0_4px_0_0_#b59a00]
                   hover:translate-y-1 hover:shadow-[0_2px_0_0_#b59a00]
                   transition-all">
            <span class="material-symbols-outlined">analytics</span>
            <span class="text-[10px] font-label-bold">REPORT</span>
          </button>
        </div>

      </aside>
    </main>

    <!-- ══ Footer mobile ═══════════════════════════════════════ -->
    <footer class="md:hidden h-16 bg-surface-container flex items-center
             justify-around px-4 z-50">
      <button class="flex flex-col items-center text-primary">
        <span class="material-symbols-outlined">photo_camera</span>
        <span class="text-[8px] font-label-bold">SCANNER</span>
      </button>
      <button class="flex flex-col items-center text-on-surface-variant">
        <span class="material-symbols-outlined">grid_view</span>
        <span class="text-[8px] font-label-bold">GALLERY</span>
      </button>
      <button class="flex flex-col items-center text-on-surface-variant">
        <span class="material-symbols-outlined">database</span>
        <span class="text-[8px] font-label-bold">DATABASE</span>
      </button>
      <button class="flex flex-col items-center text-on-surface-variant">
        <span class="material-symbols-outlined">analytics</span>
        <span class="text-[8px] font-label-bold">REPORTS</span>
      </button>
    </footer>

    <!-- Partículas decorativas de atmósfera -->
    <div class="absolute top-10 left-1/4 w-1 h-1 bg-white rounded-full
             animate-pulse shadow-[0_0_8px_white]" />
    <div class="absolute bottom-1/4 right-1/3 w-2 h-2 bg-primary rounded-full
             animate-pulse shadow-[0_0_12px_#bfc2ff] delay-700" />

  </div>
</template>


<!-- ============================================================
     SCRIPT SETUP  (Composition API, <script setup> Vue 3.2+)
     ============================================================ -->
<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

/* ── Acceso a TensorFlow.js ──────────────────────────────────────
 * TF.js se carga como dependencia externa. Hay dos formas:
 *
 *   A) Vite / npm (recomendado para producción):
 *      npm install @tensorflow/tfjs
 *      import * as tf from '@tensorflow/tfjs'
 *
 *   B) CDN global (si prefieres no bundlearlo):
 *      En index.html agrega antes de tu bundle:
 *      <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"><\/script>
 *      y accede vía window.tf  →  const tf = window.tf
 *
 * Aquí usamos la opción A. Cambia a window.tf si usas CDN.
 * ─────────────────────────────────────────────────────────────── */
import * as tf from '@tensorflow/tfjs'   // ← descomenta con opción A
//const tf = window.tf  // ← comenta si usas opción A (npm)

// ── Referencias al DOM ─────────────────────────────────────────
const videoRef = ref(null)   // <video>
const canvasRef = ref(null)   // <canvas> oculto

// ── Estado reactivo ────────────────────────────────────────────
const cameraActive = ref(false)
const cameraError = ref('')
const currentRock = ref(null)
const stream = ref(null)
const modelReady = ref(false)
const modelError = ref('')
const modelLoading = ref(true)

// Logs de actividad (datos de ejemplo iniciales)
const activityLogs = ref([])

// ── Internos (no reactivos, no necesitan ser ref) ──────────────
let inferenceInterval = null
let model = null
let lastLoggedRock = ''
let lastLoggedTime = 0

/* ── Clases de rocas ────────────────────────────────────────────
 * Keras ordena las carpetas ALFABÉTICAMENTE en el entrenamiento:
 *   roca_azul  → índice 0
 *   roca_roja  → índice 1
 *   roca_verde → índice 2
 *
 * Si reorganizas tus clases, ajusta este array para que el índice
 * de cada entrada coincida con el índice de salida del modelo.
 * ──────────────────────────────────────────────────────────────── */
const ROCK_CLASSES = [
  { name: 'Piedra Azul', desc: 'Azul | Luna', colorClass: 'bg-blue-500' }, // 0
  { name: 'Piedra Roja', desc: 'Roja | Marte', colorClass: 'bg-red-500' }, // 1
  { name: 'Piedra Verde', desc: 'Verde | Tierra', colorClass: 'bg-green-500' }, // 2
]

/** Confianza mínima para registrar una detección en el log (0–1) */
const CONFIDENCE_THRESHOLD = 0.85

/** Cooldown para no registrar la misma roca repetidamente (ms) */
const SAME_ROCK_COOLDOWN = 4000

// ── Helpers ────────────────────────────────────────────────────
const getTime = () =>
  new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

const addLog = (entry) => {
  activityLogs.value.unshift({ ...entry, time: getTime() })
  if (activityLogs.value.length > 50) activityLogs.value.pop()
}

/* ── Carga del modelo TensorFlow.js ─────────────────────────────
 *
 * ▶ CÓMO CONECTAR TU MODELO:
 *
 *   1. Exporta tu modelo de Keras/Python a formato TF.js:
 *      pip install tensorflowjs
 *      tensorflowjs_converter --input_format keras \
 *        mi_modelo.h5  public/modelo_tfjs/
 *
 *   2. Coloca la carpeta resultante en /public/modelo_tfjs/
 *      (junto a index.html). Vite sirve /public/ como raíz.
 *      La estructura debe ser:
 *        public/
 *          modelo_tfjs/
 *            model.json
 *            group1-shard1of1.bin   (puede haber varios shards)
 *
 *   3. La ruta './modelo_tfjs/model.json' apunta a ese archivo.
 *      Si la ruta cambia, actualiza la constante MODEL_URL.
 *
 *   4. Asegúrate de que input_shape coincide:
 *      La inferencia redimensiona a [128, 128].
 *      Si tu modelo usa otra resolución, cambia resizeBilinear([H, W]).
 * ──────────────────────────────────────────────────────────────── */
const MODEL_URL = './modelo_tfjs/model.json'

const loadModel = async () => {
  modelLoading.value = true
  modelError.value = ''
  try {
    await tf.ready()  // ← espera que el backend (WebGL/WASM) esté listo
    model = await tf.loadGraphModel(MODEL_URL)

    // Warm-up seguro
    tf.tidy(() => {
      const warmup = tf.zeros([1, 128, 128, 3])
      model.predict(warmup)
    })

    modelReady.value = true
    modelLoading.value = false
    console.log('✅ Modelo cargado correctamente')
  } catch (err) {
    modelError.value = `No se pudo cargar el modelo: ${err.message}`
    modelLoading.value = false
    console.error('❌ Error al cargar modelo:', err)
  }
}

// ── Cámara ─────────────────────────────────────────────────────
const startCamera = async () => {
  cameraError.value = ''
  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment',
      },
    })

    stream.value = mediaStream
    cameraActive.value = true

    // Espera a que Vue renderice el <video> antes de asignar srcObject
    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream
      await videoRef.value.play()
    }

    if (modelReady.value) {
      inferenceInterval = setInterval(runInference, 800)
    } else {
      cameraError.value = 'El modelo aún no está listo. Espera e inténtalo de nuevo.'
    }
  } catch (err) {
    cameraError.value = err.name === 'NotAllowedError'
      ? 'Permiso denegado. Permite el acceso a la cámara en tu navegador.'
      : `Error al acceder a la cámara: ${err.message}`
    cameraActive.value = false
    console.error('Camera error:', err)
  }
}

const stopCamera = () => {
  clearInterval(inferenceInterval)
  inferenceInterval = null

  if (stream.value) {
    stream.value.getTracks().forEach((t) => t.stop())
    stream.value = null
  }

  cameraActive.value = false
  currentRock.value = null
}

/* ── Inferencia con CNN ─────────────────────────────────────────
 * Flujo:
 *   1. Captura el frame del <video> en el <canvas> oculto
 *   2. Convierte a tensor [1, 128, 128, 3] normalizado [0, 1]
 *   3. model.predict() → array de probabilidades
 *   4. Toma el índice de mayor probabilidad
 *   5. Actualiza UI y registra en log si supera el umbral
 * ──────────────────────────────────────────────────────────────── */
const runInference = async () => {
  const video = videoRef.value
  const canvas = canvasRef.value

  // ── Validación más estricta ──────────────────────────────
  if (!video || !canvas) return
  if (video.readyState < 2) return
  if (video.videoWidth === 0 || video.videoHeight === 0) return  // ← línea nueva
  // ─────────────────────────────────────────────────────────

  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  const tensor = tf.tidy(() =>
    tf.browser
      .fromPixels(canvas)
      .resizeBilinear([128, 128])
      .expandDims(0)
      .div(255.0),
  )

  let predsData
  try {
    const predsTensor = model.execute(tensor)
    predsData = await predsTensor.data()
    predsTensor.dispose()
  } catch (err) {
    console.error('Error en inferencia:', err)
    tensor.dispose()
    return
  }
  tensor.dispose()

  const idx = predsData.indexOf(Math.max(...predsData))
  const confidence = predsData[idx]

  if (idx < 0 || idx >= ROCK_CLASSES.length) return

  const rock = ROCK_CLASSES[idx]
  currentRock.value = { ...rock, confidence: (confidence * 100).toFixed(1) }


  // Solo muestra en el panel si supera el umbral
  if (confidence >= CONFIDENCE_THRESHOLD) {
    currentRock.value = { ...rock, confidence: (confidence * 100).toFixed(1) }
  } else {
    currentRock.value = null
  }

  const now = Date.now()
  if (
    confidence >= CONFIDENCE_THRESHOLD &&
    (rock.name !== lastLoggedRock || now - lastLoggedTime > SAME_ROCK_COOLDOWN)
  ) {
    addLog(rock)
    lastLoggedRock = rock.name
    lastLoggedTime = now
  }
}

// ── Ciclo de vida ──────────────────────────────────────────────
onMounted(() => loadModel())
onUnmounted(() => stopCamera())
</script>


<!-- ============================================================
     STYLES  — scoped para no contaminar otros componentes
     ============================================================ -->
<style scoped>
/* Fondo cósmico: reemplaza la URL o usa una variable de entorno Vite */
.cosmic-bg {
  background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuBO6MTNtTkk3Tx4A6uhSUZbDJ4llriuGbzl7MtVdsPdT2_AbwMqIug_l_KsfciHMh2WoCuCVTsYj7mQZvYZTqtGkg7EnH8iL30zabPvGln3Bv-EkXCbWj6rAHdyYmEY2DX_dub5izyOWD538E07VKgaIuMKS3u1F56wMRHWD83Yu86Z2u0O8V63DGdcb6oftUpu1zKerRwgLKCpAXWnV84jBDQwFuvoy01eKWVWK768ri1MLFNB-CrLNfnQ7GT8fENQXNy4lESu9KK_');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.scanline-overlay {
  background: linear-gradient(to bottom,
      rgba(191, 194, 255, 0) 0%,
      rgba(191, 194, 255, 0.1) 50%,
      rgba(191, 194, 255, 0) 100%);
  background-size: 100% 10px;
  animation: scan 4s linear infinite;
}

@keyframes scan {
  from {
    transform: translateY(-100%);
  }

  to {
    transform: translateY(100%);
  }
}

.polaroid-card {
  background-color: #F5F5DC;
  border: 1px solid #d4d4b8;
  box-shadow: 0 4px 0 0 #0400ac;
}

/* Scrollbar personalizado (webkit) */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #0400ac;
  border-radius: 10px;
}

.viewfinder-corner {
  border-color: #bfc2ff;
  width: 20px;
  height: 20px;
}

.floating-rover {
  animation: float 6s ease-in-out infinite;
}

@keyframes float {

  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  50% {
    transform: translateY(-15px) rotate(2deg);
  }
}
</style>