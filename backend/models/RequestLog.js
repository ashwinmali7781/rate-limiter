import mongoose from "mongoose";

const { Schema } = mongoose;

const requestLogSchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    clientId: { type: String, required: true, index: true }, // resolved identifier value
    identifierType: { type: String, required: true },
    ip: { type: String },
    endpoint: { type: String, required: true, index: true },
    method: { type: String, default: "GET" },
    algorithm: { type: String, required: true },
    status: { type: String, enum: ["allowed", "blocked"], required: true, index: true },
    responseTimeMs: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 },
    ruleId: { type: Schema.Types.ObjectId, ref: "RateLimitRule" },
  },
  { timestamps: false }
);

// Analytics queries mostly filter by time + status, so compound index helps
requestLogSchema.index({ timestamp: -1, status: 1 });

export default mongoose.model("RequestLog", requestLogSchema);
