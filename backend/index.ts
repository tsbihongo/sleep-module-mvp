import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
app.use(
  cors({
    origin: "*",
  })
);
app.use(bodyParser.json());

app.post("/analyze", (req, res) => {
  console.log("Received minuteSummaries:", req.body);
  const data: { timestamp: number; rms: number }[] = req.body;
  if (!Array.isArray(data))
    return res.status(400).json({ error: "Expected array" });

  const result = analyzeSleep(data);
  res.json(result);
});

function analyzeSleep(data: { timestamp: number; rms: number }[]) {
  data.sort((a, b) => a.timestamp - b.timestamp);

  const threshold = 1.0; // adjust this for sensitivity
  let lowMinutes = 0;
  let start: number | null = null;
  let end: number | null = null;

  data.forEach((m) => {
    if (m.rms < threshold) {
      lowMinutes++;
      if (!start) start = m.timestamp;
      end = m.timestamp;
    }
  });

  const durationHrs = start && end ? (end - start) / 1000 / 3600 : 0;
  const efficiency = data.length ? (lowMinutes / data.length) * 100 : 0;

  let quality = "Low";
  if (efficiency > 90) quality = "High";
  else if (efficiency > 75) quality = "Medium";

  return { duration: durationHrs, efficiency, quality };
}

app.listen(3000, "0.0.0.0", () =>
  console.log("Backend listening on port 3000")
);
