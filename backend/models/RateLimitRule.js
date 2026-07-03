import mongoose from "mongoose";

const { Schema } = mongoose;

export const ALGORITHMS = ["fixed_window", "sliding_window_counter", "token_bucket", "leaky_bucket"];
export const IDENTIFIER_TYPES = ["user_id", "api_key", "ip", "jwt"];

const rateLimitRuleSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },

    // Which requests this rule applies to
    endpointPattern: { type: String, default: "*" }, // e.g. "/api/orders/*"
    identifierType: { type: String, enum: IDENTIFIER_TYPES, default: "ip" },

    // Algorithm + tuning
    algorithm: { type: String, enum: ALGORITHMS, default: "fixed_window" },
    limit: { type: Number, required: true, min: 1 }, // max requests
    windowSeconds: { type: Number, required: true, min: 1 }, // window size / refill period

    // token bucket / leaky bucket specific (ignored by other algorithms)
    burst: { type: Number, default: null }, // bucket capacity, defaults to `limit`
    refillRate: { type: Number, default: null }, // tokens (or leak) per second, derived from limit/windowSeconds if null

    // API Gateway mode: if set, requests to /gateway/<path matching this rule>
    // are rate-limited and then reverse-proxied to this upstream base URL.
    upstreamUrl: { type: String, default: null },

    enabled: { type: Boolean, default: true },
    createdBy: { type: String, required: true }, // Clerk user id

    priority: { type: Number, default: 0 }, // higher priority rules are evaluated first when multiple match
  },
  { timestamps: true }
);

rateLimitRuleSchema.index({ tenantId: 1, endpointPattern: 1, enabled: 1 });

export default mongoose.model("RateLimitRule", rateLimitRuleSchema);
