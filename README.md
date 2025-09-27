# Sleep Module MVP – Phone-Based Sleep Tracking

## 🛠️ Tech Stack

- **Frontend**: Quasar (Vue 3, Composition API) – built as a PWA
- **Backend**: Node.js + Express (TypeScript)
- **Sensors**: `DeviceMotionEvent` (and fallback to `accelerationIncludingGravity`)
- **Secure Context**: HTTPS (via `ngrok`), or `http://localhost`

---

## 🚀 Setup Instructions

### 1. Clone the repo

```bash
git clone https://github.com/tsbihongo/sleep-module-mvp.git
cd sleep-module-mvp
```

### 2. Install dependencies

Frontend:

```bash
cd frontend
npm install
```

Backend:

```bash
cd ../backend
npm install
```

---

## ▶️ Running Locally

### Backend

From `backend/`:

```bash
npx ts-node index.ts
```

By default runs on [http://localhost:3000](http://localhost:3000).

### Frontend

From `frontend/`:

```bash
quasar dev -m pwa --https
```

This starts the Quasar PWA dev server on [http://localhost:9200](http://localhost:9200).

---

## 🌐 Using ngrok for Demo

Because mobile browsers require **HTTPS** to access motion sensors, use ngrok:

1. Start backend:

   (See above.)

2. Start frontend with proxy:

   (See above.)

3. Make sure you have ngrok installed, and the credited with your auth token, then run ngrok on the **frontend port** (e.g. 9200):

   ```bash
   ngrok http 9200
   ```

   When you run the frontend, the port the frontend is running on will show on the terminal after running frontend. Please copy that port number and replace 9200 in the cmd command.

4. Quasar is configured with a proxy:

   - All requests to `/api/*` are automatically forwarded to your local backend (`http://localhost:3000`).
   - From the browser’s perspective, everything happens through the ngrok HTTPS domain.
   - Example:

     ```
     https://<your-ngrok-id>.ngrok-free.app/  → frontend
     https://<your-ngrok-id>.ngrok-free.app/api/analyze  → proxied backend
     ```

---

## 📊 Heuristic Algorithm (Backend)

Implemented in `backend/index.ts`.

1. **Input**: array of `{ timestamp, rms }` (RMS = Root Mean Square of acceleration samples per batch).
2. **Thresholding**:

   - If `rms < 1.0 (m/s²)`, classify as **low activity** (likely asleep).
   - Otherwise, mark as **active** (awake/moving).

3. **Sleep window**:

   - Detect the **longest contiguous block of low-activity minutes**.
   - Treat this as the main sleep episode.

4. **Metrics**:

   - **Duration** = `sleepEnd - sleepStart` (hours).
   - **Efficiency** = `(lowActivityMinutes / totalMinutes) * 100`.
   - **Quality** =

     - High → efficiency > 90%
     - Medium → efficiency > 75%
     - Low → otherwise

5. **Output**:

   ```json
   {
     "duration": 6.8,
     "efficiency": 82.5,
     "quality": "Medium",
     "details": {
       "totalMinutes": 400,
       "lowActivityMinutes": 330,
       "thresholdUsed": 1.0
     }
   }
   ```

---

## 📱 Usage

1. Open the ngrok link on your **mobile device**.
2. Tap **Start Tracking** → grant motion permission (iOS needs a tap to request).
3. Place phone on bed → it records accelerometer samples.
4. Tap **Stop Tracking** → data is sent to backend → results card shows duration, efficiency, and quality.

---

## 🧪 Testing Notes

- During dev, `flushSamples()` can be set to **20 seconds** (instead of 1 minute) for faster testing.
- Use Chrome remote debugging (or Safari Web Inspector on iOS) to view console logs.
- Keep the phone still to simulate sleep, shake it occasionally to simulate movement.

---

## 🔮 Future Improvements

- Tune thresholds with real-world data.
- Save history of sessions.
- Explore ML-based approaches (TensorFlow.js).

---
