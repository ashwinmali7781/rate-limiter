export function notFound(req, res) {
  res.status(404).json({ error: "not_found", message: `No route for ${req.method} ${req.path}` });
}

export function errorHandler(err, req, res, next) {
  console.error("[error]", err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.code || "internal_error",
    message: status === 500 ? "Something went wrong." : err.message,
  });
}
