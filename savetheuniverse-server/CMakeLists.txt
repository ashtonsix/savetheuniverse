cmake_minimum_required(VERSION 3.10)
project(SaveTheUniverseServer)

# Find the necessary packages
find_package(glfw3 3.3 REQUIRED)
find_package(OpenGL REQUIRED)

# Specify where to find the headers
include_directories(${OPENGL_INCLUDE_DIR} ${GLFW_INCLUDE_DIRS} include)

# Add the main executable and set C++14 as the C++ standard
file(GLOB SOURCES "src/*.cpp" "src/*.c")
add_executable(SaveTheUniverseServer ${SOURCES})
target_compile_features(SaveTheUniverseServer PUBLIC cxx_std_14)

# Add GLAD as a library
add_library(glad src/glad.c)

# Link the libraries to your project
target_link_libraries(SaveTheUniverseServer PRIVATE OpenGL::GL glfw glad)

# Copy shaders at build time
add_custom_command(TARGET SaveTheUniverseServer POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
    ${CMAKE_SOURCE_DIR}/shaders $<TARGET_FILE_DIR:SaveTheUniverseServer>/shaders)
