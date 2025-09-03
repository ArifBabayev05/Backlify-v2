# 🎥 Video Upload API Sənədləri

## 📋 Ümumi Məlumat

Video Upload API video fayllarını yükləmək, saxlamaq, əldə etmək və yayımlamaq üçün endpointlər təqdim edir. Videolar serverin disk sistemində fayl olaraq saxlanılır, metadata isə Supabase verilənlər bazasında effektiv idarəetmə və əldə etmə üçün saxlanılır.

**Əsas URL:** `https://backlify-v2.onrender.com/`

## 🏗️ Arxitektura

### Saxlama Strategiyası
- **Video Faylları**: `uploads/videos/` qovluğunda fiziki fayllar olaraq saxlanılır
- **Metadata**: Supabase verilənlər bazasında (`videos` cədvəli) saxlanılır
- **Üstünlüklər**: Daha yaxşı performans, effektiv yayım, asan fayl idarəetməsi

### Verilənlər Bazası Şeması
```sql
CREATE TABLE videos (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,        -- Diskdəki video faylının yolu
    file_size INTEGER NOT NULL,     -- Fayl ölçüsü baytlarda
    mime_type VARCHAR(100) NOT NULL, -- Video MIME növü
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 API Endpointləri

### 1. Video Yükləmə
**POST** `/video/upload`

Serverə video faylı yükləmək.

**Sorğu:**
- Content-Type: `multipart/form-data`
- Sahə adı: `video`

**Dəstəklənən Formatlar:**
- MP4, MOV, AVI, WebM, MKV
- Maksimum fayl ölçüsü: 100MB

**Cavab:**
```json
{
  "success": true,
  "message": "Video uğurla yükləndi",
  "data": {
    "videoId": 1,
    "filename": "video_1234567890_abc123.mp4",
    "originalName": "my-video.mp4",
    "fileSize": 1570024,
    "mimeType": "video/mp4",
    "uploadedAt": "2025-08-31T14:09:40.127122"
  }
}
```

**Nümunə:**
```bash
curl -X POST https://backlify-v2.onrender.com/video/upload \
  -F "video=@/path/to/your/video.mp4"
```

### 2. Video Siyahısını Əldə Etmək
**GET** `/video/list`

Bütün yüklənmiş videoların siyahısını səhifələmə ilə əldə etmək.

**Sorğu Parametrləri:**
- `limit` (istəyə bağlı): Səhifədəki video sayı (default: 100, max: 1000)
- `offset` (istəyə bağlı): Atlanacaq video sayı (default: 0)

**Cavab:**
```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": 1,
        "filename": "video_1234567890_abc123.mp4",
        "original_name": "my-video.mp4",
        "file_size": 1570024,
        "mime_type": "video/mp4",
        "uploaded_at": "2025-08-31T14:09:40.127122"
      }
    ],
    "total": 1,
    "limit": 100,
    "offset": 0
  }
}
```

**Nümunə:**
```bash
curl "https://backlify-v2.onrender.com/video/list?limit=10&offset=0"
```

### 3. Video Yayımı
**GET** `/video/:id`

ID-yə görə video faylını brauzer oynatması üçün yayımlamaq.

**Parametrlər:**
- `id`: Video ID-si (rəqəm)

**Cavab:**
- Uyğun başlıqlarla video faylı yayımı
- Effektiv yayım üçün range sorğularını dəstəkləyir
- Content-Type: Video MIME növü

**Nümunə:**
```bash
curl "https://backlify-v2.onrender.com/video/1"
```

**Brauzer İstifadəsi:**
```html
<video controls>
  <source src="https://backlify-v2.onrender.com/video/1" type="video/mp4">
  Brauzeriniz video teqini dəstəkləmir.
</video>
```

### 4. Video Məlumatlarını Əldə Etmək
**GET** `/video/:id/info`

Faktiki faylı yayımlamadan video metadata-sını əldə etmək.

**Cavab:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "filename": "video_1234567890_abc123.mp4",
    "originalName": "my-video.mp4",
    "fileSize": 1570024,
    "fileSizeMB": "1.50",
    "mimeType": "video/mp4",
    "uploadedAt": "2025-08-31T14:09:40.127122"
  }
}
```

### 5. Video Silmək
**DELETE** `/video/:id`

Video faylını silmək və metadata-sını silmək.

**Cavab:**
```json
{
  "success": true,
  "message": "Video uğurla silindi"
}
```

### 6. Video Statistikasını Əldə Etmək
**GET** `/video/stats`

