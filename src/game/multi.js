import { getFirebase, getDbModule } from '../firebase/firebaseClient.js';
import { validateWord, pickStartWord, lastChar, InvalidMessage } from './engine.js';

const TURN_MS = 20000;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동되는 0/O/1/I 제외

function randomRoomCode(len = 6) {
  let code = '';
  for (let i = 0; i < len; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export class MultiGame {
  /**
   * @param {{dict:any, profanitySet:Set<string>, el:Record<string,HTMLElement>, callbacks:Record<string,Function>}} opts
   */
  constructor({ dict, profanitySet, el, callbacks }) {
    this.dict = dict;
    this.profanitySet = profanitySet;
    this.el = el;
    this.callbacks = callbacks;
    this.roomCode = null;
    this.uid = null;
    this.nickname = null;
    this.db = null;
    this.dbMod = null;
    this.unsubPlayers = null;
    this.unsubGame = null;
    this.pollTimerId = null;
    this.lastGameStatus = null;

    this.el.startBtn.addEventListener('click', () => this.startGame());
    this.el.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
    this.el.leaveGameBtn.addEventListener('click', () => this.leaveRoom());
    this.el.form.addEventListener('submit', this.handleSubmit);
  }

  async ensureFirebase() {
    if (!this.db) {
      const { db, uid } = await getFirebase();
      this.db = db;
      this.uid = uid;
      this.dbMod = await getDbModule();
    }
    return this.db;
  }

  async createRoom(nickname) {
    await this.ensureFirebase();
    const { ref, set, serverTimestamp, onDisconnect } = this.dbMod;
    this.nickname = nickname;
    let code;
    // 코드 충돌 방지를 위해 존재 여부 확인 후 생성 (드물게 재시도)
    for (let attempt = 0; attempt < 5; attempt++) {
      code = randomRoomCode();
      const { get } = this.dbMod;
      const snap = await get(ref(this.db, `rooms/${code}/meta`));
      if (!snap.exists()) break;
    }
    this.roomCode = code;

    await set(ref(this.db, `rooms/${code}/meta`), {
      hostUid: this.uid,
      status: 'waiting',
      createdAt: serverTimestamp(),
    });
    await set(ref(this.db, `rooms/${code}/players/${this.uid}`), {
      nickname,
      isHost: true,
      connected: true,
      joinedAt: serverTimestamp(),
    });
    onDisconnect(ref(this.db, `rooms/${code}/players/${this.uid}/connected`)).set(false);

    this.attachListeners();
    this.callbacks.onRoomJoined(code, true);
  }

  async joinRoom(code, nickname) {
    await this.ensureFirebase();
    const { ref, get, set, serverTimestamp, onDisconnect } = this.dbMod;
    code = code.trim().toUpperCase();
    const metaSnap = await get(ref(this.db, `rooms/${code}/meta`));
    if (!metaSnap.exists()) {
      throw new Error('방을 찾을 수 없습니다. 코드를 확인해주세요.');
    }
    const meta = metaSnap.val();
    if (meta.status !== 'waiting') {
      throw new Error('이미 게임이 시작된 방입니다.');
    }
    this.nickname = nickname;
    this.roomCode = code;
    await set(ref(this.db, `rooms/${code}/players/${this.uid}`), {
      nickname,
      isHost: false,
      connected: true,
      joinedAt: serverTimestamp(),
    });
    onDisconnect(ref(this.db, `rooms/${code}/players/${this.uid}/connected`)).set(false);

    this.attachListeners();
    this.callbacks.onRoomJoined(code, false);
  }

  attachListeners() {
    const { ref, onValue } = this.dbMod;
    const playersRef = ref(this.db, `rooms/${this.roomCode}/players`);
    const gameRef = ref(this.db, `rooms/${this.roomCode}/game`);
    const metaRef = ref(this.db, `rooms/${this.roomCode}/meta`);

    this.players = {};
    this.meta = {};

    this.unsubPlayers = onValue(playersRef, (snap) => {
      this.players = snap.val() || {};
      this.renderRoomPlayers();
      this.renderGamePlayers();
    });
    this.unsubMeta = onValue(metaRef, (snap) => {
      this.meta = snap.val() || {};
      this.renderRoomPlayers();
      if (this.meta.status === 'playing' && this.callbacks.currentScreen() === 'multi-room') {
        this.callbacks.onGameStarted();
      }
    });
    this.unsubGame = onValue(gameRef, (snap) => {
      this.game = snap.val();
      this.renderGame();
    });

    this.pollTimerId = setInterval(() => this.checkTimeout(), 1000);
  }

  renderRoomPlayers() {
    if (!this.el.roomCodeDisplay) return;
    this.el.roomCodeDisplay.textContent = this.roomCode || '------';
    const list = Object.entries(this.players || {});
    this.el.roomPlayerList.innerHTML = '';
    for (const [uid, p] of list) {
      const li = document.createElement('li');
      li.textContent = p.nickname + (p.connected === false ? ' (연결 끊김)' : '');
      if (p.isHost) {
        const tag = document.createElement('span');
        tag.className = 'host-tag';
        tag.textContent = '방장';
        li.appendChild(tag);
      }
      this.el.roomPlayerList.appendChild(li);
    }
    const isHost = this.meta && this.meta.hostUid === this.uid;
    const connectedCount = list.filter(([, p]) => p.connected !== false).length;
    this.el.startBtn.classList.toggle('hidden', !isHost);
    this.el.startBtn.disabled = connectedCount < 2;
    this.el.roomWaitHint.textContent = isHost
      ? connectedCount < 2
        ? '다른 사람이 참가할 때까지 기다려주세요 (최소 2명)'
        : '게임을 시작할 수 있습니다!'
      : '방장이 시작하기를 기다리는 중…';
  }

  renderGamePlayers() {
    if (!this.el.playerOrder || !this.game) return;
  }

  renderGame() {
    const g = this.game;
    if (!g || !this.el.currentCharEl) return;

    this.el.currentCharEl.textContent = g.currentChar || '-';

    // 참가자 순서 표시
    this.el.playerOrder.innerHTML = '';
    (g.turnOrder || []).forEach((uid, idx) => {
      const li = document.createElement('li');
      const p = this.players[uid];
      li.textContent = p ? p.nickname : '???';
      if (idx === g.currentTurnIndex && g.status === 'playing') li.classList.add('active');
      if (g.eliminated && g.eliminated[uid]) li.classList.add('eliminated');
      this.el.playerOrder.appendChild(li);
    });

    // 로그
    this.el.wordLog.innerHTML = '';
    (g.log || []).forEach((entry) => {
      const chip = document.createElement('span');
      const isMe = entry.uid === this.uid;
      chip.className = 'word-chip' + (isMe ? ' me' : entry.uid ? '' : '');
      chip.textContent = entry.word;
      this.el.wordLog.appendChild(chip);
    });
    this.el.wordLog.scrollTop = this.el.wordLog.scrollHeight;

    const myTurn = g.status === 'playing' && g.turnOrder[g.currentTurnIndex] === this.uid;
    this.el.input.disabled = !myTurn;
    if (myTurn) this.el.input.focus();

    if (g.status === 'playing') {
      const currentUid = g.turnOrder[g.currentTurnIndex];
      const currentNick = this.players[currentUid]?.nickname || '???';
      this.el.turnBanner.textContent = myTurn ? '당신의 차례입니다' : `${currentNick}님의 차례`;
      const remain = Math.max(0, (g.turnDeadline || 0) - Date.now());
      const pct = Math.max(0, Math.min(100, (remain / TURN_MS) * 100));
      this.el.timerFill.style.width = pct + '%';
      this.el.timerFill.classList.toggle('low', pct < 30);
    }

    if (g.status === 'ended' && this.lastGameStatus !== 'ended') {
      const winnerNick = g.winnerUid ? this.players[g.winnerUid]?.nickname : null;
      this.callbacks.onGameEnded({
        iWon: g.winnerUid === this.uid,
        winnerNickname: winnerNick,
      });
    }
    this.lastGameStatus = g.status;
  }

  async startGame() {
    if (!this.meta || this.meta.hostUid !== this.uid) return;
    const connectedUids = Object.entries(this.players)
      .filter(([, p]) => p.connected !== false)
      .map(([uid]) => uid);
    if (connectedUids.length < 2) return;

    // 셔플
    for (let i = connectedUids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [connectedUids[i], connectedUids[j]] = [connectedUids[j], connectedUids[i]];
    }
    const startWord = pickStartWord(this.dict.commonList);

    const { ref, set } = this.dbMod;
    await set(ref(this.db, `rooms/${this.roomCode}/game`), {
      status: 'playing',
      turnOrder: connectedUids,
      currentTurnIndex: 0,
      currentChar: lastChar(startWord),
      usedWords: { [startWord]: true },
      log: [{ word: startWord, uid: null }],
      eliminated: {},
      turnDeadline: Date.now() + TURN_MS,
      winnerUid: null,
      startedAt: Date.now(),
    });
    await set(ref(this.db, `rooms/${this.roomCode}/meta/status`), 'playing');
    this.callbacks.onGameStarted();
  }

  handleSubmit = async (e) => {
    e.preventDefault();
    const g = this.game;
    if (!g || g.status !== 'playing') return;
    if (g.turnOrder[g.currentTurnIndex] !== this.uid) return;
    const word = this.el.input.value.trim();

    const result = validateWord(word, {
      requiredFirstChar: g.currentChar,
      usedWords: new Set(Object.keys(g.usedWords || {})),
      dictionarySet: this.dict.fullSet,
      profanitySet: this.profanitySet,
    });
    if (!result.ok) {
      this.el.error.textContent = InvalidMessage[result.reason];
      return;
    }
    this.el.error.textContent = '';
    this.el.input.value = '';

    const { ref, runTransaction } = this.dbMod;
    const myUid = this.uid;
    const dict = this.dict;
    const profanitySet = this.profanitySet;

    await runTransaction(ref(this.db, `rooms/${this.roomCode}/game`), (game) => {
      if (!game) return game;
      if (game.status !== 'playing') return game;
      if (game.turnOrder[game.currentTurnIndex] !== myUid) return game;
      const used = new Set(Object.keys(game.usedWords || {}));
      const check = validateWord(word, {
        requiredFirstChar: game.currentChar,
        usedWords: used,
        dictionarySet: dict.fullSet,
        profanitySet,
      });
      if (!check.ok) return game;

      game.usedWords = game.usedWords || {};
      game.usedWords[word] = true;
      game.log = game.log || [];
      game.log.push({ word, uid: myUid });
      game.currentChar = lastChar(word);
      game.currentTurnIndex = nextActiveIndex(game, game.currentTurnIndex);
      game.turnDeadline = Date.now() + TURN_MS;
      return game;
    });
  };

  async checkTimeout() {
    if (!this.game || this.game.status !== 'playing') return;
    if (Date.now() <= (this.game.turnDeadline || Infinity)) return;
    const { ref, runTransaction } = this.dbMod;
    await runTransaction(ref(this.db, `rooms/${this.roomCode}/game`), (game) => {
      if (!game || game.status !== 'playing') return game;
      if (Date.now() <= (game.turnDeadline || Infinity)) return game;
      const uid = game.turnOrder[game.currentTurnIndex];
      game.eliminated = game.eliminated || {};
      game.eliminated[uid] = true;
      const active = game.turnOrder.filter((u) => !game.eliminated[u]);
      if (active.length <= 1) {
        game.status = 'ended';
        game.winnerUid = active[0] || null;
        return game;
      }
      game.currentTurnIndex = nextActiveIndex(game, game.currentTurnIndex);
      game.turnDeadline = Date.now() + TURN_MS;
      return game;
    });
  }

  async leaveRoom() {
    this.detachListeners();
    if (this.db && this.roomCode && this.uid) {
      const { ref, set, get } = this.dbMod;
      try {
        await set(ref(this.db, `rooms/${this.roomCode}/players/${this.uid}/connected`), false);
        if (this.game && this.game.status === 'playing') {
          const { runTransaction } = this.dbMod;
          const myUid = this.uid;
          await runTransaction(ref(this.db, `rooms/${this.roomCode}/game`), (game) => {
            if (!game || game.status !== 'playing') return game;
            game.eliminated = game.eliminated || {};
            game.eliminated[myUid] = true;
            const active = game.turnOrder.filter((u) => !game.eliminated[u]);
            if (active.length <= 1) {
              game.status = 'ended';
              game.winnerUid = active[0] || null;
              return game;
            }
            if (game.turnOrder[game.currentTurnIndex] === myUid) {
              game.currentTurnIndex = nextActiveIndex(game, game.currentTurnIndex);
              game.turnDeadline = Date.now() + TURN_MS;
            }
            return game;
          });
        }
      } catch {
        // 네트워크 오류는 무시하고 로컬 상태만 정리
      }
    }
    this.roomCode = null;
    this.game = null;
    this.callbacks.onLeft();
  }

  detachListeners() {
    if (this.unsubPlayers) this.unsubPlayers();
    if (this.unsubMeta) this.unsubMeta();
    if (this.unsubGame) this.unsubGame();
    if (this.pollTimerId) clearInterval(this.pollTimerId);
    this.unsubPlayers = this.unsubMeta = this.unsubGame = this.pollTimerId = null;
  }
}

function nextActiveIndex(game, fromIndex) {
  const n = game.turnOrder.length;
  let idx = fromIndex;
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    const uid = game.turnOrder[idx];
    if (!game.eliminated || !game.eliminated[uid]) return idx;
  }
  return fromIndex;
}
