import shortUUID from 'short-uuid';
import { Handler } from './index';
import { currentTimestamp, formatDate } from './utils';
import { clean } from './clean';

const DEFAULT_TTL = 3600 * 24 * 7; // One week.

const uuidGenerator = shortUUID(shortUUID.constants.flickrBase58, {
	consistentLength: true
});

async function ensureIDUsable(id: string, kvNamespace: KVNamespace, bucket: R2Bucket): Promise<boolean> {
	if (id == 'files' || id === 'clean' || id === 'list') {
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

export const handleUpload: Handler = async ({ env, req }): Promise<Response> => {
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
	const query = req.query;
	const uuid = uuidGenerator.uuid();
	const id: string = query['id'] ? query['id'] : uuidGenerator.fromUUID(uuid).slice(0, 6);
	const ttl: number = +query['ttl'] >= 0 ? +query['ttl'] : DEFAULT_TTL;
	const expireAt: number = currentTimestamp() + ttl;
	const token: string = query['token'] ?? '';
	const filename = query['filename'] ? query['filename'] : file.name;
	const contentType = file.type;
	const fileData: FileData = {
		uuid: uuid,
		expireAt: expireAt,
		token: token,
		filename: filename,
		contentType: contentType
	};

	// Check if the ID is usable (not reserved or duplicated).
	if (!await ensureIDUsable(id, env.KV_NAMESPACE, env.BUCKET))
		return new Response(`File ID [${id}] is not available.`, {
			status: 400
		});

	// Do upload.
	await env.KV_NAMESPACE.put(id, JSON.stringify(fileData), {
		metadata: {
			expireAt: expireAt,
			token: token,
			size: file.size,
			filename: filename
		}
	});
	await env.BUCKET.put(uuid, file);
	// Generate the message.
	let msg = 'Upload successful!\n\n';
	msg += `[URL] https://${req.headers.get('Host')}/${encodeURIComponent(id)}`;
	if (token)
		msg += '?token=' + encodeURIComponent(token);
	msg += '\n';
	msg += `[Filename] ${filename}\n`;
	msg += `[Size] ${file.size}\n`;
	if (ttl == 0)
		msg += `[Expires at] never\n`;
	else {
		const date = new Date(expireAt * 1000);
		msg += `[Expires at] ${formatDate(date)} (UTC)\n`;
	}
	console.log(`File [${id}] stored as [${uuid}]`);
	return new Response(msg);
};
