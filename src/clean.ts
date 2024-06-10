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
				try {
					await clean(env, key.name);
				} catch (e) {
					console.log(`failed to delete file [${key.name}]:`, e);
				}
			}
		}
		if (keyList.list_complete) {
			break;
		}
		cursor = keyList.cursor;
	}
	return new Response('Expired files cleaned.');
}

export const handleClean: Handler = async ({ env }): Promise<Response> => {
	return cleanExpiredFiles(env);
};

export const handleDelete: Handler = async ({ env, req }): Promise<Response> => {
	const fileID = req.params.fileID;
	const data = await env.KV_NAMESPACE.get(fileID);
	if (!data) {
		return new Response('File does not exist or has expired.', {
			status: 404
		});
	}
	try {
		await clean(env, fileID);
	} catch (e) {
		console.log(`failed to delete file [${fileID}]:`, e);
		return new Response(`Failed to delete file [${fileID}]: ${e.toString()}`, {
			status: 500
		});
	}
	return new Response(`File [${fileID}] deleted.`);
};
