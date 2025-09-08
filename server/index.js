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
 * @typedef {Object} ChallengeStorage
 * @property {function(string, ChallengeData): Promise<void>} store - Store challenge data
 * @property {function(string): Promise<ChallengeData|null>} read - Retrieve challenge data
 * @property {function(string): Promise<void>} delete - Delete challenge data
 * @property {function(): Promise<string[]>} listExpired - List expired challenge tokens
 */

/**
 * @typedef {Object} TokenStorage
 * @property {function(string, number): Promise<void>} store - Store token with expiration
 * @property {function(string): Promise<number|null>} get - Retrieve token expiration
 * @property {function(string): Promise<void>} delete - Delete token
 * @property {function(): Promise<string[]>} listExpired - List expired token keys
 */

/**
 * @typedef {Object} StorageHooks
 * @property {ChallengeStorage} [challenges] - Challenge storage hooks
 * @property {TokenStorage} [tokens] - Token storage hooks
 */

/**
 * @typedef {Object} CapConfig
 * @property {string} tokens_store_path - Path to store the tokens file
 * @property {ChallengeState} state - State configuration
 * @property {boolean} noFSState - Whether to disable the state file
 * @property {boolean} [disableAutoCleanup] - Whether to disable automatic cleanup of expired tokens and challenges
 * @property {StorageHooks} [storage] - Custom storage hooks for challenges and tokens
 */

