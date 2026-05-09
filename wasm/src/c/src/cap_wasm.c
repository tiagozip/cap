#include "cap_wasm.h"

#include <stddef.h>

extern unsigned char __heap_base;

#define SHA256_BLOCK_SIZE 64u
#define SHA256_DIGEST_SIZE 32u
#define WASM_PAGE_SIZE 65536u

typedef struct {
  uint32_t state[8];
  uint64_t bitlen;
  uint8_t buffer[SHA256_BLOCK_SIZE];
  uint32_t buffer_len;
} sha256_ctx;

static uint32_t heap_cursor = 0;

static void trap(void) {
  __builtin_trap();
}

static uint32_t align_up(uint32_t value, uint32_t align) {
  if (align <= 1u) {
    return value;
  }
  return (value + (align - 1u)) & ~(align - 1u);
}

static void copy_bytes(uint8_t *dst, const uint8_t *src, uint32_t len) {
  for (uint32_t i = 0; i < len; ++i) {
    dst[i] = src[i];
  }
}

static void ensure_capacity(uint32_t end) {
  uint32_t current_pages = (uint32_t)__builtin_wasm_memory_size(0);
  uint32_t current_bytes = current_pages * WASM_PAGE_SIZE;

  if (end <= current_bytes) {
    return;
  }

  uint32_t needed_bytes = end - current_bytes;
  uint32_t grow_pages = (needed_bytes + WASM_PAGE_SIZE - 1u) / WASM_PAGE_SIZE;
  int32_t previous_pages = __builtin_wasm_memory_grow(0, (int32_t)grow_pages);
  if (previous_pages < 0) {
    trap();
  }
}

static void *wasm_alloc(uint32_t size, uint32_t align) {
  if (size == 0u) {
    return (void *)0;
  }

  if (heap_cursor == 0u) {
    heap_cursor = (uint32_t)(uintptr_t)&__heap_base;
  }

  uint32_t cursor = align_up(heap_cursor, align);
  uint32_t end = cursor + size;
  if (end < cursor) {
    trap();
  }

  ensure_capacity(end);
  heap_cursor = end;
  return (void *)(uintptr_t)cursor;
}

static uint32_t hex_value(char c) {
  if (c >= '0' && c <= '9') {
    return (uint32_t)(c - '0');
  }
  if (c >= 'a' && c <= 'f') {
    return (uint32_t)(c - 'a' + 10);
  }
  if (c >= 'A' && c <= 'F') {
    return (uint32_t)(c - 'A' + 10);
  }

  trap();
  return 0;
}

static void parse_hex_target(const char *target, uint32_t target_len, uint8_t *out) {
  uint32_t padded_len = target_len + (target_len & 1u);
  uint32_t out_len = padded_len / 2u;

  for (uint32_t i = 0; i < out_len; ++i) {
    uint32_t src_index = i * 2u;
    char hi = target[src_index];
    char lo = (src_index + 1u < target_len) ? target[src_index + 1u] : '0';
    out[i] = (uint8_t)((hex_value(hi) << 4u) | hex_value(lo));
  }
}

static uint32_t write_u64_to_buffer(uint64_t value, uint8_t *buffer) {
  if (value == 0u) {
    buffer[0] = (uint8_t)'0';
    return 1u;
  }

  uint32_t len = 0u;
  uint64_t temp = value;

  while (temp > 0u) {
    ++len;
    temp /= 10u;
  }

  for (uint32_t i = len; i-- > 0u;) {
    buffer[i] = (uint8_t)('0' + (value % 10u));
    value /= 10u;
  }

  return len;
}

