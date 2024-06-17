import { Handler } from './index';

export async function clean(id: string, kvNamespace: KVNamespace, bucket: R2Bucket) {
	console.log(`deleting file [${id}]`);
	const fileData = await kvNamespace.get<FileData>(id, { type: 'json' });
	if (!fileData) {
		throw new Error('file id not found');
	}

	// Delete the file first.
	const uuid = fileData['uuid'];
	try {
		await bucket.delete(uuid);
	} catch (e) {
		console.log('failed to delete object in bucket:', e);
	}

	// Then delete the metadata.
	return kvNamespace.delete(id);
}

export const cronCleanExpiredFiles = async (env: Env) => {
	console.log('Cleaning expired files...');
	const now = (new Date()).getTime() / 1000;
	let cursor = '';
	while (true) {
		const keyList = await env.KV_NAMESPACE.list({
			cursor: cursor
		});
		// Check every key if it's expired.
		for (const key of keyList.keys) {
			if (key.metadata.expireAt > 0 && now > key.metadata.expireAt) {
				console.log(`[${key.name}] has expired at [${key.metadata.expireAt}]`);
				try {
					await clean(key.name, env.KV_NAMESPACE, env.BUCKET);
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
};

export const handleClean: Handler = async ({ env }): Promise<Response> => {
	return cronCleanExpiredFiles(env);
};

export const handleDelete: Handler = async ({ env, req }): Promise<Response> => {
	const fileID = req.params.fileID;
	const fileData = await env.KV_NAMESPACE.get<FileData>(fileID, { type: 'json' });
	if (!fileData) {
		return new Response('File does not exist or has expired.', {
			status: 404
		});
	}
	try {
		await clean(fileID, env.KV_NAMESPACE, env.BUCKET);
	} catch (e) {
		console.log(`failed to delete file [${fileID}]:`, e);
		return new Response(`Failed to delete file [${fileID}]: ${e.toString()}`, {
			status: 500
		});
	}
	return new Response(`File [${fileID}] deleted.`);
};
