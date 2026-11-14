/** QR Model 2, version 5-L, byte mode, mask 0. No remote service or assets. */
export function liveQR(text: string): string {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 106) throw new Error('Live link exceeds QR capacity');
  const bits: number[] = [];
  const put = (value: number, size: number) => { for (let i = size - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  put(4, 4); put(bytes.length, 8); for (const b of bytes) put(b, 8);
  put(0, Math.min(4, 864 - bits.length)); while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a,b) => a * 2 + b, 0));
  for (let i = 0; data.length < 108; i++) data.push(i % 2 ? 17 : 236);
  const mul = (a: number, b: number) => { let r = 0; for (; b; b >>>= 1) { if (b & 1) r ^= a; a <<= 1; if (a & 256) a ^= 285; } return r; };
  let gen = [1], root = 1;
  for (let i = 0; i < 26; i++) { const next = Array(gen.length + 1).fill(0) as number[]; gen.forEach((v,j) => { next[j] = next[j]! ^ v; next[j+1] = next[j+1]! ^ mul(v, root); }); gen = next; root = mul(root,2); }
  const ecc = Array(26).fill(0) as number[];
  for (const b of data) { const factor = b ^ ecc.shift()!; ecc.push(0); for (let i = 0; i < 26; i++) ecc[i] = ecc[i]! ^ mul(gen[i+1]!, factor); }
  const size = 37, matrix = Array.from({length:size}, () => Array<boolean>(size).fill(false)), reserved = matrix.map(row => row.map(() => false));
  const set = (x:number,y:number,dark:boolean) => { if (x>=0&&y>=0&&x<size&&y<size) { matrix[y]![x]=dark; reserved[y]![x]=true; } };
  for (const [cx,cy] of [[3,3],[33,3],[3,33]]) for(let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++) { const d=Math.max(Math.abs(dx),Math.abs(dy)); set(cx!+dx,cy!+dy,d!==2&&d!==4); }
  for(let i=8;i<size-8;i++) { set(i,6,i%2===0); set(6,i,i%2===0); }
  for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) set(30+dx,30+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  const format=0x77c4, f=(i:number)=>!!((format>>>i)&1);
  for(let i=0;i<=5;i++) set(8,i,f(i)); set(8,7,f(6));set(8,8,f(7));set(7,8,f(8));for(let i=9;i<15;i++)set(14-i,8,f(i));
  for(let i=0;i<8;i++)set(size-1-i,8,f(i));for(let i=8;i<15;i++)set(8,size-15+i,f(i));set(8,size-8,true);
  const stream=[...data,...ecc].flatMap(b=>Array.from({length:8},(_,i)=>(b>>>(7-i))&1));let index=0,up=true;
  for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let v=0;v<size;v++){const y=up?size-1-v:v;for(let j=0;j<2;j++){const x=right-j;if(!reserved[y]![x]) matrix[y]![x]=!!((stream[index++]??0)^((x+y)%2===0?1:0));}}up=!up;}
  const path=matrix.flatMap((row,y)=>row.flatMap((dark,x)=>dark?[`M${x+4},${y+4}h1v1h-1z`]:[])).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><rect width="45" height="45" fill="white"/><path d="${path}" fill="black"/></svg>`;
}
