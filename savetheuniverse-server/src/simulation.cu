#include "util.h"
#include "simulation.h"
#include <cuda_runtime.h>
#include <cstdio>

__device__ uint4 random_init(int i, int j)
{
    uint _i = static_cast<uint>(i + 128);
    uint _j = static_cast<uint>(j + 128);
    uint4 random_state = uint4{
        (_i * 1664525 + 1013904223) ^ (_j * 22695477 + 1),
        (_i * 1103515245 + 12345) ^ (_j * 134775813 + 1),
        (_i * 8121 + 28411) ^ (_j * 4096 + 150889),
        (_i * 1229 + 2048) ^ (_j * 279470273 + 0)};

    return random_state;
}

// hybrid taus generator: https://developer.nvidia.com/gpugems/gpugems3/part-vi-gpu-computing/chapter-37-efficient-random-number-generation-and-application
__device__ float random(uint4 &random_state)
{
    random_state.x = ((random_state.x & 4294967294) << 12) ^ (((random_state.x << 13) ^ random_state.x) >> 19);
    random_state.y = ((random_state.y & 4294967288) << 4) ^ (((random_state.y << 2) ^ random_state.y) >> 25);
    random_state.z = ((random_state.z & 4294967280) << 17) ^ (((random_state.z << 3) ^ random_state.z) >> 11);
    random_state.w = 1664525 * random_state.w + 1013904223;

    return 2.3283064365387e-10 * float(random_state.x ^ random_state.y ^ random_state.z ^ random_state.w);
}

float2 *Simulation::d_g_state = nullptr;
Simulation::StateConstant *Simulation::h_c_state = nullptr;
// d_c_state is using global memory. for performance it should be using constant memory, but to make constant memory
// accessible across multiple files (renderer.cu specifically), separable compilation is required (TODO)
Simulation::StateConstant *Simulation::d_c_state = nullptr;

__global__ void k_init(float2 *g_state, Simulation::StateConstant *c_state)
{
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    int idy = blockIdx.y * blockDim.y + threadIdx.y;

    uint4 random_state = random_init(idy * c_state->width + idx, 0);
    float mag = random(random_state);
    float theta = random(random_state) * 2.0f * 3.14159265358979323846f;

    g_state[idy * c_state->width + idx] = float2{mag * cosf(theta), mag * sinf(theta)};
}

void Simulation::init(int width, int height)
{
    CHECK_CUDA(cudaMalloc(&d_g_state, width * height * sizeof(float2)));
    CHECK_CUDA(cudaMalloc(&d_c_state, sizeof(StateConstant)));
    CHECK_CUDA(cudaMallocHost(&h_c_state, sizeof(StateConstant)));
    update_c_state(width, height);

    dim3 dimBlock(32, 32);
    dim3 dimGrid((h_c_state->width + dimBlock.x - 1) / dimBlock.x, (h_c_state->height + dimBlock.y - 1) / dimBlock.y);
    CHECK_CUDA((k_init<<<dimGrid, dimBlock>>>(d_g_state, d_c_state)));
}

void Simulation::update_c_state(int width, int height)
{

    h_c_state->width = width;
    h_c_state->height = height;

    CHECK_CUDA(cudaMemcpy(d_c_state, h_c_state, sizeof(StateConstant), cudaMemcpyHostToDevice));
}

__global__ void k_step(float2 *g_state, Simulation::StateConstant *c_state)
{
    int ix = blockIdx.x * blockDim.x + threadIdx.x;
    int iy = blockIdx.y * blockDim.y + threadIdx.y;
    int radius = 17;
    int curtain = 16;

    float mag_agg = 0.0f;
    float2 dir_agg = float2{0.0f, 0.0f};

    for (int niy = iy - curtain; niy <= iy + curtain; niy++)
    {
        for (int nix = ix - curtain; nix <= ix + curtain; nix++)
        {
            if (nix == ix && niy == iy)
                continue;

            int niy_torus = (niy + c_state->height) % c_state->height;
            int nix_torus = (nix + c_state->width) % c_state->width;
            float2 rho = g_state[niy_torus * c_state->width + nix_torus];

            // Compute intermediate values
            float2 d = float2{static_cast<float>(nix - ix), static_cast<float>(niy - iy)};
            float dist = hypotf(d.x, d.y);
            float2 d_hat = float2{d.x / dist, d.y / dist};
            float d_dot_rho = d.x * rho.x + d.y * rho.y;
            float rho_magnitude = hypotf(rho.x, rho.y);
            float alpha = d_dot_rho / (dist * rho_magnitude);

            // Compute the distance function X(d)
            float normalized_distance = dist / radius;
            float Xd = max(0.0f, normalized_distance - normalized_distance * normalized_distance);

            // Compute the dispersion function D(alpha)
            float Dalpha = -0.25 * alpha * alpha + 0.5f * alpha + 0.75f;

            // Calculate the pseudo-momentum transfer
            float S = 0.010580575790320963;
            float mag = rho_magnitude * S * Xd * Dalpha;

            // Add to total
            mag_agg += mag;
            dir_agg.x += d_hat.x * mag;
            dir_agg.y += d_hat.y * mag;
        }
    }

    // use aggregates to calculate psuedo-momentum
    float dir_scalar = rhypotf(dir_agg.x, dir_agg.y) * mag_agg;
    float2 rho_prime = float2{dir_agg.x * dir_scalar, dir_agg.y * dir_scalar};

    float2 Q = float2{0.0f, 0.0f};

    // Calculate the constraint vector Q
    float2 center = float2{c_state->width / 2.0f, c_state->height / 2.0f};
    float r = c_state->width * 0.4f;
    float2 d = float2{center.x - ix, center.y - iy};
    float Qi = max(hypotf(d.x, d.y) - r, 0.0f) / 16.0f;
    Q.x = -d.x * Qi;
    Q.y = -d.y * Qi;

    // Apply the constraint vector Q
    float2 rho_prime_hat = float2{rho_prime.x / mag_agg, rho_prime.y / mag_agg};
    float2 modified = float2{Q.x + rho_prime_hat.x, Q.y + rho_prime_hat.y};
    float modified_scalar = rhypotf(modified.x, modified.y);
    modified = float2{modified.x * modified_scalar, modified.y * modified_scalar};
    float2 rho_double_prime = float2{modified.x * mag_agg, modified.y * mag_agg};

    // Update the state
    g_state[iy * c_state->width + ix] = rho_double_prime;
}

void Simulation::step()
{
    dim3 dimBlock(32, 32);
    dim3 dimGrid((h_c_state->width + dimBlock.x - 1) / dimBlock.x, (h_c_state->height + dimBlock.y - 1) / dimBlock.y);
    CHECK_CUDA((k_step<<<dimGrid, dimBlock>>>(d_g_state, d_c_state)));
}

void Simulation::cleanup()
{
    CHECK_CUDA(cudaFree(d_g_state));
    CHECK_CUDA(cudaFree(d_c_state));

    delete h_c_state;
    h_c_state = nullptr;
}
