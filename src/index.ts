import { Router, RouterHandler } from '@tsndr/cloudflare-worker-router';
import { handleDownload } from './download';
import { handleUpload } from './upload';
import { requirePassword } from './middleware';
import { cleanExpiredFiles, handleClean, handleDelete } from './clean';

export type Handler = RouterHandler<Env>
const router = new Router<Env>();

router.post('/', requirePassword, handleUpload);
router.get('/:fileID', handleDownload);
router.delete('/:fileID', requirePassword, handleDelete);
router.post('/clean', requirePassword, handleClean);

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return router.handle(request, env, ctx);
	},

	async scheduled(event: Event, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(cleanExpiredFiles(env));
	}
};
