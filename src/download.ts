import { Handler } from './index';
import { clean } from './clean';

export const handleDownload: Handler = async ({ env, req }): Promise<Response> => {
	const fileID = req.params.fileID;
	console.log(`downloading file [${fileID}]`);
	const fileData = await env.KV_NAMESPACE.get<FileData>(fileID, { type: 'json' });
	const now = Math.floor(Date.now() / 1000);
	if (fileData && fileData.expireAt <= now) {
		await clean(env, fileID);
		return new Response('File does not exist or has expired.', {
			status: 404
		});
	}
	if (!fileData) {
		return new Response('File does not exist or has expired.', {
			status: 404
		});
	}
	// Check the token.
	if (fileData.token && req.query['token'] !== fileData.token)
		return new Response('File requires the correct token.', {
			status: 403
		});
	// Get the file.
	const file = await env.BUCKET.get(fileData.uuid, {
		range: req.headers,
		onlyIf: req.headers
	});
	if (!file) {
		return new Response('File does not exist in the bucket. Something went wrong.', {
			status: 500
		});
	}
	// Stream the file.
	const headers = new Headers();
	headers.set('Content-Type', fileData.contentType);
	headers.set('Content-Disposition', `filename="${fileData.filename.replaceAll('"', '\\"')}"`);
	headers.set('Etag', file.httpEtag);
	if (file.range) {
		headers.set('Content-Range', `bytes ${file.range.offset}-${file.range.end ?? file.size - 1}/${file.size}`);
	}
	const status = file.body ? (req.headers.get('Range') !== null ? 206 : 200) : 304;
	return new Response(file.body, {
		headers,
		status
	});
};
