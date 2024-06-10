const encoder = new TextEncoder();

/**
 * Protect against timing attacks by safely comparing values using `timingSafeEqual`.
 * Source: https://developers.cloudflare.com/workers/examples/basic-auth/
 */
export function timingSafeEqual(a: string, b: string): boolean {
	const aBytes = encoder.encode(a);
	const bBytes = encoder.encode(b);
	if (aBytes.byteLength !== bBytes.byteLength) {
		// Strings must be the same length in order to compare
		// with crypto.subtle.timingSafeEqual
		return false;
	}
	return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

export async function isIDUsable(id: string, kv_namespace: KVNamespace): Promise<boolean> {
	if (id == 'files' || id === 'clean') {
		// Reserved IDs.
		return false;
	}
	const existing = await kv_namespace.get(id);
	// TODO: delete if expired.
	return !existing;
}

export const formatDigit = (x, digit: number = 2) => x.toLocaleString('en-US', {
	minimumIntegerDigits: digit,
	useGrouping: false
});

export const formatDate = date => `${date.getUTCFullYear()}-${formatDigit(date.getUTCMonth() + 1)}-${formatDigit(date.getUTCDate())}` +
	` ${formatDigit(date.getUTCHours())}:${formatDigit(date.getUTCMinutes())}:${formatDigit(date.getUTCSeconds())}`;