Ümumi video yükləmə statistikasını əldə etmək.

**Cavab:**
```json
{
  "success": true,
  "data": {
    "totalVideos": 5,
    "totalSize": 7850120,
    "totalSizeMB": "7.50",
    "mimeTypeCounts": {
      "video/mp4": 5
    },
    "recentUploads": 2,
    "averageSize": "1.50"
  }
}
```

## 💾 Fayl Saxlama Sistemi

### Qovluq Strukturu
```
uploads/
└── videos/
    ├── video_1234567890_abc123.mp4
    ├── video_1234567891_def456.mp4
    └── ...
```

### Fayl Adlandırma Konvensiyası
- **Format**: `{original_name}_{timestamp}_{random_string}.{extension}`
- **Nümunə**: `my-video_1756649379555_efafce0b6ff4e4f0.mp4`
- **Üstünlüklər**: Fayl adı konfliktlərini qarşısını alır, orijinal uzantını saxlayır

### Fayl İdarəetməsi
- **Avtomatik Yaradılma**: Yükləmə qovluğu yoxdursa avtomatik yaradılır
- **Təmizlik**: Uğursuz yükləmələr avtomatik olaraq yaradılan faylları silir
- **Yol Saxlama**: Tam fayl yolları asan giriş üçün verilənlər bazasında saxlanılır

## 🔧 Texniki İmplementasiya

### Kod Strukturu

#### 1. Video Servisi (`src/services/videoService.js`)
```javascript
class VideoService {
  constructor() {
    // Supabase klientini başlat
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Yükləmə qovluğunu yarat
    this.uploadsDir = path.join(__dirname, '../../uploads/videos');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async uploadVideo(file) {
    // 1. Faylı yoxla (ölçü, format, MIME növü)
    this.validateVideoFile(file);
    
    // 2. Unikal fayl adı yarat
    const filename = this.generateUniqueFilename(file.originalname);
    const filePath = path.join(this.uploadsDir, filename);
    
    // 3. Faylı diskə yadda saxla
    fs.writeFileSync(filePath, file.buffer);
    
    // 4. Metadata-nı verilənlər bazasında saxla
    const { data, error } = await this.supabase
      .from('videos')
      .insert([{
        filename: filename,
        original_name: file.originalname,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.mimetype
      }])
      .select()
      .single();
    
    return { success: true, videoId: data.id, ... };
  }
}
```

#### 2. Video Kontroloru (`src/controllers/videoController.js`)
```javascript
class VideoController {
  async streamVideo(req, res) {
    // 1. Verilənlər bazasından video metadata-sını əldə et
    const result = await this.videoService.getVideoById(parseInt(id));
    const video = result.video;
    
    // 2. Diskdə faylın mövcudluğunu yoxla
    if (!fs.existsSync(video.file_path)) {
      return res.status(404).json({ error: 'Video faylı tapılmadı' });
    }
    
    // 3. Yayım başlıqlarını təyin et
    res.set({
      'Content-Type': video.mime_type,
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600'
    });
    
    // 4. Effektiv yayım üçün range sorğularını idarə et
    const range = req.headers.range;
    if (range) {
      // Xüsusi hissəni yayımla
      const stream = fs.createReadStream(video.file_path, { start, end });
      stream.pipe(res);
    } else {
      // Bütün faylı yayımla
      const stream = fs.createReadStream(video.file_path);
      stream.pipe(res);
    }
  }
}
```

#### 3. Video Marşrutları (`src/routes/videoRoutes.js`)
```javascript
const router = express.Router();

// Fayl yükləmələri üçün multer konfiqurasiyası
const upload = multer({
  storage: multer.memoryStorage(), // Müvəqqəti olaraq yaddaşda saxla
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    // Video fayl növlərini yoxla
    const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Yanlış fayl növü. Yalnız video faylları icazə verilir.'), false);
    }
  }
});

// Marşrut tərifləri
router.post('/upload', upload.single('video'), videoController.uploadVideo);
router.get('/list', videoController.getVideoList);
router.get('/:id', videoController.streamVideo);
router.get('/:id/info', videoController.getVideoInfo);
router.delete('/:id', videoController.deleteVideo);
router.get('/stats', videoController.getVideoStats);
```

### Verilənlər Bazası Əməliyyatları

#### Video Metadata Əlavə Etmək
```sql
INSERT INTO videos (filename, original_name, file_path, file_size, mime_type) 
VALUES ('video_123.mp4', 'my-video.mp4', '/uploads/videos/video_123.mp4', 1570024, 'video/mp4');
```

