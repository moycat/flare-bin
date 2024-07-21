# Flare Bin

Share files in CLI with Cloudflare Workers and R2.

- ✅ Linux & macOS
- ✅ Files > 100 MB
- ✅ Password protection
- ✅ Pure CLI operations with minimal dependencies

```shell
$ curl -T my.file -u :password https://bin.your.site

Upload successful!

[URL] https://bin.your.site/iPf7AS
[Filename] my.file
[Size] 1234
[Expires at] 20XX-XX-XX 00:00:00 (UTC)

$ curl -u :password -s https://bin.your.site/sh | sh -s large.file

uploading [large.file] to [bin.your.site] in 6 part(s)...
upload created
uploaded part 1
uploaded part 2
uploaded part 3
uploaded part 4
uploaded part 5
uploaded part 6

Upload successful!

[URL] https://bin.your.site/h6Q6Nv
[Filename] large.file
[Size] 123456789
[Expires at] 20XX-XX-XX 00:00:00 (UTC)
```

## Installation

1. Install [wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) and link your Cloudflare account.
2. Create a KV namespace and an R2 bucket on Cloudflare.
3. Copy `wrangler.template.toml` to `wrangler.toml` and modify it accordingly.
4. Run `wrangler deploy`.
5. Set the password for your bin with `wrangler secret put PASSWORD`.

## Usage

> You can always access the domain to get the usage!

### Direct Upload

You can use `curl` to directly upload a file smaller than 100 MB (due to the [body size limit](https://developers.cloudflare.com/workers/platform/limits/#request-limits) of free accounts).

Command:
```bash
curl -T <filename> -u ':<password>' 'https://bin.your.site/'
curl -X POST -F 'a=@<filename>' -u ':<password>' 'https://bin.your.site/'
```

Optional parameters:

| Query | Header | |
| --- | --- | --- |
| `id` | `X-ID` | Specify a file ID for the link.<br>Random IDs by default. |
| `ttl` | `X-TTL` | Expiration TTL in seconds; 0 means never expiring.<br>604800 (1 week) by default. |
| `token` | `X-Token` | Token required to download the file.<br>None by default. |
| `filename` | `X-Filename` | Filename shown when downloading.<br>The raw filename by default. |

### Script Upload

You download an upload script and upload large files with automatic splitting.

Command:
```bash
curl -s -u ':<password>' 'https://bin.your.site/' | sh -s - <filename> [options]
```

| Option | |
| --- | --- |
| `-h` | Show help message. |
| `-i` | Specify a file ID for the link.<br>Random IDs by default. |
| `-f` | Filename shown when downloading.<br>The raw filename by default. |
| `-t` | Expiration TTL in seconds; 0 means never expiring.<br>604800 (1 week) by default. |
| `-T` | Token required to download the file.<br>None by default. |

## List Files

You can list all stored files.

Command:
```bash
curl -u ':<password>' 'https://bin.your.site/list'
```

## Delete a File

You can delete a file by its ID.

Command:
```bash
curl -X DELETE -u ':<password>' 'https://bin.your.site/<file_id>'
```
