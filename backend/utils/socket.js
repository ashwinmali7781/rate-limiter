let io = null;

export function setIo(instance) {
  io = instance;
}

export function emitLive(event, payload) {
  if (io) io.emit(event, payload);
}
