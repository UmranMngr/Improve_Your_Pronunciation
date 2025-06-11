import os
import tempfile
import pytest
from app import app, db, Pronunciation, allowed_file

@pytest.fixture
def client():
    # Geçici veritabanı ve uploads klasörü oluştur
    db_fd, db_path = tempfile.mkstemp()
    uploads_dir = tempfile.mkdtemp()

    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + db_path
    app.config['UPLOAD_FOLDER'] = uploads_dir
    app.config['TESTING'] = True

    with app.test_client() as client:
        with app.app_context():
            db.create_all()
        yield client

    # Temizlik
    os.close(db_fd)
    os.unlink(db_path)
    for f in os.listdir(uploads_dir):
        os.remove(os.path.join(uploads_dir, f))
    os.rmdir(uploads_dir)

def test_allowed_file_function():
    # Geçerli uzantılar
    assert allowed_file('deneme.wav') is True
    assert allowed_file('ses.mp3') is True
    assert allowed_file('audio.ogg') is True
    assert allowed_file('kayit.m4a') is True

    # Geçersiz uzantılar
    assert allowed_file('resim.jpg') is False
    assert allowed_file('dokuman.pdf') is False
    assert allowed_file('dosya') is False  # Uzantı yok
    assert allowed_file('ses.wav.exe') is False  # Çift uzantı

def test_index_page(client):
    response = client.get('/')
    assert response.status_code == 200
    data_str = response.data.decode('utf-8')  # bytes -> string dönüşümü
    # "kelime" veya "kayıtlı" kelimelerinden en az biri geçmeli, küçük harfe çevirerek kontrol
    assert "kelime" in data_str.lower() or "kayıtlı" in data_str.lower()

def test_upload_endpoint(client):
    test_word = "deneme"
    dummy_file_path = os.path.join(tempfile.gettempdir(), 'dummy_test.wav')

    # Sahte ses dosyası oluştur
    with open(dummy_file_path, 'wb') as f:
        f.write(os.urandom(2048))  # 2 KB rastgele veri

    with open(dummy_file_path, 'rb') as f:
        data = {
            'word': test_word,
            'audio': (f, 'test.wav')
        }
        response = client.post('/upload', data=data, content_type='multipart/form-data')

    assert response.status_code == 302  # Redirect başarılı

    expected_filename = f"{test_word}_user.wav"
    expected_path = os.path.join(app.config['UPLOAD_FOLDER'], expected_filename)
    assert os.path.exists(expected_path)

    with app.app_context():
        rec = Pronunciation.query.filter_by(word=test_word).first()
        assert rec is not None
        assert rec.filename == expected_filename
