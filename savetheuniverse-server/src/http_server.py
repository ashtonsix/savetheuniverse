import asyncio
import ctypes
from ctypes import cdll, POINTER, c_ubyte, c_int, c_ulong, addressof
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
import uvicorn
import sys
import os

playing = True
step = 0

lib = cdll.LoadLibrary("./lib.so")

lib.init.argtypes = [c_int, c_int]
lib.init.restype = None

lib.step.argtypes = [POINTER(POINTER(c_ubyte)), POINTER(c_ulong)]
lib.step.restype = None

lib.cleanup.argtypes = []
lib.cleanup.restype = None

def generate_frame():
    out_buffer = POINTER(c_ubyte)()
    out_size = c_ulong()
    lib.step(ctypes.byref(out_buffer), ctypes.byref(out_size))
    frame_size = out_size.value
    return memoryview((c_ubyte * frame_size).from_address(addressof(out_buffer.contents)))

async def generate_video_stream():
    while True:
        try:
            if not playing:
                await asyncio.sleep(1 / 60)
                continue
            frame = generate_frame()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n'
                   b'Content-Length: ' + str(len(frame)).encode() + b'\r\n\r\n'
                   + frame.tobytes() + b'\r\n')
            await asyncio.sleep(1 / 60)
        except Exception as e:
            print(f"Error generating frame: {e}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/video")
async def video_endpoint():
    response = StreamingResponse(generate_video_stream(), media_type="multipart/x-mixed-replace;boundary=frame")
    response.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'
    return response

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    global playing
    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received message: {data}")
            if data == "play":
                playing = True
            elif data == "pause":
                playing = False
            elif data.startswith("mousemove"):
                coords = data.split(',')[1:]
            else:
                await websocket.send_text(f"Message not recognized: {data}")
    except Exception as e:
        print(f"Error in WebSocket: {e}")

def shutdown_event():
    lib.cleanup()

app.add_event_handler("shutdown", shutdown_event)

if __name__ == "__main__":
    os.dup2(sys.stdout.fileno(), 1)
    os.dup2(sys.stderr.fileno(), 2)
    lib.init(1024, 1024)
    uvicorn.run(app, host="0.0.0.0", port=8080)