/** @type {typeof import('node:crypto')} */
const crypto = require("node:crypto");
/** @type {typeof import('node:fs/promises')} */
const fs = require("node:fs/promises");
const { EventEmitter } = require("node:events");

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

	/** @type {number} */
	_lastCleanup;

	/** @type {CapConfig} */
	config;

	/**
	 * Creates a new Cap instance
	 * @param {Partial<CapConfig>} [configObj] - Configuration object
	 */
	constructor(configObj) {
		super();
		this._cleanupPromise = null;
		this._lastCleanup = 0;
		this._tokensReady = null;
		/** @type {CapConfig} */
		this.config = {
			tokens_store_path: DEFAULT_TOKENS_STORE,
			noFSState: false,
			state: {
				challengesList: {},
				tokensList: {},
			},
			...configObj,
		};

		if (!this.config.noFSState && !this.config.storage?.tokens) {
			this._tokensReady = this._loadTokens().catch(() => {});
		} else {
			this._tokensReady = Promise.resolve();
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
	 * Performs cleanup if enough time has passed since last cleanup
	 * @private
	 * @returns {Promise<void>}
	 */
	async _lazyCleanup() {
		if (this.config.disableAutoCleanup) return;

		const now = Date.now();
		const fiveMinutes = 5 * 60 * 1000;

		if (now - this._lastCleanup > fiveMinutes) {
			await this._cleanExpiredTokens();
			this._lastCleanup = now;
		}
	}

	/**
	 * Retrieves challenge data from storage
	 * @private
	 * @param {string} token - Challenge token
	 * @returns {Promise<ChallengeData|null>} Challenge data or null if not found
	 */
	async _getChallenge(token) {
		if (this.config.storage?.challenges?.read) {
			return (await this.config.storage.challenges.read(token)) || null;
		}

		return this.config.state.challengesList[token] || null;
	}

	/**
	 * Deletes challenge from storage
	 * @private
	 * @param {string} token - Challenge token
	 * @returns {Promise<void>}
	 */
	async _deleteChallenge(token) {
		if (this.config.storage?.challenges?.delete) {
			await this.config.storage.challenges.delete(token);
		} else {
			delete this.config.state.challengesList[token];
		}
	}

	/**
	 * Generates a new challenge
	 * @param {ChallengeConfig} [conf] - Challenge configuration
	 * @returns {Promise<{ challenge: {c: number, s: number, d: number}, token?: string, expires: number }>} Challenge data
	 */
	async createChallenge(conf) {
		await this._lazyCleanup();

		/** @type {{c: number, s: number, d: number}} */
		const challenge = {
			c: conf?.challengeCount ?? 50,
			s: conf?.challengeSize ?? 32,
			d: conf?.challengeDifficulty ?? 4,
		};

		const token = crypto.randomBytes(25).toString("hex");
		const expires = Date.now() + (conf?.expiresMs ?? 600000);

		if (conf && conf.store === false) {
			return { challenge, expires };
		}

		const challengeData = { expires, challenge };

		if (this.config.storage?.challenges?.store) {
			await this.config.storage.challenges.store(token, challengeData);
		} else {
			this.config.state.challengesList[token] = challengeData;
		}

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

		await this._lazyCleanup();

		const challengeData = await this._getChallenge(token);
		await this._deleteChallenge(token);

		if (!challengeData || challengeData.expires < Date.now()) {
			return { success: false, message: "Challenge invalid or expired" };
		}

		let i = 0;

		const challenges = Array.from({ length: challengeData.challenge.c }, () => {
			i = i + 1;

			return [
				prng(`${token}${i}`, challengeData.challenge.s),
				prng(`${token}${i}d`, challengeData.challenge.d),
			];
		});

		const isValid = challenges.every(([salt, target], i) => {
			return (
				typeof solutions[i] === "number" &&
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
		const tokenKey = `${id}:${hash}`;

		if (this.config.storage?.tokens?.store) {
			await this.config.storage.tokens.store(tokenKey, expires);
		} else {
			if (this?.config?.state?.tokensList) {
				this.config.state.tokensList[tokenKey] = expires;
			}

			if (!this.config.noFSState) {
				await fs.writeFile(
					this.config.tokens_store_path,
					JSON.stringify(this.config.state.tokensList),
					"utf8",
				);
			}
		}

		return { success: true, token: `${id}:${vertoken}`, expires };
	}

	/**
	 * Retrieves token expiration from storage
	 * @private
	 * @param {string} tokenKey - Token key
	 * @returns {Promise<number|null>} Token expiration or null if not found
	 */
	async _getToken(tokenKey) {
		if (this.config.storage?.tokens?.get) {
			return await this.config.storage.tokens.get(tokenKey);
		}

		return this.config.state.tokensList[tokenKey] || null;
	}

	/**
	 * Deletes token from storage
	 * @private
	 * @param {string} tokenKey - Token key
	 * @returns {Promise<void>}
	 */
	async _deleteToken(tokenKey) {
		if (this.config.storage?.tokens?.delete) {
			await this.config.storage.tokens.delete(tokenKey);
		} else {
			delete this.config.state.tokensList[tokenKey];

			if (!this.config.noFSState) {
				await fs.writeFile(
					this.config.tokens_store_path,
					JSON.stringify(this.config.state.tokensList),
					"utf8",
				);
			}
		}
	}

	/**
	 * Validates a token
	 * @param {string} token - The token to validate
	 * @param {TokenConfig} [conf] - Validation configuration
	 * @returns {Promise<{success: boolean}>}
	 */
	async validateToken(token, conf) {
		await this._lazyCleanup();

		if (!token || typeof token !== "string") {
			return { success: false };
		}

		const parts = token.split(":");
		if (parts.length !== 2 || !parts[0] || !parts[1]) {
			return { success: false };
		}

		const [id, vertoken] = parts;
		const hash = crypto.createHash("sha256").update(vertoken).digest("hex");
		const key = `${id}:${hash}`;

		await this._waitForTokensList();

		const tokenExpires = await this._getToken(key);
		if (tokenExpires && tokenExpires > Date.now()) {
			if (!conf?.keepToken) {
				await this._deleteToken(key);
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
		if (this.config.noFSState || this.config.storage?.tokens) return;

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
				await this._lazyCleanup();
			} catch {
				console.warn(`[cap] tokens file not found, creating a new empty one`);
				await fs.writeFile(this.config.tokens_store_path, "{}", "utf-8");
				this.config.state.tokensList = {};
			}
		} catch {
			console.warn(
				`[cap] Couldn't load or write tokens file, using empty state`,
			);
			this.config.state.tokensList = {};
		}
	}

	/**
	 * Removes expired tokens and challenges from memory and storage
	 * @private
	 * @returns {Promise<boolean>} - True if any tokens were changed/removed
	 */
	async _cleanExpiredTokens() {
		const now = Date.now();
		let tokensChanged = false;

		if (this.config.storage?.challenges?.listExpired) {
			const expiredChallenges =
				await this.config.storage.challenges.listExpired();

			await Promise.all(
				expiredChallenges.map(async (token) => {
					await this._deleteChallenge(token);
				}),
			);
		} else if (!this.config.storage?.challenges) {
			const expired = Object.entries(this.config.state.challengesList)
				.filter(([_, v]) => v.expires < now)
				.map(([k]) => k);

			await Promise.all(
				expired.map(async (k) => {
					await this._deleteChallenge(k);
				}),
			);
		} else {
			console.warn(
				"[cap] challenge storage hooks provided but no listExpired, couldn't delete expired challenges",
			);
		}

		if (this.config.storage?.tokens?.listExpired) {
			const expiredTokens = await this.config.storage.tokens.listExpired();
			await Promise.all(
				expiredTokens.map(async (tokenKey) => {
					await this._deleteToken(tokenKey);
					tokensChanged = true;
				}),
			);
		} else if (!this.config.storage?.tokens) {
			for (const k in this.config.state.tokensList) {
				if (this.config.state.tokensList[k] < now) {
					await this._deleteToken(k);
					tokensChanged = true;
				}
			}
		} else {
			console.warn(
				"[cap] token storage hooks provided but no listExpired, couldn't delete expired tokens",
			);
		}

		return tokensChanged;
	}

	/**
	 * Waits for the tokens list to be initialized
	 * @private
	 * @returns {Promise<void>}
	 */
	_waitForTokensList() {
		return this._tokensReady;
	}

	/**
	 * Cleans up expired tokens and syncs state
	 * @returns {Promise<void>}
	 */
	async cleanup() {
		if (this._cleanupPromise) return this._cleanupPromise;

		this._cleanupPromise = (async () => {
			const tokensChanged = await this._cleanExpiredTokens();

			if (
				tokensChanged &&
				!this.config.noFSState &&
				!this.config.storage?.tokens?.store
			) {
				await fs.writeFile(
					this.config.tokens_store_path,
					JSON.stringify(this.config.state.tokensList),
					"utf8",
				);
			}
		})();

		return this._cleanupPromise;
	}
}

/** @type {typeof Cap} */
module.exports = Cap;
