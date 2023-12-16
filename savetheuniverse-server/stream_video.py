import asyncio
from ctypes import cdll, POINTER, c_ubyte, c_int, c_ulong, addressof
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
import uvicorn

lib = cdll.LoadLibrary("./videotest.so")

lib.generate_frame.argtypes = [c_int, c_int, c_int]
lib.generate_frame.restype = None

lib.free_frame.argtypes = []
lib.free_frame.restype = None

lib.get_frame_buffer.argtypes = []
lib.get_frame_buffer.restype = POINTER(c_ubyte)

lib.get_frame_size.argtypes = []
lib.get_frame_size.restype = c_ulong

def generate_frame(width=640, height=480, quality=75):
    lib.generate_frame(width, height, quality)
    frame_size = lib.get_frame_size()
    raw_frame_buffer = lib.get_frame_buffer()
    return memoryview((c_ubyte * frame_size).from_address(addressof(raw_frame_buffer.contents)))

async def generate_video_stream():
    while True:
        try:
            frame = generate_frame()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n'
                   b'Content-Length: ' + str(len(frame)).encode() + b'\r\n\r\n'
                   + frame.tobytes() + b'\r\n')
            await asyncio.sleep(0.1)
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

@app.get("/")
async def video_endpoint():
    response = StreamingResponse(generate_video_stream(), media_type="multipart/x-mixed-replace;boundary=frame")
    response.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'
    return response

def shutdown_event():
    lib.free_frame()

app.add_event_handler("shutdown", shutdown_event)

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)