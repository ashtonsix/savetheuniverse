#!/bin/bash
Xvfb :87 &
XVFB_PID=$!
export DISPLAY=:87

nvcc -o main src/main.cu -lGLEW -lGL -lGLU -lglfw -lX11 -lgstreamer-1.0

./main

kill -SIGTERM $XVFB_PID