#### Yayım üçün Video Əldə Etmək
```sql
SELECT id, filename, original_name, file_path, file_size, mime_type, uploaded_at 
FROM videos 
WHERE id = 1;
```

#### Səhifələmə ilə Video Siyahısını Əldə Etmək
```sql
SELECT id, filename, original_name, file_size, mime_type, uploaded_at 
FROM videos 
ORDER BY uploaded_at DESC 
LIMIT 10 OFFSET 0;
```

## 🔒 Təhlükəsizlik Xüsusiyyətləri

- **Fayl Növü Yoxlaması**: Yalnız video faylları icazə verilir
- **Fayl Ölçüsü Limitləri**: Yükləmə başına maksimum 100MB
- **CORS Dəstəyi**: Cross-origin sorğuları aktivdir
- **Giriş Sanitizasiyası**: Bütün girişlər yoxlanır və sanitizasiya edilir
- **Xəta İdarəetməsi**: Hərtərəfli xəta idarəetməsi və qeydiyyat

## 📊 Performans Xüsusiyyətləri

- **Range Sorğuları**: Effektiv yayım üçün HTTP range sorğularını dəstəkləyir
- **Fayl Yayımı**: Bütün faylları yaddaşa yükləmək əvəzinə Node.js axınlarından istifadə edir
- **Keşləmə**: Video məzmunu üçün uyğun keş başlıqları
- **İndekslənmiş Sorğular**: Tez-tez sorğulanan sahələr üzərində verilənlər bazası indeksləri

## 🚨 Xəta İdarəetməsi

### Ümumi Xəta Cavabları

#### Fayl Çox Böyükdür
```json
{
  "success": false,
  "error": "Fayl çox böyükdür",
  "details": "Fayl ölçüsü 100MB limitini aşır"
}
```

#### Yanlış Fayl Növü
```json
{
  "success": false,
  "error": "Yanlış fayl növü",
  "details": "Yalnız video faylları icazə verilir"
}
```

#### Video Tapılmadı
```json
{
  "success": false,
  "error": "Video tapılmadı",
  "details": "Tələb olunan video tapıla bilmədi"
}
```

## 🔄 Binary Saxlamadan Miqrasiya

Əgər əvvəlki binary saxlamadan yüksəldirsinizsə:

1. **Miqrasiya skriptini işə salın**: `update-video-schema.sql`
2. **Serveri yenidən başladın**: `npm start`
3. **Videoları yenidən yükləyin**: Köhnə binary məlumatlar fayl əsaslı saxlamaya əvəz olunacaq
4. **Yayımı yoxlayın**: Bütün endpointlərin düzgün işlədiyini təsdiqləyin

## 📝 İstifadə Nümunələri

### Frontend İnteqrasiyası
```javascript
// Video yüklə
const formData = new FormData();
formData.append('video', fileInput.files[0]);

const response = await fetch('https://backlify-v2.onrender.com/video/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
const videoId = result.data.videoId;

// Video yayımı
const videoElement = document.querySelector('video');
videoElement.src = `https://backlify-v2.onrender.com/video/${videoId}`;
```

### cURL Nümunələri
```bash
# Video yüklə
curl -X POST https://backlify-v2.onrender.com/video/upload \
  -F "video=@sample-video.mp4"

# Video siyahısını əldə et
curl "https://backlify-v2.onrender.com/video/list"

# Video yayımı
curl "https://backlify-v2.onrender.com/video/1"

# Video məlumatları
curl "https://backlify-v2.onrender.com/video/1/info"

# Video sil
curl -X DELETE "https://backlify-v2.onrender.com/video/1"
```

## 🎯 Əsas Xüsusiyyətlər

1. **Fayl Əsaslı Saxlama**: Videolar diskdə fayl olaraq saxlanılır
2. **Effektiv Yayım**: Node.js axınları ilə yaxşı performans
3. **Range Dəstəyi**: Video axtarışı və qismən məzmun üçün
4. **Metadata İdarəetməsi**: Verilənlər bazasında strukturlaşdırılmış məlumat
5. **Avtomatik Təmizlik**: Uğursuz yükləmələr üçün fayl təmizliyi
6. **CORS Dəstəyi**: Cross-origin sorğular üçün tam dəstək

Bu sənəd video yükləmə və yayım sisteminin tam implementasiyasını əhatə edir, fayl saxlaması məntiqini, verilənlər bazası inteqrasiyasını və API istifadə nümunələrini daxil edir.
