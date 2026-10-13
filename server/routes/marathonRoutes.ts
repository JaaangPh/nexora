import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  cancelInvitation,
  cancelLobby,
  createTeam,
  getDashboard,
  inviteUser,
  leaveTeam,
  removeMember,
  respondInvitation,
  searchUser,
  startTeam,
  updateTeam,
} from '../controllers/marathonController.js';

const router = Router();

router.use(authMiddleware);
router.get('/', getDashboard);
router.post('/teams', createTeam);
router.get('/teams/:teamId/search', searchUser);
router.post('/teams/:teamId/invitations', inviteUser);
router.delete('/teams/:teamId/invitations/:invitationId', cancelInvitation);
router.post('/invitations/:invitationId/respond', respondInvitation);
router.patch('/teams/:teamId', updateTeam);
router.post('/teams/:teamId/start', startTeam);
router.delete('/teams/:teamId/members/:memberId', removeMember);
router.post('/teams/:teamId/leave', leaveTeam);
router.post('/teams/:teamId/cancel', cancelLobby);

export default router;
