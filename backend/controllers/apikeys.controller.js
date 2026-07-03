import { getAuth } from "@clerk/express";
import ApiKey from "../models/ApiKey.js";

export async function listApiKeys(req, res) {
  const { userId } = getAuth(req);
  const keys = await ApiKey.find({ ownerId: userId }).select("-keyHash");
  res.json({ keys });
}

export async function generateApiKey(req, res) {
  const { userId } = getAuth(req);
  const name = (req.body?.name || "Untitled key").slice(0, 100);
  const { raw, hash, prefix } = ApiKey.generate();

  const key = await ApiKey.create({ name, keyHash: hash, keyPrefix: prefix, ownerId: userId });

  // The raw key is only ever shown once, at creation time.
  res.status(201).json({
    key: { id: key._id, name: key.name, keyPrefix: key.keyPrefix, createdAt: key.createdAt },
    rawKey: raw,
  });
}

export async function revokeApiKey(req, res) {
  const { userId } = getAuth(req);
  const key = await ApiKey.findOneAndUpdate(
    { _id: req.params.id, ownerId: userId },
    { revoked: true },
    { new: true }
  );
  if (!key) return res.status(404).json({ error: "not_found" });
  res.json({ key: { id: key._id, revoked: key.revoked } });
}
