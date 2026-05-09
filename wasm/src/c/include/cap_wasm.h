#ifndef CAP_WASM_H
#define CAP_WASM_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

uint64_t solve_pow(const char *salt, uint32_t salt_len, const char *target, uint32_t target_len);

void *__wbindgen_malloc(uint32_t size, uint32_t align);
void *__wbindgen_realloc(void *ptr, uint32_t old_size, uint32_t new_size, uint32_t align);
void __wbindgen_start(void);

#ifdef __cplusplus
}
#endif

#endif
