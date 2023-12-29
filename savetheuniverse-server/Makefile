CUDA_PATH ?= /usr/local/cuda
LIBJPEG_DIR ?= /usr

LIBS = -ljpeg -lcudart
LIB_DIRS = -L/usr/lib/x86_64-linux-gnu -L$(CUDA_PATH)/lib64
INCLUDE_DIRS = -I$(LIBJPEG_DIR)/include -I$(CUDA_PATH)/include

TARGET = lib.so
SOURCES = $(wildcard src/*.cu)

all: $(TARGET)

dev: FLAGS += -DDEVELOPMENT
dev: $(TARGET)

$(TARGET): $(SOURCES)
	nvcc -Xcompiler -fPIC -shared $(FLAGS) $(LIB_DIRS) $(INCLUDE_DIRS) $(LIBS) -o $@ $(SOURCES)

clean:
	rm -f $(TARGET)

help:
	@echo "Usage: make [all|dev|clean|help]"
	@echo "Environment variables:"
	@echo "  LIBJPEG_DIR - Directory where libjpeg-turbo is installed (default: /usr)"
	@echo "  CUDA_PATH   - Path to the CUDA installation (default: /usr/local/cuda)"
