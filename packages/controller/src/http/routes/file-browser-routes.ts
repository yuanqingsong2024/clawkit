import type { FastifyInstance } from 'fastify';
import { FileBrowserService } from '../services/file-browser.service.js';

export function buildFileBrowserRoutes(): (app: FastifyInstance) => Promise<void> {
  return async (app: FastifyInstance) => {
    const service = new FileBrowserService();

    app.get('/browse-files', async (request, reply) => {
      const { path } = request.query as { path?: string };

      try {
        const result = service.browse(path);
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({
          error: error instanceof Error ? error.message : '浏览文件失败',
        });
      }
    });
  };
}
