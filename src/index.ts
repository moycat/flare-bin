import { Router, RouterHandler } from '@tsndr/cloudflare-worker-router';
import { handleDownload } from './download';
import {
	handleCompleteMultipartUpload, handleContinueMultipartUpload, handleStartMultipartUpload,
	handlePostUpload, handlePutUpload
} from './upload';
import { checkFileValidity, normalizeFileID, requirePassword } from './middleware';
import { cronCleanExpiredFiles, handleClean, handleDelete } from './clean';
import { handleList } from './list';
import { handleSh, handleUsage } from './usage';

export type Handler = RouterHandler<Env>
const router = new Router<Env>();

router.post('/clean', requirePassword, handleClean);
router.get('/list', requirePassword, handleList);

router.get('/', handleUsage);
router.get('/sh', requirePassword, handleSh);

router.post('/', requirePassword, handlePostUpload);
router.put('/:filename', requirePassword, handlePutUpload);
router.post('/multipart/start', requirePassword, handleStartMultipartUpload);
router.post('/multipart', requirePassword, handleContinueMultipartUpload);
router.post('/multipart/complete', requirePassword, handleCompleteMultipartUpload);

router.get('/:fileID', normalizeFileID, checkFileValidity, handleDownload);
router.delete('/:fileID', requirePassword, normalizeFileID, checkFileValidity, handleDelete);

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return router.handle(request, env, ctx);
	},

	async scheduled(event: Event, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(cronCleanExpiredFiles(env));
	}
};
