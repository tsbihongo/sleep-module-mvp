<template>
  <q-page padding>
    <div class="q-pa-md">
      <h5>Sleep Tracker</h5>

      <q-btn label="Start Tracking" @click="startTracking" color="primary" class="q-mr-md" />
      <q-btn label="Stop Tracking" @click="stopTracking" color="negative" />

      <div class="q-mt-md">Status: {{ status }}</div>
      <div v-if="samples.length">
        <h6>Last sample:</h6>
        <pre>{{ samples[samples.length - 1] }}</pre>
      </div>

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

let samples: { timestamp: number; x: number; y: number; z: number }[] = [];
let minuteSummaries: { timestamp: number; rms: number }[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
//this is the onmotion function
function throttleTo1Hz(ev: DeviceMotionEvent) {
  const now = Date.now();
  if (!throttleTo1Hz.lastTs || now - throttleTo1Hz.lastTs >= 1000) {
    throttleTo1Hz.lastTs = now;
    const a = ev.acceleration || ev.accelerationIncludingGravity;
    if (!a) return;
    samples.push({ timestamp: now, x: a.x || 0, y: a.y || 0, z: a.z || 0 });
    console.log('Sample captured:', { x: a.x, y: a.y, z: a.z });
  }
}
throttleTo1Hz.lastTs = 0;

const startTracking = () => {
  results.value = null;
  minuteSummaries = [];
  samples = [];

  status.value = 'requesting permission';

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
};

function startDeviceMotion() {
  window.addEventListener('devicemotion', throttleTo1Hz, { passive: true });
  status.value = 'tracking';

  timer = setInterval(() => {
    flushSamples();
  }, 20_000); //i am flushing every 20 seconds for easier testing, feel free to change this for longer periods
}

// Process samples into one minute summary
function flushSamples() {
  if (!samples.length) return;

  const rms = Math.sqrt(
    samples.reduce((acc, s) => acc + (s.x ** 2 + s.y ** 2 + s.z ** 2) / 3, 0) / samples.length,
  );
  minuteSummaries.push({ timestamp: Date.now(), rms });
  samples = []; // clear after flushing
}

const stopTracking = async () => {
  window.removeEventListener('devicemotion', throttleTo1Hz);
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  // Flush whatever’s left, even if <10 seconds because its showing 0 still
  if (samples.length) {
    flushSamples();
  } else if (!minuteSummaries.length) {
    minuteSummaries.push({ timestamp: Date.now(), rms: 0 });
  }
  status.value = 'stopped';

  console.log('Sending to backend:', minuteSummaries);

  try {
    const res = await axios.post('http://localhost:3000/analyze', minuteSummaries); //if POST request is not sending the data to your backend, please change localhost to your device's IP.
    console.log('Backend response:', res.data);
    results.value = res.data;
  } catch (err) {
    console.error(err);
  }
};
</script>
