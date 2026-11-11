const options = [['English','영어','EN'],['Japanese','일본어','JA'],['Chinese (Simplified)','중국어 (간체)','ZH'],['Korean','한국어','KO'],['Spanish','스페인어','ES'],['French','프랑스어','FR'],['German','독일어','DE'],['Italian','이탈리아어','IT'],['Portuguese','포르투갈어','PT'],['Russian','러시아어','RU'],['Hindi','힌디어','HI'],['Arabic','아랍어','AR'],['Indonesian','인도네시아어','ID'],['Vietnamese','베트남어','VI'],['Thai','태국어','TH'],['Turkish','튀르키예어','TR'],['Dutch','네덜란드어','NL']];
const cards = document.querySelector('#cards');
const transcript = document.querySelector('#transcript');
const interim = document.querySelector('#interim');
const errorBox = document.querySelector('#error');
let segments = [], generation = 0, listening = false, recognition, restartTimer, recognitionRunning = false;
let audioUrls = [];
const soundFiles = {select:'/sounds/select.wav', start:'/sounds/start.wav', success:'/sounds/success.wav', error:'/sounds/error.wav'};
const soundToggle = document.querySelector('#sound-toggle');
const soundVolume = document.querySelector('#sound-volume');
let soundEnabled = true, currentSound;
try { const saved = localStorage.getItem('lingua-live-sound'); if (saved !== null) soundEnabled = saved === 'on'; const volume = localStorage.getItem('lingua-live-sound-volume'); if (volume !== null && Number.isFinite(Number(volume))) soundVolume.value = Math.max(0, Math.min(50, Number(volume))); } catch {}
function updateSoundToggle() { soundToggle.setAttribute('aria-pressed', String(soundEnabled)); soundToggle.textContent = soundEnabled ? '효과음 켜짐' : '효과음 꺼짐'; }
function stopSound() { if (currentSound) { currentSound.pause(); currentSound.currentTime = 0; currentSound = null; } }
function playSound(type) {
  if (!soundEnabled || listening || recognitionRunning || !soundFiles[type] || [...document.querySelectorAll('.card audio')].some(audio => !audio.paused)) return;
  stopSound(); const sound = new Audio(soundFiles[type]); currentSound = sound; sound.volume = Number(soundVolume.value) / 100;
  sound.addEventListener('ended', () => { if (currentSound === sound) currentSound = null; });
  sound.play().catch(() => { if (currentSound === sound) currentSound = null; });
}
soundToggle.addEventListener('click', () => { soundEnabled = !soundEnabled; if (!soundEnabled) stopSound(); updateSoundToggle(); try { localStorage.setItem('lingua-live-sound', soundEnabled ? 'on' : 'off'); } catch {} });
soundVolume.addEventListener('input', () => { if (currentSound) currentSound.volume = Number(soundVolume.value) / 100; try { localStorage.setItem('lingua-live-sound-volume', soundVolume.value); } catch {} });
updateSoundToggle();
function releaseAudio() { audioUrls.forEach(url => URL.revokeObjectURL(url)); audioUrls = []; }
const selected = [0,1,2];
const usageKey = 'lingua-live-usage-v1';
let browserUsage = { requests: 0, measuredRequests: 0, input: 0, output: 0, thoughts: 0, total: 0 };
try { const saved = JSON.parse(localStorage.getItem(usageKey) || 'null'); if (saved) for (const name of Object.keys(browserUsage)) if (Number.isFinite(saved[name]) && saved[name] >= 0) browserUsage[name] = saved[name]; } catch {}
function recordBrowserUsage(meta) {
  browserUsage.requests++;
  if (meta && Number.isFinite(meta.totalTokenCount)) {
    browserUsage.measuredRequests++;
    for (const [name, field] of [['input','promptTokenCount'],['output','candidatesTokenCount'],['thoughts','thoughtsTokenCount'],['total','totalTokenCount']]) if (Number.isFinite(meta[field]) && meta[field] >= 0) browserUsage[name] += meta[field];
  }
  try { localStorage.setItem(usageKey, JSON.stringify(browserUsage)); } catch {}
}
async function refreshUsage() {
  try {
    const response = await fetch('/api/usage', {cache:'no-store'}); if (!response.ok) throw new Error();
    let data = await response.json(); const browserOnly = data.unavailable === true; if (browserOnly) data = browserUsage;
    for (const name of ['input','output','thoughts','total']) document.querySelector(`#usage-${name}`).textContent = data[name].toLocaleString('ko-KR');
    const scope = browserOnly ? '이 브라우저에 저장된 사용량' : '서버 시작 이후 사용량';
    document.querySelector('#usage-note').textContent = `${scope} · 응답 ${data.requests}건 중 ${data.measuredRequests}건에 사용량 정보가 포함되었습니다. API 계정 전체 사용량이나 비용은 표시하지 않습니다.`;
  } catch { document.querySelector('#usage-note').textContent = '토큰 사용량을 불러오지 못했습니다.'; }
}
function makeCards() {
  releaseAudio(); cards.innerHTML = '';
  selected.forEach((choice, i) => {
    const card = document.createElement('article'); card.className = 'card';
    const top = document.createElement('div'); top.className = 'card-top';
    const number = document.createElement('span'); number.className = 'language-icon'; number.textContent = options[choice][2];
    const select = document.createElement('select'); select.setAttribute('aria-label', `${i + 1}번째 번역 언어`);
    options.forEach((opt, n) => { const o = document.createElement('option'); o.value = n; o.textContent = opt[1]; o.selected = n === choice; select.append(o); });
    select.addEventListener('change', () => { playSound('select'); selected[i] = Number(select.value); generation++; makeCards(); if (segments.length) translateAll(); });
    const tag = document.createElement('span'); tag.className = 'card-number'; tag.textContent = `0${i + 1}`;
    top.append(number, select, tag); const text = document.createElement('p'); text.className = 'translation-text placeholder'; text.textContent = '번역이 여기에 표시됩니다';
    const controls = document.createElement('div'); controls.className = 'card-actions';
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'action-copy'; copy.textContent = '복사'; copy.disabled = true;
    const save = document.createElement('button'); save.type = 'button'; save.className = 'action-save'; save.textContent = '저장'; save.disabled = true;
    save.addEventListener('click', async () => {
      const requestGeneration = generation; const sourceText = segments.join(' '); const translatedText = text.textContent;
      save.disabled = true; save.textContent = '저장 중...';
      try {
        const response = await fetch('/api/save-translation', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ sourceText, translatedText, targetLanguage:options[choice][0] }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || '저장에 실패했습니다.');
        if (requestGeneration === generation && card.isConnected) { save.textContent = '✓ 저장됨'; showError(''); playSound('success'); }
      } catch (err) { if (requestGeneration === generation && card.isConnected) { save.textContent = '저장'; showError(err.message); } }
      finally { if (requestGeneration === generation && card.isConnected) save.disabled = false; }
    });
    const saveText = document.createElement('button'); saveText.type = 'button'; saveText.className = 'action-download'; saveText.textContent = 'TXT 저장'; saveText.disabled = true;
    saveText.addEventListener('click', () => { const url = URL.createObjectURL(new Blob(['\ufeff', text.textContent], { type:'text/plain;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `translation-${options[choice][2].toLowerCase()}.txt`; link.click(); playSound('success'); setTimeout(() => URL.revokeObjectURL(url), 1000); });
    const speak = document.createElement('button'); speak.type = 'button'; speak.className = 'action-speak'; speak.textContent = '음성 생성'; speak.disabled = true;
    const speed = document.createElement('select'); speed.setAttribute('aria-label', `${i + 1}번째 음성 재생 속도`); speed.disabled = true;
    [0.75, 1, 1.25, 1.5, 2].forEach(value => { const option = document.createElement('option'); option.value = value; option.textContent = `${value}×`; option.selected = value === 1; speed.append(option); });
    const audio = document.createElement('audio'); audio.controls = true; audio.hidden = true; audio.setAttribute('aria-label', `${i + 1}번째 번역 음성`);
    const download = document.createElement('a'); download.textContent = '↓ WAV 다운로드'; download.className = 'download'; download.hidden = true; download.download = `translation-${options[choice][2].toLowerCase()}.wav`;
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(text.textContent); copy.textContent = '✓ 복사됨'; playSound('success'); setTimeout(() => { copy.textContent = '복사'; }, 2000); } catch { showError('복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해주세요.'); } });
    download.addEventListener('click', () => playSound('success'));
    audio.addEventListener('play', stopSound);
    speed.addEventListener('change', () => { audio.playbackRate = Number(speed.value); playSound('select'); });
    speak.addEventListener('click', async () => {
      const requestGeneration = generation; const requestedText = text.textContent; playSound('start'); speak.disabled = true; speak.textContent = '음성 생성 중...';
      try {
        const response = await fetch('/api/speech', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ text:requestedText }) });
        if (!response.ok) { const data = await response.json(); throw new Error(data.error || '음성 생성에 실패했습니다.'); }
        const blob = await response.blob(); const getUsage = name => Number(response.headers.get(`X-Usage-${name}`) || 0); recordBrowserUsage(response.headers.get('X-Usage-Available') === '1' ? { promptTokenCount:getUsage('Input'), candidatesTokenCount:getUsage('Output'), thoughtsTokenCount:getUsage('Thoughts'), totalTokenCount:getUsage('Total') } : null); refreshUsage(); if (requestGeneration !== generation || !card.isConnected) return;
        if (audio.dataset.url) { URL.revokeObjectURL(audio.dataset.url); audioUrls = audioUrls.filter(url => url !== audio.dataset.url); }
        const url = URL.createObjectURL(blob); audioUrls.push(url); audio.dataset.url = url; audio.src = url; audio.hidden = false; audio.playbackRate = Number(speed.value); speed.disabled = false; download.href = url; download.hidden = false; showError('');
        await audio.play().catch(() => {});
      } catch (err) { if (requestGeneration === generation && card.isConnected) showError(err.message); }
      finally { if (requestGeneration === generation && card.isConnected) { speak.disabled = false; speak.textContent = '다시 생성'; } }
    });
    controls.append(copy, save, saveText, speak, speed, download); card.append(top, text, controls, audio); cards.append(card);
  });
}
function showError(message) { errorBox.textContent = message; errorBox.hidden = !message; if (message) playSound('error'); }
function updateSource() { transcript.value = segments.join(' '); }
async function translateAll({ announce = false } = {}) {
  const current = ++generation; const text = segments.join(' '); if (!text.trim()) return; if (text.length > 4000) { showError('번역할 내용은 4,000자까지 입력할 수 있습니다.'); return; }
  releaseAudio();
  document.querySelectorAll('.card').forEach(card => { card.querySelector('.translation-text').textContent = '번역 중...'; card.querySelector('.translation-text').classList.add('placeholder'); card.querySelectorAll('button, .card-actions select').forEach(el => el.disabled = true); const audio = card.querySelector('audio'); audio.pause(); audio.removeAttribute('src'); delete audio.dataset.url; audio.hidden = true; card.querySelector('.download').hidden = true; card.querySelectorAll('button')[1].textContent = '저장'; card.querySelectorAll('button')[3].textContent = '음성 생성'; });
  try {
    const response = await fetch('/api/translate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ text, languages:selected.map(i => options[i][0]) }) });
    const data = await response.json(); if (response.ok) recordBrowserUsage(data.usageMetadata); refreshUsage(); if (!response.ok) throw new Error(data.error || '번역에 실패했습니다.');
    if (current !== generation) return;
    document.querySelectorAll('.translation-text').forEach((el, i) => { el.textContent = data.translations[i]; el.classList.remove('placeholder'); el.closest('.card').querySelectorAll('button').forEach(button => button.disabled = false); }); showError(''); if (announce) playSound('success');
  } catch (err) { if (current !== generation) return; document.querySelectorAll('.translation-text').forEach(el => { el.textContent = '번역을 불러오지 못했습니다.'; }); showError(err.message); }
}
function setListening(active) {
  listening = active; document.querySelector('#mic').classList.toggle('active', active);
  document.querySelector('#mic').setAttribute('aria-label', active ? '음성 인식 중지' : '음성 인식 시작');
  document.querySelector('#state').innerHTML = active ? '<span></span> 듣고 있어요' : '<span></span> 대기 중';
  document.querySelector('#state').classList.toggle('live', active);
  document.querySelector('#mic-title').textContent = active ? '듣고 있어요' : '대화 시작하기';
  document.querySelector('#mic-hint').textContent = active ? '버튼을 누르면 녹음이 종료됩니다' : '버튼을 눌러 마이크를 켜주세요';
  document.querySelector('#source-language').disabled = active;
}
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition(); recognition.continuous = true; recognition.interimResults = true;
  recognition.onresult = event => { let pending = '', changed = false; for (let i = event.resultIndex; i < event.results.length; i++) { const result = event.results[i]; if (result.isFinal) { const next = result[0].transcript.trim(); if ((segments.join(' ') + ' ' + next).length > 4000) { setListening(false); recognition.stop(); showError('번역할 내용은 4,000자까지 입력할 수 있습니다.'); break; } segments.push(next); changed = true; } else pending += result[0].transcript; } interim.textContent = pending; if (changed) { updateSource(); translateAll(); } };
  recognition.onerror = event => { if (event.error === 'no-speech') return; setListening(false); showError(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? '마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.' : `음성 인식 오류: ${event.error}`); };
  recognition.onend = () => { recognitionRunning = false; interim.textContent = ''; if (listening) restartTimer = setTimeout(() => { if (listening) { try { recognitionRunning = true; recognition.start(); } catch { recognitionRunning = false; setListening(false); } } }, 250); };
} else { showError('이 브라우저는 음성 인식을 지원하지 않습니다. 최신 Chrome 또는 Edge에서 열어주세요.'); document.querySelector('#mic').disabled = true; }
document.querySelector('#mic').addEventListener('click', () => { if (listening) { setListening(false); clearTimeout(restartTimer); recognition.stop(); } else { showError(''); recognition.lang = document.querySelector('#source-language').value; try { stopSound(); recognitionRunning = true; setListening(true); recognition.start(); } catch { recognitionRunning = false; setListening(false); showError('마이크를 시작하지 못했습니다. 다시 시도해주세요.'); } } });
document.querySelector('#source-language').addEventListener('change', () => playSound('select'));
transcript.addEventListener('input', () => { generation++; segments = transcript.value ? [transcript.value] : []; makeCards(); });
document.querySelector('#translate-text').addEventListener('click', () => { if (listening) { setListening(false); clearTimeout(restartTimer); recognition.stop(); } segments = transcript.value.trim() ? [transcript.value] : []; if (!segments.length) return showError('번역할 내용을 입력해주세요.'); showError(''); playSound('start'); translateAll({ announce: true }); });
document.querySelector('.upload-action').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.querySelector('#file-input').click(); } });
document.querySelector('#file-input').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (!/\.(txt|md|csv|json)$/i.test(file.name)) throw new Error('TXT, MD, CSV 또는 JSON 파일을 선택해주세요.');
    if (file.size > 16000) throw new Error('파일 크기는 16KB 이하여야 합니다.');
    const buffer = await file.arrayBuffer(); const text = new TextDecoder('utf-8', {fatal:true}).decode(buffer).replace(/^\uFEFF/, '');
    if (!text.trim()) throw new Error('파일에 번역할 내용이 없습니다.');
    if (text.length > 4000) throw new Error('파일의 텍스트는 4,000자 이하여야 합니다.');
    if (listening) { setListening(false); clearTimeout(restartTimer); recognition.stop(); }
    generation++; segments = [text]; updateSource(); interim.textContent = ''; makeCards(); document.querySelector('#file-name').textContent = file.name; showError(''); playSound('success');
  } catch (err) { showError(err instanceof TypeError ? 'UTF-8로 저장된 텍스트 파일을 선택해주세요.' : err.message); }
  finally { event.target.value = ''; }
});
document.querySelector('#refresh-usage').addEventListener('click', refreshUsage);
document.querySelector('#clear').addEventListener('click', () => { if (listening) { setListening(false); clearTimeout(restartTimer); recognition.abort(); } generation++; segments = []; interim.textContent = ''; updateSource(); document.querySelector('#file-name').textContent = 'TXT · MD · CSV · JSON / UTF-8'; makeCards(); showError(''); playSound('select'); });
makeCards();

