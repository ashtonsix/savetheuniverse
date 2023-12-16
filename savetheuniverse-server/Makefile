CC = g++
CFLAGS = -fPIC
LDFLAGS = -shared
LIBS = -l$(LIB_NAME)

LIBJPEG_DIR ?= /usr
LIB_NAME ?= turbojpeg

LIB_DIR = $(LIBJPEG_DIR)/lib
INCLUDE_DIR = $(LIBJPEG_DIR)/include

TARGET = videotest.so
SOURCE = videotest.cpp

all: $(TARGET)

$(TARGET): $(SOURCE)
	$(CC) $(CFLAGS) $(LDFLAGS) -L$(LIB_DIR) -I$(INCLUDE_DIR) $(LIBS) -o $@ $^

clean:
	rm -f $(TARGET)

help:
	@echo "Usage: make [all|clean|help]"
	@echo "Environment variables:"
	@echo "  LIBJPEG_DIR - Directory where libjpeg-turbo is installed (default: /usr)"
	@echo "  LIB_NAME    - Name of the libjpeg-turbo library (default: turbojpeg)"
