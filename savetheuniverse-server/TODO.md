CUDA works
OpenGL works
CUDA-OpenGL intertop is not working. Likely because the CUDA context needs to be explicitly initialized, or at least configured with something like cudaSetDevice(0)

This thread looks promising:

- https://forums.developer.nvidia.com/t/cuda-opengl-interop-2-opengl-context/245629/7

Try looking at these examples:

- https://github.com/NVIDIA/cuda-samples/blob/e612904184446c81e4d5beac8755081f9662cca0/Samples/0_Introduction/simpleCUDA2GL/README.md
- https://github.com/NVIDIA/cuda-samples/tree/e612904184446c81e4d5beac8755081f9662cca0/Samples/2_Concepts_and_Techniques/EGLStream_CUDA_Interop
