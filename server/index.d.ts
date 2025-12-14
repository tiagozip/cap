export = Cap;
/**
 * Main Cap class
 * @extends EventEmitter
 */
declare class Cap extends EventEmitter<any> {
    /**
     * Creates a new Cap instance
     * @param {Partial<CapConfig>} [configObj] - Configuration object
     */
    constructor(configObj?: Partial<CapConfig>);
    /** @type {Promise<void>|null} */
    _cleanupPromise: Promise<void> | null;
    /** @type {number} */
    _lastCleanup: number;
    /** @type {CapConfig} */
    config: CapConfig;
    /**
     * Performs cleanup if enough time has passed since last cleanup
     * @private
     * @returns {Promise<void>}
     */
    private _lazyCleanup;
    /**
     * Retrieves challenge data from storage
     * @private
     * @param {string} token - Challenge token
     * @returns {Promise<ChallengeData|null>} Challenge data or null if not found
     */
    private _getChallenge;
    /**
     * Deletes challenge from storage
     * @private
     * @param {string} token - Challenge token
     * @returns {Promise<void>}
     */
    private _deleteChallenge;
    /**
     * Generates a new challenge
     * @param {ChallengeConfig} [conf] - Challenge configuration
     * @returns {Promise<{ challenge: {c: number, s: number, d: number}, token?: string, expires: number }>} Challenge data
     */
    createChallenge(conf?: ChallengeConfig): Promise<{
        challenge: {
            c: number;
            s: number;
            d: number;
        };
        token?: string;
        expires: number;
    }>;
    /**
     * Redeems a challenge solution in exchange for a token
     * @param {Solution} param0 - Challenge solution data
     * @returns {Promise<{success: boolean, message?: string, token?: string, expires?: number}>}
     */
    redeemChallenge({ token, solutions }: Solution): Promise<{
        success: boolean;
        message?: string;
        token?: string;
        expires?: number;
    }>;
    /**
     * Retrieves token expiration from storage
     * @private
     * @param {string} tokenKey - Token key
     * @returns {Promise<number|null>} Token expiration or null if not found
     */
    private _getToken;
    /**
     * Deletes token from storage
     * @private
     * @param {string} tokenKey - Token key
     * @returns {Promise<void>}
     */
    private _deleteToken;
    /**
     * Validates a token
     * @param {string} token - The token to validate
     * @param {TokenConfig} [conf] - Validation configuration
     * @returns {Promise<{success: boolean}>}
     */
    validateToken(token: string, conf?: TokenConfig): Promise<{
        success: boolean;
    }>;
    /**
     * Loads tokens from the storage file
     * @private
     * @returns {Promise<void>}
     */
    private _loadTokens;
    /**
     * Removes expired tokens and challenges from memory and storage
     * @private
     * @returns {Promise<boolean>} - True if any tokens were changed/removed
     */
    private _cleanExpiredTokens;
    /**
     * Waits for the tokens list to be initialized
     * @private
     * @returns {Promise<void>}
     */
    private _waitForTokensList;
    /**
     * Cleans up expired tokens and syncs state
     * @returns {Promise<void>}
     */
    cleanup(): Promise<void>;
}
declare namespace Cap {
    export { Crypto, FsPromises, PathLike, ChallengeTuple, ChallengeData, ChallengeState, ChallengeConfig, TokenConfig, Solution, ChallengeStorage, TokenStorage, StorageHooks, CapConfig };
}
import { EventEmitter } from "node:events";
type Crypto = typeof import("node:crypto");
type FsPromises = typeof import("node:fs/promises");
type PathLike = import("fs").PathLike;
type ChallengeTuple = [string, string];
type ChallengeData = {
    /**
     * - Challenge configuration object
     */
    challenge: {
        c: number;
        s: number;
        d: number;
    };
    /**
     * - Expiration timestamp
     */
    expires: number;
};
type ChallengeState = {
    /**
     * - Map of challenge tokens to challenge data
     */
    challengesList: Record<string, ChallengeData>;
    /**
     * - Map of token hashes to expiration timestamps
     */
    tokensList: Record<string, number>;
};
type ChallengeConfig = {
    /**
     * - Number of challenges to generate
     */
    challengeCount?: number | undefined;
    /**
     * - Size of each challenge in bytes
     */
    challengeSize?: number | undefined;
    /**
     * - Difficulty level of the challenge
     */
    challengeDifficulty?: number | undefined;
    /**
     * - Time in milliseconds until the challenge expires
     */
    expiresMs?: number | undefined;
    /**
     * - Whether to store the challenge in memory
     */
    store?: boolean | undefined;
};
type TokenConfig = {
    /**
     * - Whether to keep the token after validation
     */
    keepToken?: boolean | undefined;
};
type Solution = {
    /**
     * - Challenge token
     */
    token: string;
    /**
     * - Array of challenge solutions
     */
    solutions: number[];
};
type ChallengeStorage = {
    /**
     * - Store challenge data
     */
    store: (arg0: string, arg1: ChallengeData) => Promise<void>;
    /**
     * - Retrieve challenge data
     */
    read: (arg0: string) => Promise<ChallengeData | null>;
    /**
     * - Delete challenge data
     */
    delete: (arg0: string) => Promise<void>;
    /**
     * - Delete expired challenge tokens
     */
    deleteExpired: () => Promise<void>;
};
type TokenStorage = {
    /**
     * - Store token with expiration
     */
    store: (arg0: string, arg1: number) => Promise<void>;
    /**
     * - Retrieve token expiration
     */
    get: (arg0: string) => Promise<number | null>;
    /**
     * - Delete token
     */
    delete: (arg0: string) => Promise<void>;
    /**
     * - Delete expired token keys
     */
    deleteExpired: () => Promise<void>;
};
type StorageHooks = {
    /**
     * - Challenge storage hooks
     */
    challenges?: ChallengeStorage | undefined;
    /**
     * - Token storage hooks
     */
    tokens?: TokenStorage | undefined;
};
type CapConfig = {
    /**
     * - Path to store the tokens file
     */
    tokens_store_path: string;
    /**
     * - State configuration
     */
    state: ChallengeState;
    /**
     * - Whether to disable the state file
     */
    noFSState: boolean;
    /**
     * - Whether to disable automatic cleanup of expired tokens and challenges
     */
    disableAutoCleanup?: boolean | undefined;
    /**
     * - Custom storage hooks for challenges and tokens
     */
    storage?: StorageHooks | undefined;
};
