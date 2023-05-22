# Let Us Save the Universe!

Welcome to the SaveTheUniverseServer project. This project uses C++14 and requires the following dependencies: glfw3, OpenGL, and glad. You can install these dependencies using the package manager of your OS. For example, on Ubuntu you could use `sudo apt-get install libglfw3-dev libgl1-mesa-dev` to fetch glfw and OpenGL. Glad is included in the project.

To set up the project, clone the repository and use the included build script with `./scripts/build.sh` from the project root. This will create a build directory, generate makefiles, and build the application.

To run the server, use the run script with `./scripts/run.sh`. The scripts assume a Unix-like environment.

## Development

Install dependencies:

```bash
sudo apt update
sudo apt install build-essential nvidia-cuda-toolkit gcc-9 g++-9 cmake libglew-dev libglfw3-dev xvfb
sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-9 90 --slave /usr/bin/g++ g++ /usr/bin/g++-9 --slave /usr/bin/gcov gcov /usr/bin/gcov-9

git clone git clone https://github.com/ashtonsix/savetheuniverse.git
cd savetheuniverse/savetheuniverse-server
chmod +x ./scripts/*
```

Run:

```sh
./scripts/run.sh
```

Install VSCode extensions:

- C/C++
- PPM viewer

## System Design

### Visualization

After executing some steps in the physics simulation, we generate the pixel data for a single video frame via CUDA (the same technology used for the physics). The pixel data is mapped to an OpenGL buffer, and then injected into a GStreamer pipeline. This pipeline encodes the data into a video format (H.264), and streams it to the internet via WebRTC, allowing real-time video display within a web browser. Between the physics simulation and video output we keep copying of memory to a minimum, and we process everything on the GPU to keep the visualisation pipeline fast.
