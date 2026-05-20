/* ============================================
   ASTRO-ROVER CLASSIFIER — app.js
   Vue 3 + Camera (getUserMedia) + TensorFlow.js CNN
   Clases: Piedra Roja, Piedra Azul, Piedra Verde
   ============================================ */

const { createApp, ref, onMounted, onUnmounted, nextTick } = Vue;

createApp({
    setup() {

        /* ── Estado ─────────────────────────────── */
        const cameraActive  = ref(false);
        const cameraError   = ref('');
        const currentRock   = ref(null);
        const stream        = ref(null);
        const modelReady    = ref(false);   // true cuando el modelo terminó de cargar
        const modelError    = ref('');      // mensaje si falla la carga
        const modelLoading  = ref(true);    // muestra spinner mientras carga

        /* Logs de actividad (datos iniciales de ejemplo) */
        const activityLogs = ref([
            { name: 'Piedra Roja',   desc: 'Roja | Marte',   time: '12:04 PM', colorClass: 'bg-red-500'   },
            { name: 'Piedra Azul',   desc: 'Azul | Luna',    time: '12:01 PM', colorClass: 'bg-blue-500'  },
            { name: 'Piedra Verde',  desc: 'Verde | Tierra', time: '11:45 AM', colorClass: 'bg-green-500' },
        ]);

        /* Intervalo de inferencia */
        let inferenceInterval = null;

        /* Referencia al modelo cargado */
        let model = null;

        /* ── Clases de rocas ─────────────────────
         * Keras ordena las carpetas ALFABÉTICAMENTE:
         *   roca_azul  → índice 0
         *   roca_roja  → índice 1
         *   roca_verde → índice 2
         * ──────────────────────────────────────── */
        const ROCK_CLASSES = [
            { name: 'Piedra Azul',   desc: 'Azul | Luna',    colorClass: 'bg-blue-500'  },  // 0 roca_azul
            { name: 'Piedra Roja',   desc: 'Roja | Marte',   colorClass: 'bg-red-500'   },  // 1 roca_roja
            { name: 'Piedra Verde',  desc: 'Verde | Tierra', colorClass: 'bg-green-500' },  // 2 roca_verde
        ];

        /* Umbral mínimo de confianza para registrar (0–1) */
        const CONFIDENCE_THRESHOLD = 0.70;

        /* Tiempo mínimo entre logs de la MISMA roca (ms) */
        const SAME_ROCK_COOLDOWN = 4000;
        let lastLoggedRock = '';
        let lastLoggedTime = 0;

        /* ── Helpers ────────────────────────────── */
        const getTime = () =>
            new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

        const addLog = (entry) => {
            activityLogs.value.unshift({ ...entry, time: getTime() });
            if (activityLogs.value.length > 50) activityLogs.value.pop();
        };

        /* ── Carga del modelo TensorFlow.js ──────
         * Se llama UNA sola vez al montar el componente.
         * Ruta relativa a index.html → carpeta modelo_tfjs/
         * ──────────────────────────────────────── */
        const loadModel = async () => {
            modelLoading.value = true;
            modelError.value   = '';
            try {
                model = await tf.loadLayersModel('./modelo_tfjs/model.json');
                // Warm-up: una predicción vacía para que la GPU compile los shaders
                const warmup = tf.zeros([1, 128, 128, 3]);
                model.predict(warmup).dispose();
                warmup.dispose();

                modelReady.value   = true;
                modelLoading.value = false;
                console.log('✅ Modelo cargado correctamente');
            } catch (err) {
                modelError.value   = `No se pudo cargar el modelo: ${err.message}`;
                modelLoading.value = false;
                console.error('❌ Error al cargar modelo:', err);
            }
        };

        /* ── Cámara ─────────────────────────────── */
        const startCamera = async () => {
            cameraError.value = '';
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width:      { ideal: 1280 },
                        height:     { ideal: 720  },
                        facingMode: 'environment'
                    }
                });

                stream.value       = mediaStream;
                cameraActive.value = true;

                await nextTick();
                const video = document.getElementById('camera-video');
                if (video) {
                    video.srcObject = mediaStream;
                    await video.play();
                }

                /* Solo inicia inferencia si el modelo está listo */
                if (modelReady.value) {
                    inferenceInterval = setInterval(runInference, 800);
                } else {
                    cameraError.value = 'El modelo aún no está listo. Espera e inténtalo de nuevo.';
                }

            } catch (err) {
                cameraError.value = err.name === 'NotAllowedError'
                    ? 'Permiso denegado. Permite el acceso a la cámara en tu navegador.'
                    : `Error al acceder a la cámara: ${err.message}`;
                cameraActive.value = false;
                console.error('Camera error:', err);
            }
        };

        const stopCamera = () => {
            clearInterval(inferenceInterval);
            inferenceInterval = null;

            if (stream.value) {
                stream.value.getTracks().forEach(t => t.stop());
                stream.value = null;
            }

            cameraActive.value = false;
            currentRock.value  = null;
        };

        /* ── Inferencia con CNN real ─────────────
         *
         * Flujo:
         *  1. Captura el frame actual del <video> en el <canvas> oculto
         *  2. Convierte a tensor [1, 224, 224, 3] normalizado 0-1
         *  3. Llama a model.predict()
         *  4. Obtiene índice de mayor probabilidad y su confianza
         *  5. Actualiza UI y log
         * ──────────────────────────────────────── */
        const runInference = async () => {
            const video  = document.getElementById('camera-video');
            const canvas = document.getElementById('camera-canvas');

            if (!video || !canvas || video.readyState < 2) return;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            /* Preprocesamiento:
             * - fromPixels: HxWx3 uint8
             * - resizeBilinear: 128x128 (input_shape de tu CNN)
             * - expandDims: agrega dimensión de batch → [1, 128, 128, 3]
             * - div(255): normaliza a [0, 1]
             */
            const tensor = tf.tidy(() =>
                tf.browser.fromPixels(canvas)
                    .resizeBilinear([128, 128])
                    .expandDims(0)
                    .div(255.0)
            );

            let predsData;
            try {
                const predsTensor = model.predict(tensor);
                predsData = await predsTensor.data();
                predsTensor.dispose();
            } catch (err) {
                console.error('Error en inferencia:', err);
                tensor.dispose();
                return;
            }
            tensor.dispose();

            /* Índice con mayor probabilidad */
            const idx        = predsData.indexOf(Math.max(...predsData));
            const confidence = predsData[idx];

            /* Guardar contra clases fuera de rango */
            if (idx < 0 || idx >= ROCK_CLASSES.length) return;

            const rock = ROCK_CLASSES[idx];

            /* Actualizar panel en tiempo real */
            currentRock.value = { ...rock, confidence: (confidence * 100).toFixed(1) };

            /* Registrar en log solo si supera umbral y pasó el cooldown */
            const now = Date.now();
            if (
                confidence >= CONFIDENCE_THRESHOLD &&
                (rock.name !== lastLoggedRock || now - lastLoggedTime > SAME_ROCK_COOLDOWN)
            ) {
                addLog(rock);
                lastLoggedRock = rock.name;
                lastLoggedTime = now;
            }
        };

        /* ── Ciclo de vida ───────────────────────── */
        onMounted(() => loadModel());
        onUnmounted(() => stopCamera());

        /* ── Exponer al template ─────────────────── */
        return {
            cameraActive,
            cameraError,
            currentRock,
            activityLogs,
            modelReady,
            modelLoading,
            modelError,
            startCamera,
            stopCamera,
        };
    }
}).mount('#app');