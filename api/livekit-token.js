import { AccessToken } from 'livekit-server-sdk';

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    if (res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(200).end();
    }
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  let roomName;
  let participantName;
  let isHost = false;

  if (req.query) {
    roomName = req.query.roomName;
    participantName = req.query.participantName;
    isHost = req.query.isHost === 'true' || req.query.isHost === true;
  } else if (req.url) {
    const url = new URL(req.url, 'http://localhost');
    roomName = url.searchParams.get('roomName');
    participantName = url.searchParams.get('participantName');
    isHost = url.searchParams.get('isHost') === 'true';
  }

  if (!roomName || !participantName) {
    const errorObj = { error: 'Параметри roomName та participantName обов’язкові' };
    if (res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json(errorObj);
    }
    return new Response(JSON.stringify(errorObj), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Sanitized room and identity
  const cleanRoom = String(roomName).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanIdentity = String(participantName).trim().replace(/[^a-zA-Z0-9_ -]/g, '_');

  // LiveKit Cloud credentials
  const apiKey = (process.env.LIVEKIT_API_KEY || 'APIFT7Qzne74nQ4').trim();
  const apiSecret = (process.env.LIVEKIT_API_SECRET || 'PV6w7tfGYuCDUevqc1veQjHRAnRnLAFqIXSTXirypKiA').trim();
  let livekitUrl = (process.env.LIVEKIT_URL || 'wss://rpet-music-ayo8mv0c.livekit.cloud').trim();

  // Auto-normalize protocol
  if (livekitUrl.startsWith('https://')) {
    livekitUrl = livekitUrl.replace('https://', 'wss://');
  } else if (livekitUrl.startsWith('http://')) {
    livekitUrl = livekitUrl.replace('http://', 'ws://');
  } else if (!livekitUrl.startsWith('wss://') && !livekitUrl.startsWith('ws://')) {
    livekitUrl = `wss://${livekitUrl}`;
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: cleanIdentity,
      name: cleanIdentity,
      ttl: '6h',
    });

    at.addGrant({
      roomJoin: true,
      room: cleanRoom,
      canPublish: Boolean(isHost),
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    const result = {
      token,
      livekitUrl,
      roomName: cleanRoom,
      participantName: cleanIdentity,
      isHost: Boolean(isHost),
    };

    if (res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json(result);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    const errObj = { error: err.message || 'Не вдалося створити LiveKit токен' };
    if (res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json(errObj);
    }
    return new Response(JSON.stringify(errObj), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
