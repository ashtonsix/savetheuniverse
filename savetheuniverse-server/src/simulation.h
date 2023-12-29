#ifndef SIMULATION_H
#define SIMULATION_H

namespace Simulation
{
    struct StateConstant
    {
        int width;
        int height;
    };

    extern float2 *d_g_state;
    extern StateConstant *h_c_state;
    extern StateConstant *d_c_state;
    // const StateConstant &get_d_c_state();

    void init(int width, int height);
    void update_c_state(int width, int height);
    void step();
    void cleanup();
}

#endif // SIMULATION_H
