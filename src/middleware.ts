import { Buffer } from 'node:buffer';
import { Handler } from './index';
import { timingSafeEqual } from './utils';


export const requirePassword: Handler = ({ env, req }) => {
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
