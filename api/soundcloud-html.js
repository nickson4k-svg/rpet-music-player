export default async function handler(req, res) {
  try {
    const response = await fetch('https://soundcloud.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    const html = await response.text();
    res.status(200).send(html);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
