export const ratelimitGenerator = (req, server) => {
	if (process.env.RATELIMIT_IP_HEADER) {
		const header = process.env.RATELIMIT_IP_HEADER;
		const ip = req.headers.get(header) || req.headers.get(header.toLowerCase());

		if (ip) {
			return ip.split(",")[0].trim();
		}

		console.error(
			`⚠️  [ratelimit] Unable to find the IP in the header "${header}". Make sure to set the RATELIMIT_IP_HEADER env variable \n   to a header which returns the user's IP.`,
		);
		return "";
	}

	const ip = server?.requestIP(req)?.address;

	if (!server || !req || !ip) {
		if (process.env.HIDE_RATELIMIT_IP_WARNING !== "true") {
			console.warn(
				`⚠️  [ratelimit] Unable to determine client IP, rate limiting disabled. If you're running locally, it should be safe \n   to ignore this warning. Otherwise, make sure to set the RATELIMIT_IP_HEADER env variable to a header \n   which returns the user's IP. Hide this warning with env.HIDE_RATELIMIT_IP_WARNING=true`,
			);
		}

		return "";
	}

	return ip ?? "";
};
