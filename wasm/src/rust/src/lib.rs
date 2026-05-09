// the multiway_arx kernel below is adapted from pow-buster (apache-2.0)
// https://github.com/eternal-flame-AD/pow-buster

use core::arch::wasm32::*;
use wasm_bindgen::prelude::*;

const IV: [u32; 8] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

const K32: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

#[inline(always)]
fn u32x4_ror(x: v128, shift: u32) -> v128 {
    v128_or(u32x4_shr(x, shift), u32x4_shl(x, 32 - shift))
}

fn multiway_arx(state: &mut [v128; 8], block: &mut [v128; 16]) {
    let [a, b, c, d, e, f, g, h] = state;

    for i in 0..64 {
        let w = if i < 16 {
            block[i]
        } else {
            let w15 = block[(i - 15) % 16];
            let s0 = v128_xor(
                v128_xor(u32x4_ror(w15, 7), u32x4_ror(w15, 18)),
                u32x4_shr(w15, 3),
            );
            let w2 = block[(i - 2) % 16];
            let s1 = v128_xor(
                v128_xor(u32x4_ror(w2, 17), u32x4_ror(w2, 19)),
                u32x4_shr(w2, 10),
            );
            block[i % 16] = u32x4_add(block[i % 16], s0);
            block[i % 16] = u32x4_add(block[i % 16], block[(i - 7) % 16]);
            block[i % 16] = u32x4_add(block[i % 16], s1);
            block[i % 16]
        };
        let s1 = v128_xor(
            v128_xor(u32x4_ror(*e, 6), u32x4_ror(*e, 11)),
            u32x4_ror(*e, 25),
        );
        let ch = v128_xor(v128_and(*e, *f), v128_andnot(*g, *e));
        let mut t1 = s1;
        t1 = u32x4_add(t1, ch);
        t1 = u32x4_add(t1, u32x4_splat(K32[i]));
        t1 = u32x4_add(t1, w);
        t1 = u32x4_add(t1, *h);
        let s0 = v128_xor(
            v128_xor(u32x4_ror(*a, 2), u32x4_ror(*a, 13)),
            u32x4_ror(*a, 22),
        );
        let maj = v128_xor(
            v128_xor(v128_and(*a, *b), v128_and(*a, *c)),
            v128_and(*b, *c),
        );
        let t2 = u32x4_add(s0, maj);
        *h = *g;
        *g = *f;
        *f = *e;
        *e = u32x4_add(*d, t1);
        *d = *c;
        *c = *b;
        *b = *a;
        *a = u32x4_add(t1, t2);
    }
}

#[inline(always)]
fn build_block_words(msg: &[u8]) -> [u32; 16] {
    debug_assert!(msg.len() < 56);
    let mut buf = [0u8; 64];
    buf[..msg.len()].copy_from_slice(msg);
    buf[msg.len()] = 0x80;
    let bit_len = (msg.len() as u64) * 8;
    buf[56..64].copy_from_slice(&bit_len.to_be_bytes());
    let mut words = [0u32; 16];
    for i in 0..16 {
        words[i] = u32::from_be_bytes([buf[4 * i], buf[4 * i + 1], buf[4 * i + 2], buf[4 * i + 3]]);
    }
    words
}

#[inline(always)]
fn sha256_4way_single_block(msgs: [&[u8]; 4]) -> [v128; 8] {
    let w0 = build_block_words(msgs[0]);
    let w1 = build_block_words(msgs[1]);
    let w2 = build_block_words(msgs[2]);
    let w3 = build_block_words(msgs[3]);
    let mut block: [v128; 16] = core::array::from_fn(|i| u32x4(w0[i], w1[i], w2[i], w3[i]));
    let mut state: [v128; 8] = core::array::from_fn(|i| u32x4_splat(IV[i]));
    let init = state;
    multiway_arx(&mut state, &mut block);
    for i in 0..8 {
        state[i] = u32x4_add(init[i], state[i]);
    }
    state
}

#[inline(always)]
fn extract_top_words(state: [v128; 8]) -> ([u32; 4], [u32; 4]) {
    let s0 = state[0];
    let s1 = state[1];
    (
        [
            u32x4_extract_lane::<0>(s0),
            u32x4_extract_lane::<1>(s0),
            u32x4_extract_lane::<2>(s0),
            u32x4_extract_lane::<3>(s0),
        ],
        [
            u32x4_extract_lane::<0>(s1),
            u32x4_extract_lane::<1>(s1),
            u32x4_extract_lane::<2>(s1),
            u32x4_extract_lane::<3>(s1),
        ],
    )
}

#[derive(Clone, Copy)]
struct Target {
    hi: u32,
    lo: u32,
    mask_hi: u32,
    mask_lo: u32,
}

fn parse_target(target: &str) -> Target {
    let bits = target.len() * 4;
    assert!(
        bits <= 64,
        "Cap target longer than 64 bits is impractical to solve"
    );
    // right-pad with zeros to 16 hex chars then parse as two u32s.
    let mut padded = [b'0'; 16];
    padded[..target.len()].copy_from_slice(target.as_bytes());
    let hi =
        u32::from_str_radix(unsafe { core::str::from_utf8_unchecked(&padded[..8]) }, 16).unwrap();
    let lo =
        u32::from_str_radix(unsafe { core::str::from_utf8_unchecked(&padded[8..]) }, 16).unwrap();
    let mask_hi = if bits >= 32 {
        0xffff_ffffu32
    } else {
        (!0u32).checked_shl((32 - bits) as u32).unwrap_or(0)
    };
    let mask_lo = if bits >= 64 {
        0xffff_ffffu32
    } else if bits <= 32 {
        0
    } else {
        (!0u32) << (64 - bits)
    };
    Target {
        hi: hi & mask_hi,
        lo: lo & mask_lo,
        mask_hi,
        mask_lo,
    }
}

