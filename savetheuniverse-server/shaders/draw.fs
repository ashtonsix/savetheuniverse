#version 330 core

uniform float time;

out vec4 FragColor;

void main()
{
    FragColor = vec4(mod(time, 1.0f), 0.5f, 0.2f, 1.0f);
}