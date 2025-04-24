export = Cap;
/**
 * Main Cap class
 * @extends EventEmitter
 */
declare class Cap extends EventEmitter<[never]> {
    /**
     * Creates a new Cap instance
     * @param {Partial<CapConfig>} [configObj] - Configuration object
     */
    constructor(configObj?: Partial<CapConfig>);
    /** @type {Promise<void>|null} */
    _cleanupPromise: Promise<void> | null;
    /** @type {Required<CapConfig>} */
    config: Required<CapConfig>;
    /**
     * Generates a new challenge
     * @param {ChallengeConfig} [conf] - Challenge configuration
     * @returns {{ challenge: Array<ChallengeTuple>, token?: string, expires: number }} Challenge data
     */
    createChallenge(conf?: ChallengeConfig): {
        challenge: Array<ChallengeTuple>;
        token?: string;
        expires: number;
    };
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
     * Removes expired tokens and challenges from memory
     * @private
     * @returns {boolean} - True if any tokens were changed/removed
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
    export { Crypto, FsPromises, PathLike, ChallengeTuple, ChallengeData, ChallengeState, ChallengeConfig, TokenConfig, Solution, CapConfig };
}
import { EventEmitter } from "events";
type Crypto = typeof import("node:crypto");
type FsPromises = typeof import("node:fs/promises");
type PathLike = import("fs").PathLike;
type ChallengeTuple = [string, string];
type ChallengeData = {
    /**
     * - Array of [salt, target] tuples
     */
    challenge: Array<ChallengeTuple>;
    /**
     * - Expiration timestamp
     */
    expires: number;
    /**
     * - Challenge token
     */
    token: string;
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
     * - The challenge token
     */
    token: string;
    /**
     * - Array of [salt, target, solution] tuples
     */
    solutions: Array<[string, string, string]>;
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
};
