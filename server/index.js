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
 * @property {Array<ChallengeTuple>} challenge - Array of [salt, target] tuples
 * @property {number} expires - Expiration timestamp
 * @property {string} token - Challenge token
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
 * @property {string} token - The challenge token
 * @property {Array<[string, string, string]>} solutions - Array of [salt, target, solution] tuples
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
   * @returns {{ challenge: Array<ChallengeTuple>, token?: string, expires: number }} Challenge data
   */
  createChallenge(conf) {
    this._cleanExpiredTokens();

    /** @type {Array<ChallengeTuple>} */
    const challenges = Array.from(
      { length: (conf && conf.challengeCount) || 50 },
      () =>
        /** @type {ChallengeTuple} */ ([
          crypto
            .randomBytes(Math.ceil(((conf && conf.challengeSize) || 32) / 2))
            .toString("hex")
            .slice(0, (conf && conf.challengeSize) || 32),
          crypto
            .randomBytes(
              Math.ceil(((conf && conf.challengeDifficulty) || 4) / 2)
            )
            .toString("hex")
            .slice(0, (conf && conf.challengeDifficulty) || 4),
        ])
    );

    const token = crypto.randomBytes(25).toString("hex");
    const expires = Date.now() + ((conf && conf.expiresMs) || 600000);

    if (conf && conf.store === false) {
      return { challenge: challenges, expires };
    }

    this.config.state.challengesList[token] = {
      challenge: challenges,
      expires,
      token,
    };

    return { challenge: challenges, token, expires };
  }

  /**
   * Redeems a challenge solution in exchange for a token
   * @param {Solution} param0 - Challenge solution data
   * @returns {Promise<{success: boolean, message?: string, token?: string, expires?: number}>}
   */
  async redeemChallenge({ token, solutions }) {
    this._cleanExpiredTokens();

    const challengeData = this.config.state.challengesList[token];
    if (!challengeData || challengeData.expires < Date.now()) {
      delete this.config.state.challengesList[token];
      return { success: false, message: "Challenge expired" };
    }

    delete this.config.state.challengesList[token];

    const isValid = challengeData.challenge.every(([salt, target]) => {
      const solution = solutions.find(([s, t]) => s === salt && t === target);
      return (
        solution &&
        crypto
          .createHash("sha256")
          .update(salt + solution[2])
          .digest("hex")
          .startsWith(target)
      );
    });

    if (!isValid) return { success: false, message: "Invalid solution" };

    const vertoken = crypto.randomBytes(15).toString("hex");
    const expires = Date.now() + 20 * 60 * 1000;
    const hash = crypto.createHash("sha256").update(vertoken).digest("hex");
    const id = crypto.randomBytes(8).toString("hex");

    if(this?.config?.state?.tokensList) this.config.state.tokensList[`${id}:${hash}`] = expires;

    if(!this.config.noFSState) {
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
      if (conf && conf.keepToken && !this.config.noFSState) {
        delete this.config.state.tokensList[key];

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
        console.log(`[cap] Tokens file not found, creating a new empty one`);
        await fs.writeFile(this.config.tokens_store_path, "{}", "utf-8");
        this.config.state.tokensList = {};
      }
    } catch (error) {
      console.log(
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
