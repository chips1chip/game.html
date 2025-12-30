// ===== Chat & Player List =====
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const localUser = sessionStorage.getItem('username') || 'Player';
let currentDrawer = null;

const TURN_PNG = 'https://img.icons8.com/?size=80&id=FMenQlIdi2Rw&format=png';
const TURN_FALLBACK = 'https://img.icons8.com/?size=64&id=CCxiK5APZInu&format=gif&color=f7f7f7';

// ===== Chat Sending =====
if (chatInput && chatMessages) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
      const msg = chatInput.value.trim();
      socket.emit('chatMessage', msg);
      chatInput.value = '';
    }
  });
}

// ===== Append Message =====
function appendMessage(data) {
  if (!chatMessages) return;
  let username, message;

  if (typeof data === 'string') {
    username = 'System';
    message = data;
  } else {
    username = data.username || 'System';
    message = data.message || '';
  }

  const div = document.createElement('div');
  if (username.toLowerCase() === 'system') {
    div.textContent = message;
    div.style.cssText = `
      text-align:center;
      font-style:italic;
      background:linear-gradient(90deg,#fff4c2,#ffe7a8);
      padding:6px 10px;
      border-radius:10px;
      margin:6px 0;
      color:#333;
    `;
  } else {
    const nameSpan = document.createElement('strong');
    nameSpan.textContent = (username === localUser) ? 'You' : username;
    nameSpan.style.marginRight = '8px';
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    div.appendChild(nameSpan);
    div.appendChild(msgSpan);
    div.style.background = (username === localUser) ? '#d1ffd8' : '#d1e7ff';
    div.style.padding = '6px 10px';
    div.style.borderRadius = '12px';
    div.style.margin = '4px 0';
  }

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== Socket Listeners =====

// Chat messages
socket.on('chatMessage', (data) => appendMessage(data));

// Waiting message
socket.on('waitingForPlayers', (msg) =>
  appendMessage({ username: 'System', message: msg || 'Waiting for more players...' })
);

// Player join/leave announcements
socket.on('playerJoined', (username) =>
  appendMessage({ username: 'System', message: `🎉 ${username} has joined the game!` })
);

socket.on('playerLeft', (username) =>
  appendMessage({ username: 'System', message: `🚪 ${username} has left the game.` })
);

// Drawer choosing/drawing
socket.on('drawerChoosing', (drawerName) =>
  appendMessage({ username: 'System', message: `🎲 ${drawerName} is choosing a word...` })
);

socket.on('setDrawer', (drawerName) =>
  appendMessage({ username: 'System', message: `🖌️ ${drawerName} is drawing now.` })
);

// ===== Player List Update =====
socket.on('playersUpdate', (players) => {
  const list = document.getElementById('playersList');
  if (!list) return;
  list.innerHTML = '';

  // Handle both [{username:'A'}] and ['A']
  players.forEach(p => {
    const name = p.username || p;
    const li = document.createElement('li');
    li.dataset.name = name;
    if (name === localUser) li.classList.add('you');
    if (currentDrawer && name === currentDrawer) li.classList.add('drawer');

    // Add icon if drawer
    if (currentDrawer && name === currentDrawer) {
      const img = document.createElement('img');
      img.src = TURN_PNG;
      img.alt = 'turn';
      img.className = 'turn-icon';
      img.onerror = () => {
        if (img.src !== TURN_FALLBACK) img.src = TURN_FALLBACK;
      };
      li.appendChild(img);
    }

    const txt = document.createElement('span');
    txt.textContent = name;
    li.appendChild(txt);
    list.appendChild(li);
  });
});

// Update current drawer visuals
socket.on('setDrawer', (drawerName) => {
  currentDrawer = drawerName;
  const list = document.getElementById('playersList');
  if (!list) return;

  Array.from(list.children).forEach(li => {
    li.classList.toggle('drawer', li.dataset.name === drawerName);

    // Remove old icons
    const existing = li.querySelector('.turn-icon');
    if (existing) existing.remove();

    // Add icon to drawer
    if (li.dataset.name === drawerName) {
      const img = document.createElement('img');
      img.src = TURN_PNG;
      img.alt = 'turn';
      img.className = 'turn-icon';
      img.onerror = () => {
        if (img.src !== TURN_FALLBACK) img.src = TURN_FALLBACK;
      };
      li.insertBefore(img, li.firstChild);
    }
  });
});
