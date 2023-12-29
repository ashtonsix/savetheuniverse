#include "util.h"
#include "simulation.h"
#include "renderer.h"
#include <cuda_runtime.h>
#include <jpeglib.h>
#include <cstdio>

struct Camera
{
    int width;
    int height;
    int quality;
};

unsigned char *frame_buffer = nullptr;
unsigned long frame_size = 0;
unsigned char *d_pixel_data = nullptr;
unsigned char *h_pixel_data = nullptr;

Camera *h_camera = nullptr;
Camera *d_camera = nullptr;

void Renderer::init(int width, int height, int quality)
{
    CHECK_CUDA(cudaMallocHost((void **)&h_pixel_data, width * height * 3 * sizeof(unsigned char)));
    CHECK_CUDA(cudaMalloc(&d_pixel_data, width * height * 3 * sizeof(unsigned char)));

    CHECK_CUDA(cudaMallocHost(&h_camera, sizeof(Camera)));
    CHECK_CUDA(cudaMalloc(&d_camera, sizeof(Camera)));
    update_camera(width, height, quality);
}

void Renderer::update_camera(int width, int height, int quality)
{
    h_camera->width = width;
    h_camera->height = height;
    h_camera->quality = quality;
    CHECK_CUDA(cudaMemcpy(d_camera, h_camera, sizeof(Camera), cudaMemcpyHostToDevice));
}

__global__ void k_draw(Camera *camera, float2 *g_state, Simulation::StateConstant *c_state, unsigned char *pixel_data)
{
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    int idy = blockIdx.y * blockDim.y + threadIdx.y;

    if (idx >= camera->width || idy >= camera->height)
        return;

    int pixdex = (idy * c_state->width + idx) * 3;
    float2 value = g_state[idy * c_state->width + idx];

    float mag = hypotf(value.x, value.y) * 1.0f;

    unsigned char color = static_cast<unsigned char>((mag) * 128.0f);
    pixel_data[pixdex] = color;
    pixel_data[pixdex + 1] = color;
    pixel_data[pixdex + 2] = color;
}

void Renderer::draw(unsigned char *&out_buffer, unsigned long &out_size)
{
    using namespace Simulation;

    dim3 dimBlock(16, 16);
    dim3 dimGrid((h_camera->width + dimBlock.x - 1) / dimBlock.x, (h_camera->height + dimBlock.y - 1) / dimBlock.y);
    CHECK_CUDA((k_draw<<<dimGrid, dimBlock>>>(d_camera, d_g_state, d_c_state, d_pixel_data)));
    cudaDeviceSynchronize();
    CHECK_CUDA(cudaMemcpy(h_pixel_data, d_pixel_data, h_camera->width * h_camera->height * 3 * sizeof(unsigned char), cudaMemcpyDeviceToHost));

    jpeg_compress_struct cinfo;
    jpeg_error_mgr jerr;
    cinfo.err = jpeg_std_error(&jerr);
    jpeg_create_compress(&cinfo);

    jpeg_mem_dest(&cinfo, &frame_buffer, &frame_size);

    cinfo.image_width = h_camera->width;
    cinfo.image_height = h_camera->height;
    cinfo.input_components = 3;
    cinfo.in_color_space = JCS_RGB;
    jpeg_set_defaults(&cinfo);
    jpeg_set_quality(&cinfo, h_camera->quality, TRUE);
    jpeg_start_compress(&cinfo, TRUE);

    JSAMPROW row_pointer[1];
    while (cinfo.next_scanline < cinfo.image_height)
    {
        row_pointer[0] = &h_pixel_data[cinfo.next_scanline * h_c_state->width * 3];
        jpeg_write_scanlines(&cinfo, row_pointer, 1);
    }

    jpeg_finish_compress(&cinfo);
    jpeg_destroy_compress(&cinfo);

    out_buffer = frame_buffer;
    out_size = frame_size;
}

void Renderer::cleanup()
{
    cudaFree(d_pixel_data);
    cudaFree(d_camera);

    cudaFreeHost(h_pixel_data);
    cudaFreeHost(h_camera);
    h_pixel_data = nullptr;
    h_camera = nullptr;

    delete[] frame_buffer;
    frame_buffer = nullptr;
    frame_size = 0;
}
