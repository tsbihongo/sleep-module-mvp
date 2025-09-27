// index.ts (TypeScript)
import express from "express";
import cors from "cors";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.post("/analyze", (req, res) => {
  console.log("Received minuteSummaries:", req.body);
  const data: { timestamp: number; rms: number }[] = req.body;
  if (!Array.isArray(data))
    return res.status(400).json({ error: "Expected array" });

  const result = analyzeSleep(data);
  res.json(result);
});

function analyzeSleep(data: { timestamp: number; rms: number }[]) {
  if (!data.length)
    return { duration: 0, efficiency: 0, quality: "Low", details: "no-data" };

  // Sort by time
  data.sort((a, b) => a.timestamp - b.timestamp);

  // Compute sample interval in minutes (median diff)
  const diffs = [];
  for (let i = 1; i < data.length; i++)
    diffs.push(data[i].timestamp - data[i - 1].timestamp);
  const medianMs = diffs.length
    ? diffs.sort((a, b) => a - b)[Math.floor(diffs.length / 2)]
    : 60000;
  const sampleIntervalMinutes = Math.max((medianMs || 60000) / 60000, 1 / 60); // at least 1 sec

  // Threshold: default 0.05g (tune as needed)
  const G = 9.80665;
  const thresholdG = 0.05;
  const threshold = thresholdG * G; // m/s^2

  // Off-body detection: variance of rms
  const meanRms = data.reduce((s, d) => s + d.rms, 0) / data.length;
  const variance =
    data.reduce((s, d) => s + (d.rms - meanRms) ** 2, 0) / data.length;
  const offBody = variance < 0.001; // threshold: tune if needed

  // Create boolean array marking low activity
  const lowFlags = data.map((d) => d.rms < threshold);

  // Collapse contiguous blocks and compute durations (in minutes)
  type Block = { startIdx: number; endIdx: number; minutes: number };
  const blocks: Block[] = [];
  let curStart = lowFlags[0] ? 0 : -1;
  for (let i = 1; i < lowFlags.length; i++) {
    if (lowFlags[i] && curStart === -1) curStart = i;
    if (!lowFlags[i] && curStart !== -1) {
      blocks.push({
        startIdx: curStart,
        endIdx: i - 1,
        minutes: (i - curStart) * sampleIntervalMinutes,
      });
      curStart = -1;
    }
  }
  if (curStart !== -1) {
    blocks.push({
      startIdx: curStart,
      endIdx: lowFlags.length - 1,
      minutes: (lowFlags.length - curStart) * sampleIntervalMinutes,
    });
  }

  // Find longest contiguous low-activity block
  const minSleepMinutes = 10; // typical minimum window for main sleep episode
  let chosenBlock: Block | null = null;
  if (blocks.length) {
    // prefer blocks >= minSleepMinutes, otherwise longest
    const longEnough = blocks.filter((b) => b.minutes >= minSleepMinutes);
    if (longEnough.length)
      chosenBlock = longEnough.sort((a, b) => b.minutes - a.minutes)[0];
    else chosenBlock = blocks.sort((a, b) => b.minutes - a.minutes)[0];
  }

  // If we didn't find any low-activity block, fallback: treat entire dataset as candidate
  let sleepOnsetTs = data[0].timestamp;
  let sleepOffsetTs = data[data.length - 1].timestamp;
  let totalInBedMinutes = (sleepOffsetTs - sleepOnsetTs) / 60000;
  let lowActivityMinutes = lowFlags.reduce(
    (s, f) => s + (f ? sampleIntervalMinutes : 0),
    0
  );

  if (chosenBlock) {
    // compute onset/offset using block indices (expand by 1 sample on each side optionally)
    sleepOnsetTs = data[chosenBlock.startIdx].timestamp;
    sleepOffsetTs = data[chosenBlock.endIdx].timestamp + medianMs;
    totalInBedMinutes = chosenBlock.minutes;
    // compute low activity minutes inside chosen block
    lowActivityMinutes = 0;
    for (let i = chosenBlock.startIdx; i <= chosenBlock.endIdx; i++) {
      lowActivityMinutes += sampleIntervalMinutes;
    }
  }

  // Efficiency and duration
  const durationHrs = totalInBedMinutes / 60;
  const efficiency =
    totalInBedMinutes > 0 ? (lowActivityMinutes / totalInBedMinutes) * 100 : 0;

  // Quality heuristic
  let quality = "Low";
  if (efficiency > 90) quality = "High";
  else if (efficiency > 75) quality = "Medium";

  // Off-body handling: if RMS variance is tiny, mark accordingly
  if (offBody) {
    return {
      duration: 0,
      efficiency: 0,
      quality: "Unknown (off-body)",
      details: {
        reason: "off-body-or-flat",
        variance,
        meanRms,
      },
    };
  }

  return {
    duration: durationHrs,
    efficiency,
    quality,
    details: {
      sampleIntervalMinutes,
      threshold,
      meanRms,
      variance,
      totalInBedMinutes,
      lowActivityMinutes,
      blocks: blocks.map((b) => ({
        startIdx: b.startIdx,
        endIdx: b.endIdx,
        minutes: b.minutes,
      })),
      chosenBlock: chosenBlock
        ? {
            startIdx: chosenBlock.startIdx,
            endIdx: chosenBlock.endIdx,
            minutes: chosenBlock.minutes,
          }
        : null,
    },
  };
}

app.listen(3000, "0.0.0.0", () =>
  console.log("Backend listening on port 3000")
);