#[inline(always)]
fn target_matches(word0: u32, word1: u32, t: &Target) -> bool {
    (word0 & t.mask_hi) == t.hi && (word1 & t.mask_lo) == t.lo
}

#[inline(always)]
fn write_u64_decimal(mut v: u64, buf: &mut [u8; 20]) -> usize {
    if v == 0 {
        buf[0] = b'0';
        return 1;
    }
    let mut len = 0;
    let mut t = v;
    while t > 0 {
        len += 1;
        t /= 10;
    }
    for i in (0..len).rev() {
        buf[i] = (v % 10) as u8 + b'0';
        v /= 10;
    }
    len
}

#[inline(always)]
fn sha256_top64_single_block(msg: &[u8]) -> (u32, u32) {
    debug_assert!(msg.len() < 56);
    let mut buf = [0u8; 64];
    buf[..msg.len()].copy_from_slice(msg);
    buf[msg.len()] = 0x80;
    let bit_len = (msg.len() as u64) * 8;
    buf[56..64].copy_from_slice(&bit_len.to_be_bytes());

    let mut w = [0u32; 64];
    for i in 0..16 {
        w[i] = u32::from_be_bytes([buf[4 * i], buf[4 * i + 1], buf[4 * i + 2], buf[4 * i + 3]]);
    }
    for i in 16..64 {
        let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
        let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
        w[i] = w[i - 16]
            .wrapping_add(s0)
            .wrapping_add(w[i - 7])
            .wrapping_add(s1);
    }
    let mut a = IV[0];
    let mut b = IV[1];
    let mut c = IV[2];
    let mut d = IV[3];
    let mut e = IV[4];
    let mut f = IV[5];
    let mut g = IV[6];
    let mut h = IV[7];
    for i in 0..64 {
        let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
        let ch = (e & f) ^ ((!e) & g);
        let t1 = h
            .wrapping_add(s1)
            .wrapping_add(ch)
            .wrapping_add(K32[i])
            .wrapping_add(w[i]);
        let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let t2 = s0.wrapping_add(maj);
        h = g;
        g = f;
        f = e;
        e = d.wrapping_add(t1);
        d = c;
        c = b;
        b = a;
        a = t1.wrapping_add(t2);
    }
    (IV[0].wrapping_add(a), IV[1].wrapping_add(b))
}

#[inline(always)]
fn check_full_match_scalar(salt: &[u8], nonce: u64, t: &Target) -> bool {
    let mut nbuf = [0u8; 20];
    let n = write_u64_decimal(nonce, &mut nbuf);
    let total = salt.len() + n;
    if total >= 56 {
        return false;
    } // not reached with normal Cap params.
    let mut msg = [0u8; 55];
    msg[..salt.len()].copy_from_slice(salt);
    msg[salt.len()..total].copy_from_slice(&nbuf[..n]);
    let (w0, w1) = sha256_top64_single_block(&msg[..total]);
    target_matches(w0, w1, t)
}

#[inline(always)]
fn try_batch_simd(salt: &[u8], nonces: [u64; 4], t: &Target) -> Option<u64> {
    let mut nbufs: [[u8; 20]; 4] = [[0; 20]; 4];
    let mut nlens = [0usize; 4];
    for k in 0..4 {
        nlens[k] = write_u64_decimal(nonces[k], &mut nbufs[k]);
    }
    let dlen = nlens[0];
    let mut msgs: [[u8; 55]; 4] = [[0; 55]; 4];
    let total_len = salt.len() + dlen;
    if total_len >= 56 {
        for k in 0..4 {
            if check_full_match_scalar(salt, nonces[k], t) {
                return Some(nonces[k]);
            }
        }
        return None;
    }
    for k in 0..4 {
        msgs[k][..salt.len()].copy_from_slice(salt);
        msgs[k][salt.len()..salt.len() + dlen].copy_from_slice(&nbufs[k][..dlen]);
    }
    let m_refs = [
        &msgs[0][..total_len],
        &msgs[1][..total_len],
        &msgs[2][..total_len],
        &msgs[3][..total_len],
    ];
    let state = sha256_4way_single_block(m_refs);
    let (w0s, w1s) = extract_top_words(state);
    for lane in 0..4 {
        if target_matches(w0s[lane], w1s[lane], t) {
            return Some(nonces[lane]);
        }
    }
    None
}

#[wasm_bindgen]
pub fn solve_pow(salt: String, target: String) -> u64 {
    let salt_bytes = salt.as_bytes();
    let t = parse_target(&target);

    for n in 0..16u64 {
        if check_full_match_scalar(salt_bytes, n, &t) {
            return n;
        }
    }

    let mut digit_count: u32 = 2;
    let mut start: u64 = 16;
    loop {
        let end_excl: u64 = if digit_count >= 19 {
            u64::MAX
        } else {
            10u64.pow(digit_count)
        };
        let lower = 10u64.pow(digit_count - 1);
        if start < lower {
            start = lower;
        }
        let mut n = start;
        while n + 4 <= end_excl {
            if let Some(found) = try_batch_simd(salt_bytes, [n, n + 1, n + 2, n + 3], &t) {
                return found;
            }
            n += 4;
        }
        while n < end_excl {
            if check_full_match_scalar(salt_bytes, n, &t) {
                return n;
            }
            n += 1;
        }
        start = end_excl;
        digit_count += 1;
        if digit_count > 19 {
            break;
        }
    }
    unreachable!("solver exhausted u64::MAX")
}
