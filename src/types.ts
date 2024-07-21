interface FileData {
	uuid: string;
	expireAt: number;
	token: string;
	filename: string;
	contentType: string;
}

interface FileParameter {
	id: string;
	expireAt: number;
	token: string;
	filename: string | null;
}
