import mongoose from "mongoose";

export async function connectMongo() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/rate_limiter";
  mongoose.set("strictQuery", true);

  await mongoose.connect(uri);
  console.log(`[mongo] connected -> ${mongoose.connection.name}`);

  mongoose.connection.on("error", (err) => {
    console.error("[mongo] connection error:", err.message);
  });

  return mongoose.connection;
}
