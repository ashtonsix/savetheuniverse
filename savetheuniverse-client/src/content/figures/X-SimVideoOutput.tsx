import { useEffect, useState, useRef } from "react";

export const SimVideoOutput = () => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const videoRef = useRef(null);

  // Establish WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket("ws://localhost:8000/ws");
    websocket.onopen = () => console.log("WebSocket Connected");
    websocket.onclose = () => console.log("WebSocket Disconnected");
    websocket.onerror = (error) => console.log("WebSocket Error:", error);
    websocket.onmessage = (msg) => console.log("WebSocket Message:", msg.data);

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  return (
    <div>
      <img
        ref={videoRef}
        src="http://localhost:8000/video"
        onMouseMove={(event) => {
          if (ws) {
            const { offsetX, offsetY } = event.nativeEvent;
            ws.send(`mousemove,${offsetX},${offsetY}`);
          }
        }}
      />
      <button
        onClick={() => {
          if (ws) ws.send("play");
        }}
      >
        Play
      </button>
      <button
        onClick={() => {
          if (ws) ws.send("pause");
        }}
      >
        Pause
      </button>
    </div>
  );
};
