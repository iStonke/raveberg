<script setup lang="ts">
const props = defineProps<{
  currentModeLabel: string
  displayStatusLabel: string
  displayLastHeartbeat: string
  displayTarget: string
  selfieStatusLabel: string
  selfieVisibleCount: number
  selfieIntervalSeconds: number
  selfieModerationLabel: string
  visualizerPreset: string
  visualizerColorScheme: string
  visualizerAutoCycleLabel: string
  visualizerTelemetryLabel: string
}>()
</script>

<template>
  <section class="live-summary-section">
    <v-row>
      <v-col cols="6" xl="3">
        <v-card class="summary-card pa-3" variant="flat">
          <div class="summary-label">Aktiver Modus</div>
          <div class="summary-value">{{ props.currentModeLabel }}</div>
        </v-card>
      </v-col>

      <v-col cols="6" xl="3">
        <v-card class="summary-card pa-3" variant="flat">
          <div class="summary-label">Display-Status</div>
          <div class="summary-value">{{ props.displayStatusLabel }}</div>
          <dl class="summary-list">
            <div>
              <dt>Letzter Kontakt</dt>
              <dd>{{ props.displayLastHeartbeat }}</dd>
            </div>
            <div>
              <dt>Renderer</dt>
              <dd>{{ props.displayTarget }}</dd>
            </div>
          </dl>
        </v-card>
      </v-col>

      <v-col cols="6" xl="3">
        <v-card class="summary-card pa-3" variant="flat">
          <div class="summary-label">Selfie / Slideshow</div>
          <div class="summary-value">{{ props.selfieStatusLabel }}</div>
          <dl class="summary-list">
            <div>
              <dt>Sichtbare Bilder</dt>
              <dd>{{ props.selfieVisibleCount }}</dd>
            </div>
            <div>
              <dt>Intervall</dt>
              <dd>{{ props.selfieIntervalSeconds }}s</dd>
            </div>
            <div>
              <dt>Moderation</dt>
              <dd>{{ props.selfieModerationLabel }}</dd>
            </div>
          </dl>
        </v-card>
      </v-col>

      <v-col cols="6" xl="3">
        <v-card class="summary-card pa-3" variant="flat">
          <div class="summary-label">Visualizer</div>
          <div class="summary-value">{{ props.visualizerPreset }}</div>
          <dl class="summary-list">
            <div>
              <dt>Farbwelt</dt>
              <dd>{{ props.visualizerColorScheme }}</dd>
            </div>
            <div>
              <dt>Automatikwechsel</dt>
              <dd>{{ props.visualizerAutoCycleLabel }}</dd>
            </div>
            <div>
              <dt>Parameter</dt>
              <dd>{{ props.visualizerTelemetryLabel }}</dd>
            </div>
          </dl>
        </v-card>
      </v-col>
    </v-row>
  </section>
</template>

<style scoped>
.live-summary-section {
  margin-bottom: 0.75rem;
}

.summary-card {
  height: 100%;
  border: 0;
  border-radius: 0;
  background: transparent !important;
  backdrop-filter: none;
  box-shadow: none !important;
}

.summary-label {
  color: rgba(194, 211, 228, 0.5);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 0.69rem;
  font-weight: 700;
}

.summary-value {
  margin-top: 0.5rem;
  font-size: clamp(1.35rem, 1.5vw, 1.75rem);
  font-weight: 700;
  line-height: 1.1;
  color: rgba(246, 250, 255, 0.96);
}

.summary-list {
  margin: 0.62rem 0 0;
  display: grid;
  gap: 0.35rem;
}

:deep(.live-summary-section .v-row) {
  margin: 0 -6px;
}

:deep(.live-summary-section .v-col) {
  padding: 6px;
}

.summary-list div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.summary-list dt {
  color: rgba(190, 205, 220, 0.46);
}

.summary-list dd {
  margin: 0;
  text-align: right;
  color: rgba(238, 245, 252, 0.88);
}

@media (max-width: 640px) {
  .summary-list div {
    flex-direction: column;
    gap: 0.15rem;
  }

  .summary-list dd {
    text-align: left;
  }

  .summary-value {
    font-size: 1.1rem;
  }
}
</style>
