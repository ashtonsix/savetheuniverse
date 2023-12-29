#ifndef UTIL_H
#define UTIL_H

#include <cstdio>
#include <cstdlib>
#include <cuda_runtime.h>

inline void checkCudaErrorAux(cudaError_t err, const char *file, int line, bool abort = true)
{
    if (err != cudaSuccess)
    {
        fprintf(stderr, "CUDA Error: %s at %s:%d\n", cudaGetErrorString(err), file, line);
        if (abort)
            exit(err);
    }
}

#ifdef DEVELOPMENT
#define CHECK_CUDA(call)                                                \
    do                                                                  \
    {                                                                   \
        call;                                                           \
        checkCudaErrorAux(cudaGetLastError(), __FILE__, __LINE__);      \
        checkCudaErrorAux(cudaDeviceSynchronize(), __FILE__, __LINE__); \
    } while (0)
#else
#define CHECK_CUDA(call)                                           \
    do                                                             \
    {                                                              \
        call;                                                      \
        checkCudaErrorAux(cudaGetLastError(), __FILE__, __LINE__); \
    } while (0)
#endif

#endif // UTIL_H
