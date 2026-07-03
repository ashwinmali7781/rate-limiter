import mongoose from "mongoose";
import crypto from "crypto";

const { Schema } = mongoose;

const apiKeySchema = new Schema(
  {
    tenantId: { type: String, required: true, default: "default", index: true },
    name: { type: String, required: true },
    keyHash: { type: String, required: true, unique: true }, // sha256 of the raw key
    keyPrefix: { type: String, required: true }, // first 8 chars shown in UI, e.g. "rl_live_ab12"
    ownerId: { type: String, required: true, index: true }, // Clerk user id
    revoked: { type: Boolean, default: false },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

apiKeySchema.statics.hash = function (rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
};

apiKeySchema.statics.generate = function () {
  const raw = "rl_live_" + crypto.randomBytes(24).toString("hex");
  return { raw, hash: this.hash(raw), prefix: raw.slice(0, 12) };
};

export default mongoose.model("ApiKey", apiKeySchema);
