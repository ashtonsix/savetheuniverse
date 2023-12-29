#ifndef RENDERER_H
#define RENDERER_H

namespace Renderer
{
    void init(int width, int height, int quality);
    void update_camera(int width, int height, int quality);
    void draw(unsigned char *&out_buffer, unsigned long &out_size);
    void cleanup();
}

#endif // RENDERER_H
