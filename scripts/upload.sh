#!/bin/sh -e

HOST=${FLARE_HOST:-"###HOST_PLACEHOLDER###"}
PASSWORD=${FLARE_PASSWORD:-"###PASSWORD_PLACEHOLDER###"}
BLOCK_SIZE=${FLARE_BLOCK_SIZE:-"20"} # in MiB

PROGRAM="$0"
ID=
FILENAME=
TTL=
TOKEN=

command_exists() {
	command -v "$1" 1>/dev/null 2>&1
}

# check necessary commands
for cmd in curl dd basename wc; do
	if ! command_exists "${cmd}"; then
		echo "fatal: ${cmd} not found"
		exit 1
	fi
done

print_help() {
	echo "usage: $PROGRAM [-h] [-i FILE_ID] [-f FILENAME] [-t TTL] [-T TOKEN] <file>"
	exit 0
}

# parse args
# from https://stackoverflow.com/a/29754866
while [ $# -gt 0 ]; do
  key="$1"
  case "${key}" in
  -h | --help)
    print_help
    exit 0
    ;;
  -i | --id)
    ID="$2"
    shift # past argument
    shift # past value
    ;;
  -f | --filename)
    FILENAME="$2"
    shift # past argument
    shift # past value
    ;;
  -t | --ttl)
    TTL="$2"
    shift # past argument
    shift # past value
    ;;
  -T | --token)
    TOKEN="$2"
    shift # past argument
    shift # past value
    ;;
  *) # unknown option
    FILE="$1" # assume it's the file
    shift     # past argument
    ;;
  esac
done

# check args
if test -z "${FILE}"; then
	echo "fatal: file not specified"
	print_help
	exit 1
fi
if ! test -e "${FILE}"; then
	echo "fatal: ${FILE} does not exist"
	exit 1
fi
if ! test -f "${FILE}"; then
	echo "fatal: ${FILE} is not a regular file"
	exit 1
fi

# prepare file info
read -r SIZE _ << EOF
$(wc -c "${FILE}")
EOF
if command_exists file; then
	CONTENT_TYPE=$(file -b --mime-type "${FILE}")
else
	echo "warning: file command not found, using application/octet-stream as content type"
fi
test -z "$CONTENT_TYPE" && CONTENT_TYPE="application/octet-stream"
if test -z "${FILENAME}"; then
	FILENAME=$(basename "${FILE}")
fi
PART_NUM=$((SIZE / (BLOCK_SIZE * 1048576)))
[ $((SIZE % (BLOCK_SIZE * 1048576))) -gt 0 ] && PART_NUM=$((PART_NUM+1))

echo "uploading [${FILE}] to [${HOST}] in ${PART_NUM} part(s)..."

# start multipart uploading
UPLOAD_QUERY=$(curl -s -X POST -u ":${PASSWORD}" \
	${ID:+-H "X-ID: ${ID}"} \
	"https://${HOST}/multipart/start")
case "${UPLOAD_QUERY}" in
	"key="*) 	echo "upload created" ;;
	*)				echo "failed to upload: ${UPLOAD_QUERY}"; exit 1 ;;
esac

PART=1
ETAG_LIST=""
exec 3<"${FILE}" # open the file as fd 3
while [ $PART -le $PART_NUM ]
do
  ETAG=$(dd bs=1048576 "count=${BLOCK_SIZE}" 2>/dev/null <&3 | curl -s -X POST -u ":${PASSWORD}" -T - \
   	"https://${HOST}/multipart?${UPLOAD_QUERY}&partNum=${PART}")
  case "${ETAG}" in
  	"="*) echo "uploaded part ${PART}" ;;
  	*)		echo "failed to upload part ${PART}: ${ETAG}"; exit 1 ;;
  esac
	ETAG_LIST="${ETAG_LIST}tag${PART}${ETAG}&"
	PART=$((PART+1))
done

# complete the upload
echo "${ETAG_LIST}" | curl -s -X POST -u ":${PASSWORD}" --data @- \
	${ID:+-H "X-ID: ${ID}"} \
	${TTL:+-H "X-TTL: ${TTL}"} \
	${TOKEN:+-H "X-Token: ${TOKEN}"} \
	${FILENAME:+-H "X-Filename: ${FILENAME}"} \
	-H "X-Content-Type: ${CONTENT_TYPE}" \
	"https://${HOST}/multipart/complete?${UPLOAD_QUERY}"