static int hash_matches_target(const uint8_t *hash, const uint8_t *target_bytes, uint32_t target_bits, uint32_t target_bytes_len) {
  uint32_t full_bytes = target_bits / 8u;
  uint32_t remaining_bits = target_bits % 8u;

  for (uint32_t i = 0; i < full_bytes; ++i) {
    if (hash[i] != target_bytes[i]) {
      return 0;
    }
  }

  if (remaining_bits > 0u && full_bytes < target_bytes_len) {
    uint8_t mask = (uint8_t)(0xFFu << (8u - remaining_bits));
    uint8_t hash_masked = (uint8_t)(hash[full_bytes] & mask);
    uint8_t target_masked = (uint8_t)(target_bytes[full_bytes] & mask);
    return hash_masked == target_masked;
  }

  return 1;
}

static uint32_t rotr32(uint32_t value, uint32_t bits) {
  return (value >> bits) | (value << (32u - bits));
}

static uint32_t load_be32(const uint8_t *p) {
  return ((uint32_t)p[0] << 24u) | ((uint32_t)p[1] << 16u) | ((uint32_t)p[2] << 8u) | (uint32_t)p[3];
}

static void store_be32(uint8_t *p, uint32_t value) {
  p[0] = (uint8_t)(value >> 24u);
  p[1] = (uint8_t)(value >> 16u);
  p[2] = (uint8_t)(value >> 8u);
  p[3] = (uint8_t)value;
}

static void store_be64(uint8_t *p, uint64_t value) {
  p[0] = (uint8_t)(value >> 56u);
  p[1] = (uint8_t)(value >> 48u);
  p[2] = (uint8_t)(value >> 40u);
  p[3] = (uint8_t)(value >> 32u);
  p[4] = (uint8_t)(value >> 24u);
  p[5] = (uint8_t)(value >> 16u);
  p[6] = (uint8_t)(value >> 8u);
  p[7] = (uint8_t)value;
}

static void sha256_transform(sha256_ctx *ctx, const uint8_t block[SHA256_BLOCK_SIZE]) {
  static const uint32_t k[64] = {
    0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
    0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
    0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
    0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
    0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
    0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
    0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
    0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u, 0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
  };

  uint32_t w[64];

  for (uint32_t i = 0; i < 16u; ++i) {
    w[i] = load_be32(block + (i * 4u));
  }

  for (uint32_t i = 16u; i < 64u; ++i) {
    uint32_t s0 = rotr32(w[i - 15u], 7u) ^ rotr32(w[i - 15u], 18u) ^ (w[i - 15u] >> 3u);
    uint32_t s1 = rotr32(w[i - 2u], 17u) ^ rotr32(w[i - 2u], 19u) ^ (w[i - 2u] >> 10u);
    w[i] = w[i - 16u] + s0 + w[i - 7u] + s1;
  }

  uint32_t a = ctx->state[0];
  uint32_t b = ctx->state[1];
  uint32_t c = ctx->state[2];
  uint32_t d = ctx->state[3];
  uint32_t e = ctx->state[4];
  uint32_t f = ctx->state[5];
  uint32_t g = ctx->state[6];
  uint32_t h = ctx->state[7];

  for (uint32_t i = 0; i < 64u; ++i) {
    uint32_t s1 = rotr32(e, 6u) ^ rotr32(e, 11u) ^ rotr32(e, 25u);
    uint32_t ch = (e & f) ^ ((~e) & g);
    uint32_t temp1 = h + s1 + ch + k[i] + w[i];
    uint32_t s0 = rotr32(a, 2u) ^ rotr32(a, 13u) ^ rotr32(a, 22u);
    uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
    uint32_t temp2 = s0 + maj;

    h = g;
    g = f;
    f = e;
    e = d + temp1;
    d = c;
    c = b;
    b = a;
    a = temp1 + temp2;
  }

  ctx->state[0] += a;
  ctx->state[1] += b;
  ctx->state[2] += c;
  ctx->state[3] += d;
  ctx->state[4] += e;
  ctx->state[5] += f;
  ctx->state[6] += g;
  ctx->state[7] += h;
}

