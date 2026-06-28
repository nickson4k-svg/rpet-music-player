export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const trackId = url.searchParams.get('id');
    if (!trackId) {
      return new Response('Missing id', { status: 400 });
    }

    // Step 1: Follow Audius redirect to get the actual stream URL
    const audiusUrl = `https://discoveryprovider.audius.co/v1/tracks/${trackId}/stream?app_name=Rpet`;
    
    // We fetch with manual redirect to intercept the Location header
    const initialRes = await fetch(audiusUrl, { redirect: 'manual' });
    let streamUrl = audiusUrl;

    if (initialRes.status >= 300 && initialRes.status < 400) {
      streamUrl = initialRes.headers.get('location') || audiusUrl;
    }

    // Step 2: Fetch the actual media stream and stream it back to the client
    // By passing the original request's headers (like Range), we support seeking!
    const headers = new Headers(req.headers);
    headers.delete('host'); // Let fetch handle the host
    
    const mediaRes = await fetch(streamUrl, {
      headers,
      redirect: 'follow'
    });

    // Step 3: Return the response, but append CORS headers!
    const responseHeaders = new Headers(mediaRes.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range');
    responseHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');

    return new Response(mediaRes.body, {
      status: mediaRes.status,
      statusText: mediaRes.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
