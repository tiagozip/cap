const crypto = require("crypto");
const fs = require("fs/promises");
const { EventEmitter } = require("events");

const encodeBigInt = (num, base = 62) => {
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let res = "",
    n = BigInt(num);
  while (n > 0) {
    res = chars[Number(n % BigInt(base))] + res;
    n /= BigInt(base);
  }
  return res || "0";
};

(function (define) {
  define(function (require, exports, module) {
    class Cap extends EventEmitter {
      config;
      #cleanupPromise = null;

      constructor(configObj) {
        super();
        this.config = {
          tokens_store_path: ".data/tokensList.json",
          state: {
            challengesList: {},
            tokensList: {},
          },
          ...configObj,
        };

        this.#loadTokens().catch(() => {});

        process.on("beforeExit", () => this.cleanup());

        ["SIGINT", "SIGTERM", "SIGQUIT"].forEach((signal) => {
          process.once(signal, () => {
            this.cleanup()
              .then(() => process.exit(0))
              .catch(() => process.exit(1));
          });
        });
      }

      async #loadTokens() {
        try {
          const data = await fs.readFile(
            this.config.tokens_store_path,
            "utf-8"
          );
          this.config.state.tokensList = JSON.parse(data) || {};
          this.#cleanExpiredTokens();
        } catch (error) {
          this.config.state.tokensList = {};
        }
      }

      #cleanExpiredTokens() {
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

      async cleanup() {
        if (this.#cleanupPromise) return this.#cleanupPromise;

        this.#cleanupPromise = (async () => {
          const tokensChanged = this.#cleanExpiredTokens();

          if (tokensChanged) {
            await fs.writeFile(
              this.config.tokens_store_path,
              JSON.stringify(this.config.state.tokensList),
              "utf8"
            );
          }
        })();

        return this.#cleanupPromise;
      }

      createChallenge(conf) {
        this.#cleanExpiredTokens();

        const challenges = Array.from(
          { length: conf?.challengeCount || 18 },
          () => [
            crypto
              .randomBytes(Math.ceil((conf?.challengeSize || 32) / 2))
              .toString("hex")
              .slice(0, conf?.challengeSize || 32),
            crypto
              .randomBytes(Math.ceil((conf?.challengeDifficulty || 4) / 2))
              .toString("hex")
              .slice(0, conf?.challengeDifficulty || 4),
          ]
        );

        const token = crypto.randomBytes(25).toString("hex");
        const expires = Date.now() + (conf?.expiresMs || 600000);

        if (conf?.store === false) {
          return { challenge: challenges, expires };
        }

        this.config.state.challengesList[token] = {
          challenge: challenges,
          expires,
          token,
        };

        return { challenge: challenges, token, expires };
      }

      async redeemChallenge({ token, solutions }) {
        this.#cleanExpiredTokens();

        const challengeData = this.config.state.challengesList[token];
        if (!challengeData || challengeData.expires < Date.now()) {
          delete this.config.state.challengesList[token];
          return { success: false };
        }

        delete this.config.state.challengesList[token];

        const isValid = challengeData.challenge.every(([salt, target]) => {
          const solution = solutions.find(
            ([s, t]) => s === salt && t === target
          );
          return (
            solution &&
            crypto
              .createHash("sha256")
              .update(salt + solution[2])
              .digest("hex")
              .startsWith(target)
          );
        });

        if (!isValid) return { success: false };

        const vertoken = crypto.randomBytes(15).toString("hex");
        const expires = Date.now() + 20 * 60 * 1000;
        const hash = encodeBigInt(Bun.hash(vertoken));
        const id = crypto.randomBytes(8).toString("hex");

        this.config.state.tokensList[`${id}:${hash}`] = expires;

        await fs.writeFile(
          this.config.tokens_store_path,
          JSON.stringify(this.config.state.tokensList),
          "utf8"
        );

        return { success: true, token: `${id}:${vertoken}`, expires };
      }

      async validateToken(token, conf) {
        this.#cleanExpiredTokens();

        const [id, vertoken] = token.split(":");
        const hash = encodeBigInt(Bun.hash(vertoken));
        const key = `${id}:${hash}`;

        if (this.config.state.tokensList[key]) {
          if (conf?.keepToken) {
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
    }

    return Cap;
  });
})(
  typeof module === "object" && module.exports && typeof define !== "function"
    ? function (factory) {
        module.exports = factory(require, exports, module);
      }
    : define
);