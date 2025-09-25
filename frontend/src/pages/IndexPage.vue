<template>
  <q-page padding>
    <div class="q-pa-md">
      <h5>Sleep Tracker</h5>
      <q-btn label="Start Tracking" @click="startTracking" color="primary" class="q-mr-md" />
      <q-btn label="Stop Tracking" @click="stopTracking" color="negative" />
      <div class="q-mt-md">Status: {{ status }}</div>

      <div v-if="results">
        <q-card class="q-mt-md">
          <q-card-section>
            <div><strong>Duration:</strong> {{ results.duration.toFixed(2) }} hrs</div>
            <div><strong>Efficiency:</strong> {{ results.efficiency.toFixed(1) }}%</div>
            <div><strong>Quality:</strong> {{ results.quality }}</div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';

const status = ref('idle');
const results = ref<{ duration: number; efficiency: number; quality: string } | null>(null);

const samples: { timestamp: number; x: number; y: number; z: number }[] = [];
const minuteSummaries: { timestamp: number; rms: number }[] = [];

let timer: ReturnType<typeof setInterval> | null = null;

function throttleTo1Hz(ev: DeviceMotionEvent) {
  const now = Date.now();
  if (!throttleTo1Hz.lastTs || now - throttleTo1Hz.lastTs >= 1000) {
    throttleTo1Hz.lastTs = now;
    const a = ev.acceleration || ev.accelerationIncludingGravity;
    if (!a) return;
    samples.push({ timestamp: now, x: a.x || 0, y: a.y || 0, z: a.z || 0 });
  }
}
throttleTo1Hz.lastTs = 0;

// Changed to normal function because no actual await at top-level
function startTracking() {
  status.value = 'requesting permission';

  // iOS 13+ requires permission inside a user gesture
  if (typeof DeviceMotionEvent !== 'undefined' && 'requestPermission' in DeviceMotionEvent) {
    const requestPermission = (
      DeviceMotionEvent as unknown as {
        requestPermission: () => Promise<'granted' | 'denied'>;
      }
    ).requestPermission;

    void requestPermission?.().then((res) => {
      if (res !== 'granted') {
        status.value = 'denied';
        return;
      }
      startDeviceMotion();
    });
  } else {
    startDeviceMotion();
  }
}

function startDeviceMotion() {
  window.addEventListener('devicemotion', throttleTo1Hz, { passive: true });
  status.value = 'tracking';

  timer = setInterval(() => {
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const minuteSamples = samples.filter((s) => s.timestamp >= oneMinuteAgo);
    if (!minuteSamples.length) return;

    const rms = Math.sqrt(
      minuteSamples.reduce((acc, s) => acc + (s.x ** 2 + s.y ** 2 + s.z ** 2) / 3, 0) /
        minuteSamples.length,
    );
    minuteSummaries.push({ timestamp: now, rms });
  }, 60_000);
}

async function stopTracking() {
  window.removeEventListener('devicemotion', throttleTo1Hz);
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  status.value = 'stopped';

  try {
    const res = await axios.post('http://192.168.200.95:3000/analyze', minuteSummaries);
    results.value = res.data;
  } catch (err) {
    console.error(err);
  }
}
</script>
