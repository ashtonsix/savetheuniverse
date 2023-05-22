#include <iostream>
#include <GL/glew.h>
#include <GLFW/glfw3.h>
#include <cuda_runtime.h>
#include <cuda_gl_interop.h>
// #include <gst/gst.h>

const unsigned int WIDTH = 32;
const unsigned int HEIGHT = 16;
const unsigned int NUM_ITERATIONS = 2;

void checkGLError()
{
	GLenum err = glGetError();
	if (err != GL_NO_ERROR)
	{
		std::cout << "OpenGL error: " << err << std::endl;
		exit(1);
	}
}

void checkCUDAError()
{
	cudaError_t err = cudaGetLastError();
	if (err != cudaSuccess)
	{
		std::cout << "CUDA error: " << cudaGetErrorString(err) << std::endl;
		exit(1);
	}
}

void printImage(unsigned char *data, int width, int height)
{
	FILE *fp = fopen("output.ppm", "wb"); // b - binary mode
	(void)fprintf(fp, "P6\n%d %d\n255\n", width, height);
	for (int i = 0; i < height * width; ++i)
	{
		static unsigned char color[3];
		color[0] = data[i * 4];			// red
		color[1] = data[i * 4 + 1]; // green
		color[2] = data[i * 4 + 2]; // blue
		(void)fwrite(color, 1, 3, fp);
	}
	fclose(fp);
}

int glInit(int width, int height)
{
	if (!glfwInit())
	{
		std::cerr << "Failed to initialize GLFW" << std::endl;
		return -1;
	}

	glfwWindowHint(GLFW_VISIBLE, GL_FALSE);
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

	GLFWwindow *window = glfwCreateWindow(width, height, "OpenGL", NULL, NULL);
	if (window == NULL)
	{
		std::cerr << "Failed to create GLFW window" << std::endl;
		glfwTerminate();
		return -1;
	}

	glfwMakeContextCurrent(window);

	glewExperimental = GL_TRUE;
	if (glewInit() != GLEW_OK)
	{
		std::cerr << "Failed to initialize GLEW" << std::endl;
		return -1;
	}

	return 0;
}

void glResize(int width, int height)
{
	glViewport(0, 0, width, height);
}

__global__ void game_of_life(bool *current, bool *future, int width, int height)
{
	int col = blockIdx.x * blockDim.x + threadIdx.x;
	int row = blockIdx.y * blockDim.y + threadIdx.y;
	int index = row * width + col;

	if (col < width && row < height)
	{
		int alive_neighbors = 0;
		for (int i = -1; i <= 1; i++)
		{
			for (int j = -1; j <= 1; j++)
			{
				int neigh_row = row + i;
				int neigh_col = col + j;

				if (neigh_row >= 0 && neigh_row < height && neigh_col >= 0 && neigh_col < width)
				{
					alive_neighbors += current[neigh_row * width + neigh_col] ? 1 : 0;
				}
			}
		}

		alive_neighbors -= current[index] ? 1 : 0;

		if (current[index])
		{
			future[index] = alive_neighbors == 2 || alive_neighbors == 3;
		}
		else
		{
			future[index] = alive_neighbors == 3;
		}
	}
}

__global__ void render(bool *state, uchar4 *output, int width, int height)
{
	int x = blockIdx.x * blockDim.x + threadIdx.x;
	int y = blockIdx.y * blockDim.y + threadIdx.y;

	if (x >= width || y >= height)
		return;

	int index = y * width + x;
	if (state[index])
	{
		output[index].x = 255;
		output[index].y = 0;
		output[index].z = 0;
		output[index].w = 255;
	}
	else
	{
		output[index].x = 0;
		output[index].y = 0;
		output[index].z = 0;
		output[index].w = 255;
	}
}

int main()
{
	/*
	 * OpenGL init
	 */
	if (glInit(WIDTH, HEIGHT) != 0)
	{
		std::cerr << "Failed to initialize GLEW" << std::endl;
		return -1;
	}

	GLuint pbo;
	glGenBuffers(1, &pbo);
	glBindBuffer(GL_PIXEL_UNPACK_BUFFER, pbo);
	glBufferData(GL_PIXEL_UNPACK_BUFFER, WIDTH * HEIGHT * 4, NULL, GL_DYNAMIC_DRAW);

	checkGLError();

	// connect OpenGL to CUDA
	cudaGraphicsResource *cuda_pbo_resource;
	cudaGraphicsGLRegisterBuffer(&cuda_pbo_resource, pbo, cudaGraphicsMapFlagsWriteDiscard);

	checkCUDAError();

	/*
	 * CUDA init
	 */
	bool *d_input, *d_output;
	dim3 block(16, 16);
	dim3 grid((WIDTH + block.x - 1) / block.x, (HEIGHT + block.y - 1) / block.y);

	cudaMalloc((void **)&d_input, WIDTH * HEIGHT * sizeof(bool));
	cudaMalloc((void **)&d_output, WIDTH * HEIGHT * sizeof(bool));

	bool h_input[WIDTH * HEIGHT];
	memset(h_input, 0, WIDTH * HEIGHT * sizeof(bool));

	// game of life glider
	h_input[4 * WIDTH + 4] = 1;
	h_input[5 * WIDTH + 5] = 1;
	h_input[6 * WIDTH + 3] = 1;
	h_input[6 * WIDTH + 4] = 1;
	h_input[6 * WIDTH + 5] = 1;

	cudaMemcpy(d_input, h_input, WIDTH * HEIGHT * sizeof(bool), cudaMemcpyHostToDevice);

	for (int i = 0; i < NUM_ITERATIONS; i++)
	{
		// Invoke the game of life kernel
		game_of_life<<<grid, block>>>(d_input, d_output, WIDTH, HEIGHT);
		std::swap(d_input, d_output);

		// Render into the OpenGL PBO
		uchar4 *d_pbo;
		size_t num_bytes;
		cudaGraphicsMapResources(1, &cuda_pbo_resource, 0);
		cudaGraphicsResourceGetMappedPointer((void **)&d_pbo, &num_bytes, cuda_pbo_resource);
		render<<<grid, block>>>(d_input, d_pbo, WIDTH, HEIGHT);
		cudaGraphicsUnmapResources(1, &cuda_pbo_resource, 0);

		// Wait for CUDA to finish
		cudaDeviceSynchronize();

		checkCUDAError();

		// Read to host from the PBO
		glBindBuffer(GL_PIXEL_UNPACK_BUFFER, pbo);
		GLubyte *data = new GLubyte[WIDTH * HEIGHT * 4];
		glGetBufferSubData(GL_PIXEL_UNPACK_BUFFER, 0, WIDTH * HEIGHT * sizeof(GLubyte) * 4, data);

		printImage((unsigned char *)data, WIDTH, HEIGHT);
		delete[] data;
	}

	cudaGraphicsUnregisterResource(cuda_pbo_resource);
	glUnmapBuffer(GL_PIXEL_UNPACK_BUFFER);
	glBindBuffer(GL_PIXEL_UNPACK_BUFFER, 0);
	glDeleteBuffers(1, &pbo);
	glfwTerminate();

	return 0;
}
