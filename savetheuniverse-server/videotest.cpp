#include <cstddef>
#include <cstdio>
#include <jpeglib.h>
#include <cstdlib>

unsigned char *frame_buffer = nullptr;
unsigned long frame_size = 0;

/**
 * Generates a random frame of image data in the JPEG format.
 *
 * @param width The width of the image in pixels.
 * @param height The height of the image in pixels.
 * @param quality The compression quality of the image, where 1 is the highest quality and 100 is the lowest quality.
 */
extern "C" void generate_frame(int width, int height, int quality)
{
	// Create a buffer to hold the pixel data
	unsigned char *pixel_data = new unsigned char[width * height * 3];

	// Fill the buffer with random data
	for (int i = 0; i < width * height * 3; i++)
	{
		pixel_data[i] = rand() % 256;
	}

	// Create a JPEG compression structure
	jpeg_compress_struct cinfo;
	jpeg_error_mgr jerr;
	JSAMPROW row_pointer[1];

	cinfo.err = jpeg_std_error(&jerr);
	jpeg_create_compress(&cinfo);

	// Set up the destination for the compressed image data
	jpeg_mem_dest(&cinfo, &frame_buffer, &frame_size);

	// Set the dimensions of the image
	cinfo.image_width = width;
	cinfo.image_height = height;
	cinfo.input_components = 3;
	cinfo.in_color_space = JCS_RGB;

	// Set default compression parameters
	jpeg_set_defaults(&cinfo);

	// Set the compression quality
	jpeg_set_quality(&cinfo, quality, TRUE);

	// Start the compression process
	jpeg_start_compress(&cinfo, TRUE);

	// Loop through each row of the image and compress it
	while (cinfo.next_scanline < cinfo.image_height)
	{
		// Set the pointer to the current row of pixel data
		row_pointer[0] = &pixel_data[cinfo.next_scanline * width * 3];

		// Compress the row of pixel data
		jpeg_write_scanlines(&cinfo, row_pointer, 1);
	}

	// Finish the compression process
	jpeg_finish_compress(&cinfo);

	// Destroy the JPEG compression structure
	jpeg_destroy_compress(&cinfo);

	// Delete the pixel data buffer
	delete[] pixel_data;
}

/**
 * Frees the memory allocated for the frame buffer.
 */
extern "C" void free_frame()
{
	free(frame_buffer);
	frame_buffer = nullptr;
	frame_size = 0;
}

/**
 * Returns a pointer to the frame buffer containing the compressed image data.
 *
 * @return A pointer to the frame buffer, or NULL if the frame buffer has not been allocated.
 */
extern "C" unsigned char *get_frame_buffer()
{
	return frame_buffer;
}

/**
 * Returns the size of the frame buffer containing the compressed image data.
 *
 * @return The size of the frame buffer, in bytes, or 0 if the frame buffer has not been allocated.
 */
extern "C" unsigned long get_frame_size()
{
	return frame_size;
}
