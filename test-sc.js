const clientId = 'EJXLGDA385DFulBm9nOdenF6rKx4aTCl';
async function run() {
  const res = await fetch(`https://api-v2.soundcloud.com/search/queries?q=hello&client_id=${clientId}&limit=5`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
