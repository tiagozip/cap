// @ts-check
/// <reference lib="dom" />
/// <reference types="node" />

/**
 * @typedef {import('node:crypto')} Crypto
 * @typedef {import('node:fs/promises')} FsPromises
 * @typedef {import('fs').PathLike} PathLike
 */

/**
 * @typedef {[string, string]} ChallengeTuple
 */

/**
 * @typedef {Object} ChallengeData
 * @property {Object} challenge - Challenge configuration object
 * @property {number} challenge.c - Number of challenges
 * @property {number} challenge.s - Size of each challenge
 * @property {number} challenge.d - Difficulty level
 * @property {number} expires - Expiration timestamp
 */

/**
 * @typedef {Object} ChallengeState
 * @property {Record<string, ChallengeData>} challengesList - Map of challenge tokens to challenge data
 * @property {Record<string, number>} tokensList - Map of token hashes to expiration timestamps
 */

/**
 * @typedef {Object} ChallengeConfig
 * @property {number} [challengeCount=50] - Number of challenges to generate
 * @property {number} [challengeSize=32] - Size of each challenge in bytes
 * @property {number} [challengeDifficulty=4] - Difficulty level of the challenge
 * @property {number} [expiresMs=600000] - Time in milliseconds until the challenge expires
 * @property {boolean} [store=true] - Whether to store the challenge in memory
 */

/**
 * @typedef {Object} TokenConfig
 * @property {boolean} [keepToken] - Whether to keep the token after validation
 */

/**
 * @typedef {Object} Solution
 * @property {string} token - Challenge token
 * @property {number[]} solutions - Array of challenge solutions
 */

/**
 * @typedef {Object} CapConfig
 * @property {string} tokens_store_path - Path to store the tokens file
 * @property {ChallengeState} state - State configuration
 * @property {boolean} noFSState - Whether to disable the state file
 */

/** @type {typeof import('node:crypto')} */
const crypto = require("crypto");
/** @type {typeof import('node:fs/promises')} */
const fs = require("fs/promises");
const { EventEmitter } = require("events");

const DEFAULT_TOKENS_STORE = ".data/tokensList.json";

/**
 * Generates a deterministic hex string of given length from a string seed
 *
 * @param {string} seed - Initial seed value
 * @param {number} length - Output hex string length
 * @returns {string} Deterministic hex string generated from the seed
 */
function prng(seed, length) {
  /**
   * @param {string} str
   */
  function fnv1a(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash +=
        (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  }

  let state = fnv1a(seed);
  let result = "";

  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  }

  while (result.length < length) {
    const rnd = next();
    result += rnd.toString(16).padStart(8, "0");
  }

  return result.substring(0, length);
}

/**
 * Main Cap class
 * @extends EventEmitter
 */
class Cap extends EventEmitter {
  /** @type {Promise<void>|null} */
  _cleanupPromise;

  /** @type {Required<CapConfig>} */
  config;

  /**
   * Creates a new Cap instance
   * @param {Partial<CapConfig>} [configObj] - Configuration object
   */
  constructor(configObj) {
    super();
    this._cleanupPromise = null;
    /** @type {Required<CapConfig>} */
    this.config = {
      tokens_store_path: DEFAULT_TOKENS_STORE,
      noFSState: false,
      state: {
        challengesList: {},
        tokensList: {},
      },
      ...configObj,
    };

    if (!this.config.noFSState) {
      this._loadTokens().catch(() => {});
    }

    process.on("beforeExit", () => this.cleanup());

    ["SIGINT", "SIGTERM", "SIGQUIT"].forEach((signal) => {
      process.once(signal, () => {
        this.cleanup()
          .then(() => process.exit(0))
          .catch(() => process.exit(1));
      });
    });
  }

  /**
   * Generates a new challenge
   * @param {ChallengeConfig} [conf] - Challenge configuration
   * @returns {{ challenge: {c: number, s: number, d: number}, token?: string, expires: number }} Challenge data
   */
  createChallenge(conf) {
    this._cleanExpiredTokens();

    /** @type {{c: number, s: number, d: number}} */
    const challenge = {
      c: (conf && conf.challengeCount) || 50,
      s: (conf && conf.challengeSize) || 32,
      d: (conf && conf.challengeDifficulty) || 4,
    };

    const token = crypto.randomBytes(25).toString("hex");
    const expires = Date.now() + ((conf && conf.expiresMs) || 600000);

    if (conf && conf.store === false) {
      return { challenge, expires };
    }

    this.config.state.challengesList[token] = { expires, challenge };

    return { challenge, token, expires };
  }

