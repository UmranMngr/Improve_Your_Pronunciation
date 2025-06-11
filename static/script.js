// 1. Kart: Sesli Arama + Telaffuz Dinleme
const startVoiceSearchBtn = document.getElementById('start-voice-search');
const wordInput = document.getElementById('word-input');
const playPronunciationBtn = document.getElementById('play-pronunciation-btn');
const pronunciationAudio = document.getElementById('pronunciation-audio');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'tr-TR';
recognition.interimResults = false;
recognition.maxAlternatives = 1;

// Sesli arama başlat/durdur
startVoiceSearchBtn.onclick = () => {
    if (startVoiceSearchBtn.textContent === '🎤 Sesli Arama Başlat') {
        recognition.start();
        startVoiceSearchBtn.textContent = '🛑 Durdur';
    } else {
        recognition.stop();
    }
};

recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase().trim();
    wordInput.value = transcript;

    loadUserAudio(transcript);

    playPronunciationBtn.disabled = transcript === '';
};



recognition.onerror = (event) => {
    alert('Sesli arama sırasında hata: ' + event.error);
    startVoiceSearchBtn.textContent = '🎤 Sesli Arama Başlat';
};

recognition.onend = () => {
    startVoiceSearchBtn.textContent = '🎤 Sesli Arama Başlat';
};

// Kayıtlı telaffuz sesi var mı kontrol et
function checkPronunciationAudio(word) {
    if (!word) {
        pronunciationAudio.src = '';
        pronunciationAudio.style.display = 'none';
        playPronunciationBtn.disabled = true;
        return;
    }

    fetch(`/static/pronunciations/${word}.mp3`, { method: 'HEAD' })
        .then(res => {
            if (res.ok) {
                pronunciationAudio.src = `/static/pronunciations/${word}.mp3`;
                pronunciationAudio.style.display = 'block';
                playPronunciationBtn.disabled = false; // Kayıt varsa buton aktif
            } else {
                pronunciationAudio.src = '';
                pronunciationAudio.style.display = 'none';
                playPronunciationBtn.disabled = false; // Kayıt yoksa TTS için yine aktif
            }
        })
        .catch(() => {
            pronunciationAudio.src = '';
            pronunciationAudio.style.display = 'none';
            playPronunciationBtn.disabled = false; // Hata olsa bile TTS için aktif
        });
}

// Kullanıcının yüklediği ses var mı kontrol et ve göster
function loadUserAudio(word) {
    if (!word) {
        removeUserAudioElement();
        return;
    }

    fetch(`/get_user_audio/${word}`)
        .then(res => res.json())
        .then(data => {
            if (data.exists) {
                let userAudio = document.getElementById('user-audio');
                if (!userAudio) {
                    userAudio = document.createElement('audio');
                    userAudio.id = 'user-audio';
                    userAudio.controls = true;
                    wordInput.parentNode.appendChild(userAudio);
                }
                userAudio.src = data.url;
            } else {
                removeUserAudioElement();
            }
        })
        .catch(() => {
            removeUserAudioElement();
        });
}

function removeUserAudioElement() {
    const existing = document.getElementById('user-audio');
    if (existing) existing.remove();
}

// Türkçe karakter var mı kontrolü (dil seçimi için)
function isTurkish(word) {
    return /[çğıöşü]/i.test(word);
}

// Doğru Telaffuzu Dinle butonuna tıklayınca
playPronunciationBtn.onclick = () => {
    const text = wordInput.value.trim();
    if (!text) {
        alert('Lütfen önce bir kelime yazın veya sesli arama yapın.');
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isTurkish(text) ? 'tr-TR' : 'en-US';

    window.speechSynthesis.cancel();  // Varsa önceki sesi iptal et
    window.speechSynthesis.speak(utterance);
}

// Input değişince kayıtlı ses ve kullanıcı sesi kontrolü
wordInput.addEventListener('input', () => {
    const w = wordInput.value.trim();
    if (w) {
        loadUserAudio(w);  // SADECE kullanıcı tarafından yüklenen ses
        playPronunciationBtn.disabled = false;
    } else {
        playPronunciationBtn.disabled = true;
        removeUserAudioElement();
    }
});



// ----------------------------------------------------------
// 2. Kart: Ses Kaydı & Yükleme

const recordWordInput = document.getElementById('record-word-input');
const startRecordBtn = document.getElementById('start-record-btn');
const stopRecordBtn = document.getElementById('stop-record-btn');
const recordedWordDiv = document.getElementById('recorded-word');
const recordedAudio = document.getElementById('recorded-audio');
const uploadRecordingBtn = document.getElementById('upload-recording-btn');

let mediaRecorder;
let audioChunks = [];

startRecordBtn.onclick = () => {
    const word = recordWordInput.value.trim();
    if (!word) {
        alert('Lütfen kayıt için kelimeyi yazınız.');
        return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();

            startRecordBtn.disabled = true;
            stopRecordBtn.disabled = false;
            recordedWordDiv.textContent = '';
            recordedAudio.style.display = 'none';
            uploadRecordingBtn.disabled = true;

            audioChunks = [];

            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                recordedAudio.src = audioUrl;
                recordedAudio.style.display = 'block';

                recordedWordDiv.textContent = `Kaydedilen kelime: ${word}`;

                uploadRecordingBtn.disabled = false;
                uploadRecordingBtn.audioBlob = audioBlob;
            };
        })
        .catch(err => alert('Mikrofon erişimi reddedildi veya desteklenmiyor: ' + err));
};

stopRecordBtn.onclick = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    startRecordBtn.disabled = false;
    stopRecordBtn.disabled = true;
};

uploadRecordingBtn.onclick = () => {
    const word = recordWordInput.value.trim();
    if (!word) {
        alert('Lütfen kelimeyi yazınız.');
        return;
    }
    if (!uploadRecordingBtn.audioBlob) {
        alert('Yüklenecek ses kaydı yok.');
        return;
    }

    const formData = new FormData();
    formData.append('word', word);
    formData.append('audio', uploadRecordingBtn.audioBlob, `${word}.wav`);

    fetch('/upload', {
        method: 'POST',
        body: formData
    }).then(res => {
        if (res.redirected) {
            window.location.href = res.url;
        } else {
            alert('Yükleme başarısız oldu.');
        }
    }).catch(() => alert('Yükleme sırasında hata oluştu.'));
};

recordWordInput.addEventListener('input', () => {
    uploadRecordingBtn.disabled = !recordWordInput.value.trim();
});

// ----------------------------------------------------------
// Ses kayıt silme butonları (ortak)

document.addEventListener('DOMContentLoaded', () => {
    const deleteButtons = document.querySelectorAll('.delete-audio-btn');

    deleteButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const word = btn.dataset.word;
            const filename = btn.dataset.filename;

            if (!confirm(`"${word}" kelimesine ait ses kaydını silmek istediğinize emin misiniz?`)) return;

            fetch('/delete_user_audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            })
            .then(res => res.json())
            .then(data => {
                alert(data.message);
                if (data.success) {
                    const li = document.getElementById(`record-${word}`);
                    if (li) li.remove();

                    const userAudio = document.getElementById('user-audio');
                    if (userAudio && userAudio.src.includes(filename)) {
                        userAudio.remove();
                    }
                }
            })
            .catch(() => alert('Silme işlemi sırasında hata oluştu.'));
        });
    });
});
