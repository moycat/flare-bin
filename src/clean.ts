import { Handler } from './index';

export async function clean(env: Env, id: string) {
	console.log(`deleting file [${id}]`);
	const data = await env.KV_NAMESPACE.get(id);
	if (!data) {
		throw new Error('file id not found');
	}
	const fileData = JSON.parse(data);
	const uuid = fileData['uuid'];
	try {
		await env.BUCKET.delete(uuid);
	} catch (e) {
		console.log('failed to delete object in bucket:', e);
	}
	return env.KV_NAMESPACE.delete(id);
}

export async function cleanExpiredFiles(env: Env) {
	console.log('Cleaning expired files...');
	const now = (new Date()).getTime() / 1000;
	let cursor = '';
	while (true) {
		const keyList = await env.KV_NAMESPACE.list({
			cursor: cursor
		});
		for (const key of keyList.keys) {
			if (now > key.metadata.expireAt) {
				console.log(`[${key.name}] has expired at [${key.metadata.expireAt}]`);
				await clean(env, key.name);
			}
		}
		if (keyList.list_complete) {
			break;
		}
	}
	return new Response('OK');
}

export const handleClean: Handler = async ({ env }): Promise<Response> => {
	return cleanExpiredFiles(env);
};