  /**
   * Redeems a challenge solution in exchange for a token
   * @param {Solution} param0 - Challenge solution data
   * @returns {Promise<{success: boolean, message?: string, token?: string, expires?: number}>}
   */
  async redeemChallenge({ token, solutions }) {
    if (
      !token ||
      !solutions ||
      !Array.isArray(solutions) ||
      solutions.some((s) => typeof s !== "number")
    ) {
      return { success: false, message: "Invalid body" };
    }

    this._cleanExpiredTokens();

    const challengeData = this.config.state.challengesList[token];
    if (!challengeData || challengeData.expires < Date.now()) {
      delete this.config.state.challengesList[token];
      return { success: false, message: "Challenge expired" };
    }

    delete this.config.state.challengesList[token];

    let i = 0;

    const challenges = Array.from(
      { length: challengeData.challenge.c },
      () => {
        i = i + 1;

        return [
          prng(`${token}${i}`, challengeData.challenge.s),
          prng(`${token}${i}d`, challengeData.challenge.d),
        ];
      }
    );

    const isValid = challenges.every(([salt, target], i) => {
      return (
        solutions[i] &&
        crypto
          .createHash("sha256")
          .update(salt + solutions[i])
          .digest("hex")
          .startsWith(target)
      );
    });

    if (!isValid) return { success: false, message: "Invalid solution" };

    const vertoken = crypto.randomBytes(15).toString("hex");
    const expires = Date.now() + 20 * 60 * 1000;
    const hash = crypto.createHash("sha256").update(vertoken).digest("hex");
    const id = crypto.randomBytes(8).toString("hex");

    if (this?.config?.state?.tokensList)
      this.config.state.tokensList[`${id}:${hash}`] = expires;

    if (!this.config.noFSState) {
      await fs.writeFile(
        this.config.tokens_store_path,
        JSON.stringify(this.config.state.tokensList),
        "utf8"
      );
    }

    return { success: true, token: `${id}:${vertoken}`, expires };
  }

  /**
   * Validates a token
   * @param {string} token - The token to validate
   * @param {TokenConfig} [conf] - Validation configuration
   * @returns {Promise<{success: boolean}>}
   */
  async validateToken(token, conf) {
    this._cleanExpiredTokens();

    const [id, vertoken] = token.split(":");
    const hash = crypto.createHash("sha256").update(vertoken).digest("hex");
    const key = `${id}:${hash}`;

    await this._waitForTokensList();

    if (this.config.state.tokensList[key]) {
      if (!(conf && conf.keepToken)) {
        delete this.config.state.tokensList[key];
      }

      if (!this.config.noFSState) {
        await fs.writeFile(
          this.config.tokens_store_path,
          JSON.stringify(this.config.state.tokensList),
          "utf8"
        );
      }

      return { success: true };
    }

    return { success: false };
  }

  /**
   * Loads tokens from the storage file
   * @private
   * @returns {Promise<void>}
   */
  async _loadTokens() {
    try {
      const dirPath = this.config.tokens_store_path
        .split("/")
        .slice(0, -1)
        .join("/");
      if (dirPath) {
        await fs.mkdir(dirPath, { recursive: true });
      }

      try {
        await fs.access(this.config.tokens_store_path);
        const data = await fs.readFile(this.config.tokens_store_path, "utf-8");
        this.config.state.tokensList = JSON.parse(data) || {};
        this._cleanExpiredTokens();
      } catch {
        console.warn(`[cap] Tokens file not found, creating a new empty one`);
        await fs.writeFile(this.config.tokens_store_path, "{}", "utf-8");
        this.config.state.tokensList = {};
      }
    } catch (error) {
      console.warn(
        `[cap] Couldn't load or write tokens file, using empty state`
      );
      this.config.state.tokensList = {};
    }
  }

  /**
   * Removes expired tokens and challenges from memory
   * @private
   * @returns {boolean} - True if any tokens were changed/removed
   */
  _cleanExpiredTokens() {
    const now = Date.now();
    let tokensChanged = false;

    for (const k in this.config.state.challengesList) {
      if (this.config.state.challengesList[k].expires < now) {
        delete this.config.state.challengesList[k];
      }
    }

    for (const k in this.config.state.tokensList) {
      if (this.config.state.tokensList[k] < now) {
        delete this.config.state.tokensList[k];
        tokensChanged = true;
      }
    }

    return tokensChanged;
  }

  /**
   * Waits for the tokens list to be initialized
   * @private
   * @returns {Promise<void>}
   */
  _waitForTokensList() {
    return new Promise((resolve) => {
      const l = () => {
        if (this.config.state.tokensList) {
          return resolve();
        }
        setTimeout(l, 10);
      };
      l();
    });
  }

  /**
   * Cleans up expired tokens and syncs state
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (this._cleanupPromise) return this._cleanupPromise;

    this._cleanupPromise = (async () => {
      const tokensChanged = this._cleanExpiredTokens();

      if (tokensChanged) {
        await fs.writeFile(
          this.config.tokens_store_path,
          JSON.stringify(this.config.state.tokensList),
          "utf8"
        );
      }
    })();

    return this._cleanupPromise;
  }
}

/** @type {typeof Cap} */
module.exports = Cap;
