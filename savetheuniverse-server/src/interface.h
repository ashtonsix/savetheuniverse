#include "simulation.h"
#include "renderer.h"
#include <cstdio>

extern "C" void init(int width, int height)
{
    printf("Initializing with width: %d, height: %d\n", width, height);
    Simulation::init(width, height);
    Renderer::init(width, height, 75);
    printf("Initialization completed\n");
}

extern "C" void step(unsigned char *&out_buffer, unsigned long &out_size)
{
    printf("Stepping simulation\n");
    Simulation::step();
    printf("Drawing simulation\n");
    Renderer::draw(out_buffer, out_size);
    printf("Step & draw completed, out_size: %lu\n", out_size);
}

extern "C" void cleanup()
{
    printf("Starting cleanup\n");
    Simulation::cleanup();
    Renderer::cleanup();
    printf("Cleanup completed\n");
}
