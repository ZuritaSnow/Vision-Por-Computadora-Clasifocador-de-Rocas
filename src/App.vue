<template>
  <div class="h-screen overflow-hidden cosmic-bg">
    <RoverClassifier />
  </div>
</template>

<script setup>
import RoverClassifier from './components/RoverClassifier.vue'
</script>

<style>
/* Estilos globales — NO scoped  */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Work+Sans:wght@300..600&family=Anybody:wght@100..900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

html, body, #app {
  height: 100%;
  margin: 0;
}
</style>