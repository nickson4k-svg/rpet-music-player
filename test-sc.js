async function testSC() {
  const clientId = '9RxIC6NwiaJEj6SsGAJgmHYOYauqhn9E'; // Fallback
  
  try {
    console.log('Testing Playlist Search...');
    const searchRes = await fetch(`https://api-v2.soundcloud.com/search/playlists?q=workout hardstyle&client_id=${clientId}&limit=1`);
    const searchData = await searchRes.json();
    const playlist = searchData.collection[0];
    console.log('Playlist:', playlist.title);
    console.log('Tracks count:', playlist.tracks.length);
    console.log('First 5 tracks:', playlist.tracks.slice(0, 5).map(t => t.title));
  } catch (e) {
    console.error('Error', e);
  }
}
testSC();
