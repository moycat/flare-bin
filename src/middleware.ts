import { Buffer } from 'node:buffer';
import { Handler } from './index';
import { currentTimestamp, timingSafeEqual } from './utils';
import { clean } from './clean';

export const requirePassword: Handler = async ({ env, req }) => {
	if (!env.PASSWORD)
		return;
	const authorization = req.headers.get('Authorization');
	if (authorization) {
		const [scheme, encoded] = authorization.split(' ');
		if (scheme === 'Basic' && encoded) {
			const credentials = Buffer.from(encoded, 'base64').toString();
			const index = credentials.indexOf(':');
			const user = credentials.substring(0, index);
			const pass = credentials.substring(index + 1);
			if (timingSafeEqual(env.PASSWORD, user) || timingSafeEqual(env.PASSWORD, pass)) {
				// Either username or password should match it.
				return;
			}
		}
	}
	return new Response('Unauthorized access.', {
		status: 401,
		headers: {
			'WWW-Authenticate': 'Basic realm="Flare Bin", charset="UTF-8"'
		}
	});
};

export const checkFileValidity: Handler = async ({ env, req }) => {
	const now = currentTimestamp();
	const fileID = req.params.fileID;
	const fileData = await env.KV_NAMESPACE.get<FileData>(fileID, { type: 'json' });
	if (fileData && fileData.expireAt <= now) {
		await clean(fileID, env.KV_NAMESPACE, env.BUCKET);
		return new Response('File does not exist or has expired.', {
			status: 404
		});
	}
	return;
};
