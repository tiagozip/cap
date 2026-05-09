CC = clang
TARGET ?= wasm32-unknown-unknown
BUILD_DIR ?= build
OUT ?= $(BUILD_DIR)/cap_wasm.wasm
NODE_WASM := ../node/cap_wasm_bg.wasm
BROWSER_WASM := ../browser/cap_wasm_bg.wasm

CFLAGS ?= -O3 -ffreestanding -fno-builtin -fvisibility=hidden --target=$(TARGET)
INCLUDES := -Iinclude
LDFLAGS ?= -nostdlib -Wl,--no-entry -Wl,--export=solve_pow -Wl,--export=__wbindgen_malloc -Wl,--export=__wbindgen_realloc -Wl,--export=__wbindgen_start -Wl,--export-memory

SRC := src/cap_wasm.c

.PHONY: all clean sync-node sync-browser

all: $(OUT) sync-node sync-browser

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

$(OUT): $(SRC) include/cap_wasm.h | $(BUILD_DIR)
	$(CC) $(CFLAGS) $(INCLUDES) $(SRC) $(LDFLAGS) -o $(OUT)

sync-node: $(OUT)
	cp $(OUT) $(NODE_WASM)

sync-browser: $(OUT)
	cp $(OUT) $(BROWSER_WASM)

clean:
	rm -rf $(BUILD_DIR)
