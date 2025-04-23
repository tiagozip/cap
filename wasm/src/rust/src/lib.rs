use wasm_bindgen::prelude::*;
use sha2::{Sha256, Digest};
use hex;

#[wasm_bindgen]
pub fn solve_pow(salt: String, target: String) -> u64 {
    let salt_bytes = salt.as_bytes();
    let target_len = target.len();

    // Determine how many bytes of the hash we need to
    // compare based on the hex target length
    let required_hash_bytes = (target_len + 1) / 2;

    for nonce in 0..u64::MAX {
        let nonce_str = nonce.to_string();
        let nonce_bytes = nonce_str.as_bytes();

        let mut hasher = Sha256::new();

        hasher.update(salt_bytes);
        hasher.update(nonce_bytes);

        let hash_result = hasher.finalize(); // Returns GenericArray<u8, U32>

        let hash_prefix_bytes = &hash_result[0..required_hash_bytes.min(32)];

        let hash_prefix_hex = hex::encode(hash_prefix_bytes);

        if hash_prefix_hex.starts_with(&target) {
            return nonce;
        }
    }

    unreachable!("Solution should be found before exhausting u64::MAX");
}