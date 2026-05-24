import { Hono } from 'hono';
import health from './health.js';
import auth from './auth.js';
import warehouses from './warehouses.js';
import carriers from './carriers.js';
import teams from './teams.js';
import users from './users.js';
import imports from './imports.js';
import orders from './orders.js';
import tracking from './tracking.js';
import { authMiddleware } from '../middleware/auth.js';

const routes = new Hono();

routes.route('/health', health);
routes.route('/auth', auth);

routes.use('/warehouses/*', authMiddleware);
routes.use('/carriers/*', authMiddleware);
routes.use('/teams/*', authMiddleware);
routes.use('/users/*', authMiddleware);
routes.use('/imports/*', authMiddleware);
routes.use('/orders/*', authMiddleware);
routes.use('/tracking/*', authMiddleware);

routes.route('/warehouses', warehouses);
routes.route('/carriers', carriers);
routes.route('/teams', teams);
routes.route('/users', users);
routes.route('/imports', imports);
routes.route('/orders', orders);
routes.route('/tracking', tracking);

export default routes;
