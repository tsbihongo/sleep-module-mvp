<template>
  <q-page padding>
    <div class="q-pa-md">
      <h5>Sleep Tracker</h5>

      <q-btn label="Start Tracking" @click="startTracking" color="primary" class="q-mr-md" />
      <q-btn label="Stop Tracking" @click="stopTracking" color="negative" />

      <div class="q-mt-md">Status: {{ status }}</div>

      <!-- Show last sample for debugging -->
      <div v-if="samples.length">
        <h6>Last sample:</h6>
        <pre>{{ samples[samples.length - 1] }}</pre>
      </div>

      <!-- Results card -->
      <div v-if="results">
        <q-card class="q-mt-md">
          <q-card-section>
            <div><strong>Duration:</strong> {{ results.duration.toFixed(2) }} hrs</div>
            <div><strong>Efficiency:</strong> {{ results.efficiency.toFixed(1) }}%</div>
            <div><strong>Quality:</strong> {{ results.quality }}</div>
          </q-card-section>

          <!-- Details Section box for better observation -->
          <q-separator />

          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">Details:</div>
            <q-list dense bordered separator>
              <q-item v-for="(val, key) in results.details" :key="key">
                <q-item-section>
                  <strong>{{ key }}:</strong> {{ formatValue(val) }}
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';

// Types
interface Sample {
  timestamp: number;
  x: number;
  y: number;
  z: number;
}

interface MinuteSummary {
  timestamp: number;
  rms: number;
}
//what i will show
interface SleepResults {
  duration: number;
  efficiency: number;
  quality: string;
  details?: Record<string, unknown>;
}

// State
const status = ref('Idle. Please start tracking when ready.');
const results = ref<SleepResults | null>(null);

let samples: Sample[] = [];
let minuteSummaries: MinuteSummary[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

// Formatting helper for showing
function formatValue(val: unknown) {
  if (typeof val === 'number') {
    return val.toFixed(2);
  }
  if (Array.isArray(val)) {
    return val.join(', ');
  }
  if (typeof val === 'object' && val !== null) {
    return JSON.stringify(val, null, 2);
  }
  return String(val);
}

// this is my onmotion function
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

// Start tracking
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

// Start listening to motion
function startDeviceMotion() {
  window.addEventListener('devicemotion', throttleTo1Hz, { passive: true });
  status.value = 'Tracking. Your motion sensors are now collection data.';

  timer = setInterval(() => {
    flushSamples();
  }, 20_000); // flushing every 20s for testing and demo
}

// Flush collected samples into RMS summary
function flushSamples() {
  if (!samples.length) return;

  const rms = Math.sqrt(
    samples.reduce((acc, s) => acc + (s.x ** 2 + s.y ** 2 + s.z ** 2) / 3, 0) / samples.length,
  );
  minuteSummaries.push({ timestamp: Date.now(), rms });
  samples = []; // clear after flushing
}

// Stop tracking
const stopTracking = async () => {
  window.removeEventListener('devicemotion', throttleTo1Hz);
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  // Flush any remaining samples
  if (samples.length) {
    flushSamples();
  } else if (!minuteSummaries.length) {
    minuteSummaries.push({ timestamp: Date.now(), rms: 0 });
  }
  status.value = 'Stopped Tracking. Motion sensors have stopped collecting data.';

  console.log('Sending to backend:', minuteSummaries);

  try {
    const res = await axios.post('/api/analyze', minuteSummaries); //I already modified the config file to redirect api to my backend. This is done because the data also needs to send to backend via HTTPS, and ngrok cannot facilitate another HTTPS for a free account to host both the frontend and the backend.
    console.log('Backend response:', res.data);
    results.value = res.data;
  } catch (err) {
    console.error(err);
  }
};
</script>
