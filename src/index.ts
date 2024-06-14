import { Router, RouterHandler } from '@tsndr/cloudflare-worker-router';
import { handleDownload } from './download';
import { handleUpload } from './upload';
import { checkFileValidity, normalizeFileID, requirePassword } from './middleware';
import { cronCleanExpiredFiles, handleClean, handleDelete } from './clean';
import { handleList } from './list';
import { handleUsage } from './usage';

export type Handler = RouterHandler<Env>
const router = new Router<Env>();

router.post('/clean', requirePassword, handleClean);
router.get('/list', requirePassword, handleList);

router.get('/', handleUsage);
router.post('/', requirePassword, handleUpload);
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
