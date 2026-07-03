import { fixedWindow } from "./fixedWindow.js";
import { slidingWindowCounter } from "./slidingWindowCounter.js";
import { tokenBucket } from "./tokenBucket.js";
import { leakyBucket } from "./leakyBucket.js";

export const ALGORITHM_REGISTRY = {
  fixed_window: fixedWindow,
  sliding_window_counter: slidingWindowCounter,
  token_bucket: tokenBucket,
  leaky_bucket: leakyBucket,
};

export function runAlgorithm(name, redis, params) {
  const fn = ALGORITHM_REGISTRY[name];
  if (!fn) {
    throw new Error(`Unknown rate limiting algorithm: ${name}`);
  }
  return fn(redis, params);
}
