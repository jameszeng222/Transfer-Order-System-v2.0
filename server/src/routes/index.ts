import { Hono } from 'hono';
import health from './health.js';
import auth from './auth.js';
import warehouses from './warehouses.js';
import carriers from './carriers.js';
import teams from './teams.js';
import users from './users.js';
import { authMiddleware } from '../middleware/auth.js';

const routes = new Hono();

routes.route('/health', health);
routes.route('/auth', auth);

routes.use('/warehouses/*', authMiddleware);
routes.use('/carriers/*', authMiddleware);
routes.use('/teams/*', authMiddleware);
routes.use('/users/*', authMiddleware);

routes.route('/warehouses', warehouses);
routes.route('/carriers', carriers);
routes.route('/teams', teams);
routes.route('/users', users);

export default routes;
