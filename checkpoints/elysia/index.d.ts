import type { Elysia } from "elysia";
import Cap from "@cap.js/server";

export interface CapMiddlewareOptions {
  /**
   * Duration in hours for which the authentication token remains valid
   * @default 32
   */
  token_validity_hours?: number;

  /**
   * File path where authentication tokens are stored
   * @default ".data/middlewareTokens.json"
   */
  tokens_store_path?: string;

  /**
   * Size of the generated token in bytes
   * @default 16
   */
  token_size?: number;

  /**
   * Path to the HTML template used for verification
   * @default "./index.html" (relative to middleware file)
   */
  verification_template_path?: string;

  /**
   * Determines how the middleware is applied
   * @default "global"
   */
  scoping?: "global" | "scoped";
}

export interface TokenValidationResult {
  success: boolean;
}

export interface ChallengeRedeemBody {
  token: string;
  solutions: unknown[];
}

export interface ChallengeRedeemResponse {
  success: boolean;
  token?: string;
  expires?: number;
}

/**
 * Cap middleware for Elysia that provides challenge-based bot protection
 *
 * @param userOptions Configuration options for the middleware
 * @returns An Elysia plugin instance configured with Cap protection
 */
export declare function capMiddleware(
  userOptions?: CapMiddlewareOptions
): Elysia;
