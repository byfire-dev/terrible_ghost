export const NETWORK_MESSAGE = {
  JOIN: "join",
  INPUT: "input",
  SNAPSHOT: "snapshot",
  LEAVE: "leave",
};

export function createNetworkClient(url, handlers = {}) {
  const socket = new WebSocket(url);

  socket.addEventListener("open", () => handlers.open?.());
  socket.addEventListener("close", () => handlers.close?.());
  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);
      handlers.message?.(message);
    } catch {
      handlers.error?.(new Error("Invalid network message"));
    }
  });
  socket.addEventListener("error", () => handlers.error?.(new Error("Network error")));

  return {
    send(type, payload = {}) {
      if (socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify({ type, payload, time: Date.now() }));
      return true;
    },
    close() {
      socket.close();
    },
  };
}
