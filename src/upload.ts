import shortUUID from 'short-uuid';
import { Handler } from './index';
import { currentTimestamp, formatDate } from './utils';
import { clean } from './clean';
import { RouterRequest } from '@tsndr/cloudflare-worker-router';

const DEFAULT_TTL = 3600 * 24 * 7; // One week.

const uuidGenerator = shortUUID(shortUUID.constants.flickrBase58, {
	consistentLength: true
});

async function ensureIDUsable(id: string, kvNamespace: KVNamespace, bucket: R2Bucket): Promise<boolean> {
	if (id == 'files' || id === 'clean' || id === 'list' || id === 'multipart') {
		// Reserved IDs.
		return false;
	}

	const fileData = await kvNamespace.get<FileData>(id, { type: 'json' });
	if (!fileData)
		return true;

	// Check if expired.
	const now = currentTimestamp();
	if (fileData.expireAt <= now) {
		await clean(id, kvNamespace, bucket);
		return true;
	}

	return false;
}

async function getParameters(req: RouterRequest<{}>, uuid: string): Promise<FileParameter> {
	const query = req.query;
	const id = query['id'] || req.headers.get('X-ID') || uuidGenerator.fromUUID(uuid).slice(0, 6);
	const ttl = +query['ttl'] >= 0 ? +query['ttl'] : (+req.headers.has('X-TTL') && +req.headers.get('X-TTL') >= 0 ? +req.headers.get('X-TTL') : DEFAULT_TTL);
	const token = query['token'] || req.headers.get('X-Token') || '';
	const filename = query['filename'] || req.headers.get('X-Filename') || null;
	return {
		id: id,
		expireAt: ttl > 0 ? currentTimestamp() + ttl : 0,
		token: token,
		filename: filename
	};
}

async function generateMessage(host: string, id: string, fileData: FileData, size: number): Promise<string> {
	let msg = 'Upload successful!\n\n';
	msg += `[URL] https://${host}/${encodeURIComponent(id)}`;
	if (fileData.token)
		msg += '?token=' + encodeURIComponent(fileData.token);
	msg += '\n';
	msg += `[Filename] ${fileData.filename}\n`;
	msg += `[Size] ${size}\n`;
	if (fileData.expireAt == 0)
		msg += `[Expires at] never\n`;
	else {
		const date = new Date(fileData.expireAt * 1000);
		msg += `[Expires at] ${formatDate(date)} (UTC)\n`;
	}
	return msg;
}

async function doFullUpload(id: string, fileData: FileData, file: Blob, env: Env, host: string): Promise<Response> {
	// Check if the ID is usable (not reserved or duplicated).
	if (!await ensureIDUsable(id, env.KV_NAMESPACE, env.BUCKET))
		return new Response(`File ID [${id}] is not available.`, {
			status: 400
		});

	// Do upload.
	await env.KV_NAMESPACE.put(id, JSON.stringify(fileData), {
		metadata: {
			expireAt: fileData.expireAt,
			token: fileData.token,
			size: file.size,
			filename: fileData.filename
		}
	});
	await env.BUCKET.put(fileData.uuid, file);

	// Generate the message.
	const msg = await generateMessage(host, id, fileData, file.size)
	console.log(`File [${id}] stored as [${fileData.uuid}]`);
	return new Response(msg);
}

export const handlePutUpload: Handler = async ({ env, req }): Promise<Response> => {
	const uuid = uuidGenerator.uuid();
	const params = await getParameters(req, uuid);
	const filename = decodeURIComponent(req.params.filename);
	const contentType = 'application/octet-stream'; // Hard-coded unknown file type.
	const fileData: FileData = {
		uuid: uuid,
		expireAt: params.expireAt,
		token: params.token,
		filename: params.filename || filename,
		contentType: contentType
	};

	return doFullUpload(params.id, fileData, await req.blob(), env, req.headers.get('Host'));
};

export const handlePostUpload: Handler = async ({ env, req }): Promise<Response> => {
	if (!req.headers.get('Content-Type')?.startsWith('multipart/form-data; '))
		return new Response('Unsupported upload method. Please use multipart/form-data with any field name.', {
			status: 400
		});

	// Find the file in the form.
	let file;
	for (const field of (await req.formData()).values())
		if (field instanceof Blob) {
			file = field;
			break;
		}
	if (!file)
		return new Response('No file is uploaded. Please use multipart/form-data with any field name.', {
			status: 400
		});

	// Generate the file data.
	const uuid = uuidGenerator.uuid();
	const params = await getParameters(req, uuid);
	const contentType = file.type;
	const fileData: FileData = {
		uuid: uuid,
		expireAt: params.expireAt,
		token: params.token,
		filename: params.filename || file.name,
		contentType: contentType
	};

	return doFullUpload(params.id, fileData, file, env, req.headers.get('Host'));
};

export const handleStartMultipartUpload = async ({ env, req }): Promise<Response> => {
	const uuid = uuidGenerator.uuid();
	const id = req.headers.get('X-ID') || uuidGenerator.fromUUID(uuid).slice(0, 6);

	// Early check for the ID.
	if (!await ensureIDUsable(id, env.KV_NAMESPACE, env.BUCKET))
		return new Response(`File ID [${id}] is not available.`, {
			status: 400
		});

	// Create a multipart upload.
	const multipartUpload = await env.BUCKET.createMultipartUpload(uuid);
	const query = new URLSearchParams();
	query.set('key', multipartUpload.key);
	query.set('uploadID', multipartUpload.uploadId);
	return new Response(query.toString());
};

export const handleContinueMultipartUpload = async ({ env, req }): Promise<Response> => {
	const query = req.query;
	const key = query['key'];
	const uploadID = query['uploadID'];
	const partNum = query['partNum'];
	const multipartUpload = env.BUCKET.resumeMultipartUpload(key, uploadID);
	try {
		const uploadedPart: R2UploadedPart = await multipartUpload.uploadPart(partNum, await req.blob());
		return new Response('=' + uploadedPart.etag);
	} catch (e) {
		return new Response(`Failed to upload part: ${e.message}`, { status: 400 });
	}
};

export const handleCompleteMultipartUpload = async ({ env, req }): Promise<Response> => {
	const query = req.query;
	const key = query['key'];
	const uploadID = query['uploadID'];
	const multipartUpload = env.BUCKET.resumeMultipartUpload(key, uploadID);

	const form = await req.formData();
	let parts = [];
	// Worker doesn't support multiple queries with the same name. Extract them manually.
	for (let i = 1; form.get(`tag${i}`); i++) {
		parts.push({
			'partNumber': i,
			'etag': form.get(`tag${i}`)
		});
	}
	const object = await multipartUpload.complete(parts);

	const uuid = object.key;
	const id = req.headers.get('X-ID') || uuidGenerator.fromUUID(uuid).slice(0, 6);
	const ttl = req.headers.get('X-TTL') || DEFAULT_TTL;
	const fileData = {
		uuid: uuid,
		expireAt: ttl > 0 ? currentTimestamp() + ttl : 0,
		token: req.headers.get('X-Token') || '',
		filename: req.headers.get('X-Filename') || 'file',
		contentType: req.headers.get('X-Content-Type') || 'application/octet-stream'
	}
	await env.KV_NAMESPACE.put(id, JSON.stringify(fileData), {
		metadata: {
			expireAt: fileData.expireAt,
			token: fileData.token,
			size: object.size,
			filename: fileData.filename
		}
	});

	// Generate the message.
	const msg = await generateMessage(req.headers.get("Host"), id, fileData, object.size)
	return new Response(msg);
};
