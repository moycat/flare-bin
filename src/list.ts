import Table from 'cli-tableau';
import { Handler } from './index';
import { formatDate } from './utils';

export const handleList: Handler = async ({ env, req }): Promise<Response> => {
	let table = new Table({
		head: ['FILE ID', 'FILENAME', 'SIZE', 'EXPIRE AT (UTC)', 'URL'],
		chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
	});

	const now = (new Date()).getTime() / 1000;
	let cursor = '';
	while (true) {
		const keyList = await env.KV_NAMESPACE.list({
			cursor: cursor
		});
		for (const key of keyList.keys) {
			if (key.metadata.expireAt > 0 && now > key.metadata.expireAt) {
				// Expired; ignore it.
				continue;
			}
			let expireAt;
			if (key.metadata.expireAt > 0) {
				const expireDate = new Date(key.metadata.expireAt * 1000);
				expireAt = formatDate(expireDate);
			} else
				expireAt = 'Never';
			let url = `https://${req.headers.get('Host')}/${encodeURIComponent(key.name)}`;
			if (key.metadata.token)
				url += '?token=' + encodeURIComponent(key.metadata.token);
			table.push([key.name, key.metadata.filename, key.metadata.size, expireAt, url]);
		}
		if (keyList.list_complete) {
			break;
		}
		cursor = keyList.cursor;
	}
	return new Response(table.toString());
};
