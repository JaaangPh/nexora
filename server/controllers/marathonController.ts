import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import {
  cancelMarathonInvitation,
  cancelMarathonLobby,
  createMarathonTeam,
  inviteMarathonUser,
  leaveMarathonTeam,
  MarathonError,
  getMarathonDashboard,
  removeMarathonMember,
  respondToMarathonInvitation,
  searchMarathonUser,
  startMarathon,
  updateMarathonTeam,
} from '../services/marathonService.js';

function sendError(res: Response, error: unknown): void {
  if (error instanceof MarathonError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }
  console.error('[Marathon API Error]', error);
  res.status(500).json({ success: false, message: 'The Marathon request could not be completed.' });
}

export async function getDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await getMarathonDashboard(req.user?.id));
  } catch (error) {
    sendError(res, error);
  }
}

export async function createTeam(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await createMarathonTeam(req.user?.id, req.body?.name);
    res.status(201).json(result);
  } catch (error) {
    sendError(res, error);
  }
}

export async function searchUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await searchMarathonUser(req.user?.id, String(req.params.teamId), req.query.nexoraId as string);
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
}

export async function inviteUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const inviteeId = req.body?.inviteeId;
    if (typeof inviteeId !== 'string' || !inviteeId) {
      res.status(400).json({ success: false, message: 'Select a valid Nexora user.' });
      return;
    }
    res.status(201).json(await inviteMarathonUser(req.user?.id, String(req.params.teamId), inviteeId));
  } catch (error) {
    sendError(res, error);
  }
}

export async function respondInvitation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const action = req.body?.action;
    if (action !== 'accept' && action !== 'decline') {
      res.status(400).json({ success: false, message: 'Choose accept or decline.' });
      return;
    }
    res.json(await respondToMarathonInvitation(req.user?.id, String(req.params.invitationId), action));
  } catch (error) {
    sendError(res, error);
  }
}

export async function cancelInvitation(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await cancelMarathonInvitation(
      req.user?.id,
      String(req.params.teamId),
      String(req.params.invitationId),
    ));
  } catch (error) {
    sendError(res, error);
  }
}

export async function updateTeam(req: AuthRequest, res: Response): Promise<void> {
  try {
    const changes: { name?: string; packageId?: '250' | '500' } = {};
    if (req.body?.name !== undefined) {
      if (typeof req.body.name !== 'string') {
        res.status(400).json({ success: false, message: 'Team name must be text.' });
        return;
      }
      changes.name = req.body.name;
    }
    if (req.body?.packageId !== undefined) {
      if (req.body.packageId !== '250' && req.body.packageId !== '500') {
        res.status(400).json({ success: false, message: 'Choose a supported Marathon package.' });
        return;
      }
      changes.packageId = req.body.packageId;
    }
    res.json(await updateMarathonTeam(req.user?.id, String(req.params.teamId), changes));
  } catch (error) {
    sendError(res, error);
  }
}

export async function startTeam(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await startMarathon(req.user?.id, String(req.params.teamId)));
  } catch (error) {
    sendError(res, error);
  }
}

export async function removeMember(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await removeMarathonMember(
      req.user?.id,
      String(req.params.teamId),
      String(req.params.memberId),
    ));
  } catch (error) {
    sendError(res, error);
  }
}

export async function leaveTeam(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await leaveMarathonTeam(req.user?.id, String(req.params.teamId)));
  } catch (error) {
    sendError(res, error);
  }
}

export async function cancelLobby(req: AuthRequest, res: Response): Promise<void> {
  try {
    res.json(await cancelMarathonLobby(req.user?.id, String(req.params.teamId)));
  } catch (error) {
    sendError(res, error);
  }
}
