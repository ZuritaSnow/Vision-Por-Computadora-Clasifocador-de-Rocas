/* ============================================
   ASTRO-ROVER CLASSIFIER — app.js
   Vue 3 + Camera (getUserMedia) + Placeholder CNN
   ============================================ */

const { createApp, ref, onMounted, onUnmounted } = Vue;

createApp({
    setup() {

        /* ── Estado ─────────────────────────────── */
        const cameraActive  = ref(false);
        const cameraError   = ref('');
        const currentRock   = ref(null);   // { name, desc, colorClass, confidence }
        const stream        = ref(null);

        /* Logs de actividad */
        const activityLogs = ref([
            { name: 'Granito',   desc: 'Gris | Plutónica',    time: '12:04 PM', colorClass: 'bg-gray-400'  },
            { name: 'Obsidiana', desc: 'Negra | Ígnea',       time: '12:01 PM', colorClass: 'bg-black'     },
            { name: 'Pumita',    desc: 'Crema | Vesicular',   time: '11:45 AM', colorClass: 'bg-yellow-100'},
            { name: 'Cuarzo',    desc: 'Rosa | Cristalina',   time: '11:32 AM', colorClass: 'bg-pink-200'  },
            { name: 'Basalto',   desc: 'Oscuro | Volcánica',  time: '11:20 AM', colorClass: 'bg-slate-800' },
            { name: 'Arenisca',  desc: 'Rojo | Sedimentaria', time: '10:55 AM', colorClass: 'bg-red-400'   },
            { name: 'Mármol',    desc: 'Blanco | Metamórfica','time': '10:40 AM', colorClass: 'bg-white'   },
        ]);

        /* Intervalo de inferencia */
        let inferenceInterval = null;

        /* ── Helpers ────────────────────────────── */
        const getTime = () =>
            new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

        const addLog = (entry) => {
            activityLogs.value.unshift({ ...entry, time: getTime() });
            // Limitar a 50 entradas
            if (activityLogs.value.length > 50) activityLogs.value.pop();
        };

        /* ── Cámara ─────────────────────────────── */
        const startCamera = async () => {
            cameraError.value = '';
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' }
                });

                stream.value      = mediaStream;
                cameraActive.value = true;

                // Asignar stream al <video> después de que Vue renderice
                await Vue.nextTick();
                const video = document.getElementById('camera-video');
                if (video) {
                    video.srcObject = mediaStream;
                    video.play();
                }

                // Iniciar inferencia periódica (cada 800ms)
                inferenceInterval = setInterval(runInference, 800);

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
            if (stream.value) {
                stream.value.getTracks().forEach(t => t.stop());
                stream.value = null;
            }
            cameraActive.value = false;
            currentRock.value  = null;
        };

        /* ── Inferencia (placeholder CNN) ────────
         *
         *  Aquí conectarás tu modelo TensorFlow.js:
         *
         *    const model = await tf.loadLayersModel('./model/model.json');
         *
         *  Dentro de runInference():
         *    const canvas = document.getElementById('camera-canvas');
         *    const ctx    = canvas.getContext('2d');
         *    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
         *    const tensor = tf.browser.fromPixels(canvas)
         *                     .resizeBilinear([224, 224])
         *                     .expandDims(0)
         *                     .div(255.0);
         *    const preds  = await model.predict(tensor).data();
         *    // preds → Float32Array con probabilidades por clase
         * ─────────────────────────────────────── */
        const ROCK_CLASSES = [
            { name: 'Basalto',   desc: 'Oscuro | Volcánica',    colorClass: 'bg-slate-800'  },
            { name: 'Granito',   desc: 'Gris | Plutónica',      colorClass: 'bg-gray-400'   },
            { name: 'Arenisca',  desc: 'Rojo | Sedimentaria',   colorClass: 'bg-red-400'    },
            { name: 'Cuarzo',    desc: 'Rosa | Cristalina',     colorClass: 'bg-pink-200'   },
            { name: 'Obsidiana', desc: 'Negra | Ígnea',         colorClass: 'bg-black'      },
            { name: 'Mármol',    desc: 'Blanco | Metamórfica',  colorClass: 'bg-white'      },
            { name: 'Pumita',    desc: 'Crema | Vesicular',     colorClass: 'bg-yellow-100' },
        ];

        /* Umbral mínimo de confianza para registrar (0–1) */
        const CONFIDENCE_THRESHOLD = 0.70;

        /* Tiempo mínimo entre logs de la MISMA roca (ms) */
        const SAME_ROCK_COOLDOWN = 4000;
        let lastLoggedRock = '';
        let lastLoggedTime = 0;

        const runInference = () => {
            /*
             * PLACEHOLDER — reemplaza este bloque con tu CNN:
             * ------------------------------------------------
             * 1. Captura frame del video en el canvas oculto
             * 2. Preprocesa el tensor
             * 3. Llama a model.predict()
             * 4. Obtén índice y confianza del resultado
             * ------------------------------------------------
             * Por ahora simula una detección aleatoria:
             */
            const idx        = Math.floor(Math.random() * ROCK_CLASSES.length);
            const confidence = 0.65 + Math.random() * 0.35;   // 65%–100%
            /* ------------------------------------------------ */

            const rock = ROCK_CLASSES[idx];

            // Actualizar panel de análisis en tiempo real
            currentRock.value = { ...rock, confidence: (confidence * 100).toFixed(1) };

            // Registrar en el log solo si supera umbral y pasó el cooldown
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

        /* ── Limpieza al desmontar ───────────────── */
        onUnmounted(() => stopCamera());

        /* ── Exponer al template ─────────────────── */
        return {
            cameraActive,
            cameraError,
            currentRock,
            activityLogs,
            startCamera,
            stopCamera,
        };
    }
}).mount('#app');