refreshUsage();

const moodButtons = document.querySelectorAll('[data-mood-option]');
function applyMood(mood) {
  if (![...moodButtons].some(button => button.dataset.moodOption === mood)) return;
  document.documentElement.dataset.mood = mood;
  moodButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.moodOption === mood)));
  try { localStorage.setItem('lingua-live-mood', mood); } catch {}
}
moodButtons.forEach(button => button.addEventListener('click', () => { if (button.getAttribute('aria-pressed') !== 'true') { applyMood(button.dataset.moodOption); playSound('select'); } }));
try { applyMood(localStorage.getItem('lingua-live-mood') || 'calm'); } catch { applyMood('calm'); }

const musicForm = document.querySelector('#music-form');
const musicInput = document.querySelector('#music-url');
const musicMessage = document.querySelector('#music-message');
const musicPlayer = document.querySelector('.music-player');
const musicLink = document.querySelector('#music-link');
let musicRequest = 0;
function parseYouTubeLink(value) {
  let url; try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
  const host = url.hostname.toLowerCase(); let id;
  if (host === 'youtu.be') { id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1]; }
  else if (['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return {embedUrl:`https://www.youtube-nocookie.com/embed/${id}`, songUrl:`https://www.youtube.com/watch?v=${id}`};
}
musicForm.addEventListener('submit', async event => {
  event.preventDefault(); const request = ++musicRequest; const button = musicForm.querySelector('button');
  button.disabled = true; musicMessage.textContent = '곡 링크를 확인하고 있어요...'; playSound('start');
  try {
    const value = musicInput.value.trim(); let url;
    try { url = new URL(value); } catch { throw new Error('올바른 Suno 또는 YouTube 링크를 입력해주세요.'); }
    const youtube = parseYouTubeLink(value); let data;
    if (youtube) data = youtube;
    else if (url.protocol === 'https:' && ['suno.com','www.suno.com'].includes(url.hostname.toLowerCase())) {
      const response = await fetch('/api/suno-link', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:value}) });
      data = await response.json(); if (!response.ok) throw new Error(data.error || '곡 링크를 불러오지 못했습니다.');
    } else throw new Error('지원하는 Suno 곡 또는 YouTube 동영상 링크를 입력해주세요.');
    if (request !== musicRequest) return;
    musicPlayer.src = data.embedUrl; musicPlayer.classList.toggle('youtube-player', Boolean(youtube)); musicPlayer.title = youtube ? 'YouTube 배경음악 플레이어' : 'Suno 배경음악 플레이어';
    musicLink.href = data.songUrl; musicLink.textContent = youtube ? 'YouTube에서 열기 ↗' : 'Suno에서 열기 ↗';
    musicMessage.textContent = youtube ? '플레이어에서 재생을 눌러주세요. 영상에 따라 삽입 재생이 제한될 수 있습니다.' : '곡을 불러왔어요. 플레이어에서 재생 버튼을 눌러주세요.'; playSound('success');
  } catch (error) { if (request === musicRequest) { musicMessage.textContent = error.message || '곡 링크를 불러오지 못했습니다.'; playSound('error'); } }
  finally { if (request === musicRequest) button.disabled = false; }
});

const backToTop = document.querySelector('#back-to-top');
function updateBackToTop() { backToTop.hidden = window.scrollY < 300; }
window.addEventListener('scroll', updateBackToTop, { passive: true });
backToTop.addEventListener('click', () => {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
});
updateBackToTop();
