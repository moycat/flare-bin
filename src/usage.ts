import uploadSh from './upload.txt';

const usageMessage = host => `
>>> Flare Bin Usage <<<

# Upload a file (<100MB)

curl -T <filename> -u ':<password>' 'https://${host}/'
curl -X POST -F 'a=@<filename>' -u ':<password>' 'https://${host}/'

Optional parameters:
- id (query) / X-ID (header): Specify a file ID for the link. Random IDs by default.
- ttl (query) / X-TTL (header): Expiration TTL in seconds; 0 means never expiring. 604800 (1 week) by default.
- token (query) / X-Token (header): Token required to download the file. None by default.
- filename (query) / X-Filename (header): Filename shown when downloading. The raw filename by default.

# Upload a file (>100MB)

curl -u ':<password>' -s 'https://${host}/sh' | sh -s - <filename> [options]

# List files

curl -u ':<password>' 'https://${host}/list'

Optional parameters:
-h: Show help message.
-i: Specify a file ID for the link. Random IDs by default.
-f: Filename shown when downloading. The raw filename by default.
-t: Expiration TTL in seconds; 0 means never expiring. 604800 (1 week) by default.
-T: Token required to download the file. None by default.

# Delete a file

curl -X DELETE ':<password>' 'https://${host}/<file_id>'
`.trim();

export const handleUsage = async ({ req }): Promise<Response> => {
	return new Response(usageMessage(req.headers.get('Host')));
};

export const handleSh = async ({ env, req }): Promise<Response> => {
	const host = req.headers.get('Host');
	const sh = uploadSh.replace("###HOST_PLACEHOLDER###", host).replace("###PASSWORD_PLACEHOLDER###", env.PASSWORD);
	return new Response(sh);
}
