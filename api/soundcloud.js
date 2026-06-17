export default async function handler(req, res) {
  const { path, ...query } = req.query;
  
  if (!path) {
    return res.status(400).json({ error: 'Path is required' });
  }
  
  const pathArray = Array.isArray(path) ? path : [path];
  const pathString = pathArray.join('/');
  const queryString = new URLSearchParams(query).toString();
  const targetUrl = `https://api-v2.soundcloud.com/${pathString}${queryString ? '?' + queryString : ''}`;
  
  try {
    const forwardedFor = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
    const acceptLanguage = req.headers['accept-language'] || 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7';
    
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'application/json; charset=utf-8',
        'Accept-Language': acceptLanguage,
        'Origin': 'https://soundcloud.com',
        'Referer': 'https://soundcloud.com/',
        'X-Forwarded-For': forwardedFor
      }
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
