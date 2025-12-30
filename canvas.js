const socket = window.socket || io();
const username = sessionStorage.getItem('username') || 'Player';
if (!window.socket) window.socket = socket;

const notice = document.getElementById('drawerNotice');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Word popup container (reuse in DOM instead of creating new each time)
let wordPopup = document.getElementById('wordPopup');
let wordChoicesDiv = document.getElementById('wordChoices');
if (!wordPopup) {
  wordPopup = document.createElement('div');
  wordPopup.id = 'wordPopup';
  wordPopup.style = `
    display:none;
    position:fixed;
    top:50%; left:50%;
    transform:translate(-50%,-50%);
    background:white; padding:20px 30px;
    border-radius:15px; box-shadow:0 0 15px rgba(0,0,0,0.2);
    font-family:'Chewy', cursive; text-align:center; z-index:999;
  `;
  const title = document.createElement('h3');
  title.textContent = 'Choose a word to draw 🎨';
  wordChoicesDiv = document.createElement('div');
  wordChoicesDiv.id = 'wordChoices';
  wordChoicesDiv.style = 'display:flex; justify-content:center; gap:15px; margin-top:15px;';
  wordPopup.appendChild(title);
  wordPopup.appendChild(wordChoicesDiv);
  document.body.appendChild(wordPopup);
}

// --- Canvas Drawing ---
socket.on('drawBuffer', (points) => {
  points.forEach(({ x, y, prev, color, size }) => {
    if (!prev) return;
    ctx.strokeStyle = color || '#000';
    ctx.lineWidth = size || 4;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(x, y);
    ctx.stroke();
  });
});

socket.on('clearCanvas', () => ctx.clearRect(0, 0, canvas.width, canvas.height));

// Fill handling
function hexToRgba(hex) {
  hex = String(hex || '000000').replace('#','');
  if(hex.length===3) hex=hex.split('').map(c=>c+c).join('');
  const bigint = parseInt(hex,16);
  return [(bigint>>16)&255, (bigint>>8)&255, bigint&255, 255];
}

function colorsEqual(data, idx, colorArr) {
  return data[idx]===colorArr[0] && data[idx+1]===colorArr[1] &&
         data[idx+2]===colorArr[2] && data[idx+3]===colorArr[3];
}

function floodFillCanvas(canvas, ctx, x, y, fillColorStr){
  const w=canvas.width,h=canvas.height;
  if(x<0||x>=w||y<0||y>=h) return;
  const img=ctx.getImageData(0,0,w,h);
  const data=img.data;
  const startIdx=(y*w+x)*4;
  const target=[data[startIdx], data[startIdx+1], data[startIdx+2], data[startIdx+3]];
  const fill=hexToRgba(fillColorStr);
  if(target.every((v,i)=>v===fill[i])) return;
  const stack=[[x,y]];
  const visited=new Uint8Array(w*h);
  while(stack.length){
    const [cx,cy]=stack.pop();
    if(cx<0||cy<0||cx>=w||cy>=h) continue;
    const idx=cy*w+cx;
    if(visited[idx]) continue;
    visited[idx]=1;
    const di=idx*4;
    if(!colorsEqual(data,di,target)) continue;
    data[di]=fill[0]; data[di+1]=fill[1]; data[di+2]=fill[2]; data[di+3]=fill[3];
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
  ctx.putImageData(img,0,0);
}

socket.on('fill', ({ x, y, color }) => floodFillCanvas(canvas, ctx, x, y, color));

// --- Drawer Turn Updates ---
socket.on('setDrawer', (drawerName) => {
  window.isDrawer = (drawerName === username);
  if (notice) notice.textContent = window.isDrawer
    ? "🎨 It's your turn to draw!"
    : `🖌️ ${drawerName} is drawing...`;
});

socket.on('drawerChoosing', (drawerName) => {
  if (drawerName !== username && notice) notice.textContent = `🎲 ${drawerName} is choosing a word...`;
});

// --- Word Options Popup ---
socket.on('wordOptions', (words) => {
  if (!window.isDrawer) return;
  window.isChoosing = true;
  wordPopup.style.display='block';
  wordChoicesDiv.innerHTML='';
  words.forEach(word=>{
    const btn=document.createElement('button');
    btn.textContent=word;
    btn.style.cssText='padding:10px 20px;margin:5px;background:#ffc4d5;border:none;border-radius:6px;cursor:pointer;';
    btn.onclick=()=>{
      socket.emit('wordChosen', word);
      wordPopup.style.display='none';
      // wait for server confirmation
    };
    wordChoicesDiv.appendChild(btn);
  });
});

socket.on('wordMask', mask => {
  if(notice) notice.textContent = `🔤 Word: ${mask}`;
});

socket.on('wordChosenConfirm', word => {
  window.isChoosing = false;
  window.isDrawer = true; // ensure drawer flag
  if(notice) notice.textContent = `🎨 Word: ${word}`;
});
