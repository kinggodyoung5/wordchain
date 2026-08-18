import { validateWord, pickStartWord, pickBotWord, getPoolsForDifficulty, Difficulty, lastChar, InvalidMessage } from './engine.js';
import { renderChainChar } from './dueum.js';

const BOT_THINK_MIN_MS = 700;
const BOT_THINK_MAX_MS = 1600;

// 난이도별 턴 제한시간(ms). null이면 시간 제한 없음.
const TURN_MS_BY_DIFFICULTY = {
  [Difficulty.VERY_EASY]: null,
  [Difficulty.EASY]: null,
  [Difficulty.NORMAL]: 30000,
  [Difficulty.HARD]: 20000,
  [Difficulty.VERY_HARD]: 20000,
};

export class SingleGame {
  /**
   * @param {{dict: any, profanitySet: Set<string>, el: Record<string, HTMLElement>, difficulty?: string, onEnd: (result:{winner:'me'|'bot', reason:string})=>void}} opts
   */
  constructor({ dict, profanitySet, el, difficulty, onEnd }) {
    this.dict = dict;
    this.profanitySet = profanitySet;
    this.el = el;
    this.difficulty = difficulty || Difficulty.NORMAL;
    this.turnMs = Object.prototype.hasOwnProperty.call(TURN_MS_BY_DIFFICULTY, this.difficulty)
      ? TURN_MS_BY_DIFFICULTY[this.difficulty]
      : 20000;
    this.onEnd = onEnd;
    this.usedWords = new Set();
    this.currentChar = null;
    this.turn = 'me';
    this.timerId = null;
    this.deadline = 0;
    this.ended = false;

    this.el.form.addEventListener('submit', this.handleSubmit);
  }

  start() {
    this.ended = false;
    this.usedWords.clear();
    this.el.log.innerHTML = '';
    this.el.error.textContent = '';
    this.pools = getPoolsForDifficulty(this.dict.difficultyPools, this.difficulty);

    const startWord = pickStartWord(this.dict.commonList);
    this.usedWords.add(startWord);
    this.currentChar = lastChar(startWord);
    this.addChip(startWord, 'start');
    this.setCurrentChar(this.currentChar);
    this.beginTurn('me');
  }

  destroy() {
    this.clearTimer();
    this.el.form.removeEventListener('submit', this.handleSubmit);
  }

  setCurrentChar(c) {
    renderChainChar(this.el.currentChar, c);
  }

  addChip(word, who) {
    const chip = document.createElement('span');
    chip.className = 'word-chip' + (who === 'me' ? ' me' : who === 'bot' ? ' bot' : '');
    chip.textContent = word;
    this.el.log.appendChild(chip);
    this.el.log.scrollTop = this.el.log.scrollHeight;
  }

  beginTurn(who) {
    if (this.ended) return;
    this.turn = who;
    this.el.error.textContent = '';
    if (who === 'me') {
      this.el.banner.textContent = '당신의 차례입니다';
      this.el.input.disabled = false;
      this.el.input.value = '';
      this.el.input.focus();
      if (this.turnMs) {
        this.el.timerFill.parentElement.style.visibility = 'visible';
        this.startTimer(() => this.finish('bot', 'TIMEOUT'));
      } else {
        this.clearTimer();
        this.el.timerFill.parentElement.style.visibility = 'hidden';
      }
    } else {
      this.el.banner.textContent = '봇이 생각 중…';
      this.el.input.disabled = true;
      this.clearTimer();
      const delay = BOT_THINK_MIN_MS + Math.random() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS);
      this.botTimeoutId = setTimeout(() => this.botMove(), delay);
    }
  }

  botMove() {
    if (this.ended) return;
    const word = pickBotWord({
      requiredFirstChar: this.currentChar,
      usedWords: this.usedWords,
      pools: this.pools,
    });
    if (!word) {
      this.finish('me', 'BOT_STUCK');
      return;
    }
    this.usedWords.add(word);
    this.currentChar = lastChar(word);
    this.addChip(word, 'bot');
    this.setCurrentChar(this.currentChar);
    this.beginTurn('me');
  }

  handleSubmit = (e) => {
    e.preventDefault();
    if (this.ended || this.turn !== 'me') return;
    const word = this.el.input.value.trim();
    const result = validateWord(word, {
      requiredFirstChar: this.currentChar,
      usedWords: this.usedWords,
      dictionarySet: this.dict.fullSet,
      profanitySet: this.profanitySet,
    });
    if (!result.ok) {
      this.el.error.textContent = InvalidMessage[result.reason];
      return;
    }
    this.usedWords.add(word);
    this.currentChar = lastChar(word);
    this.addChip(word, 'me');
    this.setCurrentChar(this.currentChar);
    this.el.input.value = '';
    this.clearTimer();
    this.beginTurn('bot');
  };

  startTimer(onTimeout) {
    this.clearTimer();
    this.deadline = Date.now() + this.turnMs;
    const tick = () => {
      const remain = this.deadline - Date.now();
      const pct = Math.max(0, remain / this.turnMs) * 100;
      this.el.timerFill.style.width = pct + '%';
      this.el.timerFill.classList.toggle('low', pct < 30);
      if (remain <= 0) {
        this.clearTimer();
        onTimeout();
        return;
      }
      this.timerId = requestAnimationFrame(tick);
    };
    tick();
  }

  clearTimer() {
    if (this.timerId) cancelAnimationFrame(this.timerId);
    this.timerId = null;
    if (this.botTimeoutId) clearTimeout(this.botTimeoutId);
    this.botTimeoutId = null;
  }

  finish(winner, reason) {
    this.ended = true;
    this.clearTimer();
    this.el.input.disabled = true;
    this.onEnd({ winner, reason });
  }
}
