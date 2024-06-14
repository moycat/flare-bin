const usageMessage = host => `
>>> Flare Bin Usage <<<

# Upload a file (<100MB)

curl -X POST -F 'a=@<filename>' -u ':<token>' 'https://${host}/'

Optional query parameters:
- id: Specify a file ID for the link. Random IDs by default.
- ttl: Expiration TTL in seconds; 0 means never expiring. 604800 (1 week) by default.
- token: Token required to download the file. None by default.
- filename: Filename shown when downloading. The raw filename by default.

# List files

curl -u ':<token>' 'https://${host}/list'

# Delete a file

curl -X DELETE ':<token>' 'https://${host}/<file_id>'
`.trim();

export const handleUsage = async ({ req }): Promise<Response> => {
	return new Response(usageMessage(req.headers.get('Host')));
};
