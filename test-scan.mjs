const res = await fetch('http://localhost:3000/api/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ quickScan: true }),
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
