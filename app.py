import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.secret_key = 'gizli_anahtar'

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(BASE_DIR, 'db', 'app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Upload ve db klasörlerini oluştur
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(os.path.join(BASE_DIR, 'db'), exist_ok=True)

db = SQLAlchemy(app)

ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg', 'm4a'}

class Pronunciation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.String(80), unique=True, nullable=False)
    filename = db.Column(db.String(120), unique=True, nullable=False)

    def __repr__(self):
        return f'<Pronunciation {self.word}>'

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# BEFORE_FIRST_REQUEST yerine bu şekilde tablo oluştur
def create_tables():
    with app.app_context():
        db.create_all()

@app.route('/')
def index():
    pronunciations = Pronunciation.query.all()
    records = {p.word: p.filename for p in pronunciations}
    return render_template('index.html', records=records)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/get_user_audio/<word>')
def get_user_audio(word):
    word = word.lower()
    pronunciation = Pronunciation.query.filter_by(word=word).first()
    if pronunciation:
        return jsonify({'exists': True, 'url': url_for('uploaded_file', filename=pronunciation.filename)})
    return jsonify({'exists': False})

@app.route('/upload', methods=['POST'])
def upload():
    if 'audio' not in request.files or 'word' not in request.form:
        flash('Lütfen kelime ve ses dosyası seçiniz.')
        return redirect(url_for('index'))

    word = request.form['word'].strip().lower()
    file = request.files['audio']

    if file.filename == '':
        flash('Dosya seçilmedi.')
        return redirect(url_for('index'))

    if not allowed_file(file.filename):
        flash('Sadece ses dosyası yükleyebilirsiniz (wav, mp3, ogg, m4a).')
        return redirect(url_for('index'))

    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = secure_filename(f"{word}_user.{ext}")
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    pronunciation = Pronunciation.query.filter_by(word=word).first()
    if pronunciation:
        pronunciation.filename = filename
    else:
        pronunciation = Pronunciation(word=word, filename=filename)
        db.session.add(pronunciation)
    db.session.commit()

    flash(f'"{word}" kelimesi için ses dosyanız başarıyla yüklendi.')
    return redirect(url_for('index'))


@app.route('/delete_user_audio', methods=['POST'])
def delete_user_audio():
    data = request.get_json()
    if not data or 'filename' not in data:
        return jsonify({'success': False, 'message': 'Dosya adı alınamadı.'})

    filename = data['filename']
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)

    # Dosya varsa sil
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception as e:
            return jsonify({'success': False, 'message': f'Dosya silinirken hata: {str(e)}'})
    # Dosya yoksa sadece bilgi mesajı ver, ama devam et
    else:
        # Burada hata dönme, sadece bilgilendir
        print(f'Dosya bulunamadı: {filename}')

    # DB kaydını sil (filename'e göre)
    pronunciation = Pronunciation.query.filter_by(filename=filename).first()
    if pronunciation:
        try:
            db.session.delete(pronunciation)
            db.session.commit()
        except Exception as e:
            return jsonify({'success': False, 'message': f'Veritabanı güncellenirken hata: {str(e)}'})
    else:
        # DB'de kayıt yoksa bilgilendir (opsiyonel)
        print(f'Veritabanında kayıt bulunamadı: {filename}')

    return jsonify({'success': True, 'message': f'"{filename}" dosyası ve kayıt başarıyla silindi (varsa).'})

if __name__ == '__main__':
    create_tables()
    app.run(debug=True)