static void sha256_init(sha256_ctx *ctx) {
  ctx->state[0] = 0x6a09e667u;
  ctx->state[1] = 0xbb67ae85u;
  ctx->state[2] = 0x3c6ef372u;
  ctx->state[3] = 0xa54ff53au;
  ctx->state[4] = 0x510e527fu;
  ctx->state[5] = 0x9b05688cu;
  ctx->state[6] = 0x1f83d9abu;
  ctx->state[7] = 0x5be0cd19u;
  ctx->bitlen = 0u;
  ctx->buffer_len = 0u;
}

static void sha256_update(sha256_ctx *ctx, const uint8_t *data, uint32_t len) {
  ctx->bitlen += (uint64_t)len * 8u;

  while (len > 0u) {
    uint32_t space = SHA256_BLOCK_SIZE - ctx->buffer_len;
    uint32_t to_copy = len < space ? len : space;

    copy_bytes(ctx->buffer + ctx->buffer_len, data, to_copy);
    ctx->buffer_len += to_copy;
    data += to_copy;
    len -= to_copy;

    if (ctx->buffer_len == SHA256_BLOCK_SIZE) {
      sha256_transform(ctx, ctx->buffer);
      ctx->buffer_len = 0u;
    }
  }
}

static void sha256_final(sha256_ctx *ctx, uint8_t out[SHA256_DIGEST_SIZE]) {
  uint32_t i = ctx->buffer_len;

  ctx->buffer[i++] = 0x80u;

  if (i > 56u) {
    while (i < SHA256_BLOCK_SIZE) {
      ctx->buffer[i++] = 0u;
    }
    sha256_transform(ctx, ctx->buffer);
    i = 0u;
  }

  while (i < 56u) {
    ctx->buffer[i++] = 0u;
  }

  store_be64(ctx->buffer + 56u, ctx->bitlen);
  sha256_transform(ctx, ctx->buffer);

  for (uint32_t j = 0; j < 8u; ++j) {
    store_be32(out + (j * 4u), ctx->state[j]);
  }
}

uint64_t solve_pow(const char *salt, uint32_t salt_len, const char *target, uint32_t target_len) {
  uint8_t nonce_buffer[20];
  uint32_t target_bits = target_len * 4u;
  uint32_t target_bytes_len = (target_len + (target_len & 1u)) / 2u;
  uint8_t *target_bytes = 0;

  if (target_bytes_len > 0u) {
    target_bytes = (uint8_t *)__builtin_alloca(target_bytes_len);
    parse_hex_target(target, target_len, target_bytes);
  }

  for (uint64_t nonce = 0u; nonce != UINT64_MAX; ++nonce) {
    uint32_t nonce_len = write_u64_to_buffer(nonce, nonce_buffer);
    uint8_t hash[SHA256_DIGEST_SIZE];

    sha256_ctx ctx;
    sha256_init(&ctx);
    sha256_update(&ctx, (const uint8_t *)salt, salt_len);
    sha256_update(&ctx, nonce_buffer, nonce_len);
    sha256_final(&ctx, hash);

    if (hash_matches_target(hash, target_bytes, target_bits, target_bytes_len)) {
      return nonce;
    }
  }

  trap();
  return 0u;
}

void *__wbindgen_malloc(uint32_t size, uint32_t align) {
  return wasm_alloc(size, align);
}

void *__wbindgen_realloc(void *ptr, uint32_t old_size, uint32_t new_size, uint32_t align) {
  if (new_size == 0u) {
    return (void *)0;
  }

  void *new_ptr = wasm_alloc(new_size, align);
  if (new_ptr == 0) {
    trap();
  }

  uint32_t copy_size = old_size < new_size ? old_size : new_size;
  if (ptr != 0 && copy_size > 0u) {
    copy_bytes((uint8_t *)new_ptr, (const uint8_t *)ptr, copy_size);
  }

  return new_ptr;
}

void __wbindgen_start(void) {
}
