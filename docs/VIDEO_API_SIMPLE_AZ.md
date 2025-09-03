# 🎥 Video API - Sadə İstifadə Təlimatı

## 📋 Nədir?

Bu API ilə siz video fayllarını yükləyə, siyahısını görə və brauzerdə oynada bilərsiniz.

**Server URL:** `https://backlify-v2.onrender.com`

---

## 🚀 API Endpointləri

### 1. Video Yükləmə

**Endpoint:** `POST /video/upload`

**Nə üçün:** Video faylını serverə yükləmək

**Göndərilən məlumat:**
```javascript
// FormData istifadə edin
const formData = new FormData();
formData.append('video', videoFile); // videoFile = input.files[0]
```

**Göndərilən sorğu:**
```javascript
const response = await fetch('https://backlify-v2.onrender.com/video/upload', {
  method: 'POST',
  body: formData
});
```

**Alınan cavab:**
```json
{
  "success": true,
  "message": "Video uğurla yükləndi",
  "data": {
    "videoId": 1,
    "filename": "video_123.mp4",
    "originalName": "my-video.mp4",
    "fileSize": 1570024,
    "mimeType": "video/mp4",
    "uploadedAt": "2025-08-31T14:09:40.127122"
  }
}
```

**Tam nümunə:**
```html
<input type="file" id="videoInput" accept="video/*">
<button onclick="uploadVideo()">Video Yüklə</button>

<script>
async function uploadVideo() {
  const fileInput = document.getElementById('videoInput');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Zəhmət olmasa video faylı seçin!');
    return;
  }
  
  const formData = new FormData();
  formData.append('video', file);
  
  try {
    const response = await fetch('https://backlify-v2.onrender.com/video/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert(`Video uğurla yükləndi! ID: ${result.data.videoId}`);
      console.log('Video məlumatları:', result.data);
    } else {
      alert('Xəta: ' + result.error);
    }
  } catch (error) {
    alert('Xəta baş verdi: ' + error.message);
  }
}
</script>
```

---

### 2. Video Siyahısı

**Endpoint:** `GET /video/list`

**Nə üçün:** Bütün yüklənmiş videoların siyahısını görmək

**Göndərilən sorğu:**
```javascript
const response = await fetch('https://backlify-v2.onrender.com/video/list');
```

**Alınan cavab:**
```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": 1,
        "filename": "video_123.mp4",
        "original_name": "my-video.mp4",
        "file_size": 1570024,
        "mime_type": "video/mp4",
        "uploaded_at": "2025-08-31T14:09:40.127122"
      }
    ],
    "total": 1
  }
}
```

**Tam nümunə:**
```javascript
async function getVideoList() {
  try {
    const response = await fetch('https://backlify-v2.onrender.com/video/list');
    const result = await response.json();
    
    if (result.success) {
      const videos = result.data.videos;
      console.log('Mövcud videolar:', videos);
      
      // Videoları göstər
      videos.forEach(video => {
        console.log(`ID: ${video.id}, Ad: ${video.original_name}`);
      });
    }
  } catch (error) {
    console.error('Xəta:', error);
  }
}
```

---

### 3. Video Oynatma

**Endpoint:** `GET /video/:id`

**Nə üçün:** Videonu brauzerdə görüntüləmək

**HTML-də istifadə:**
```html
<video controls width="400" height="300">
  <source src="https://backlify-v2.onrender.com/video/1" type="video/mp4">
  Brauzeriniz video teqini dəstəkləmir.
</video>
```

**JavaScript-də istifadə:**
```javascript
function playVideo(videoId) {
  const videoElement = document.querySelector('video');
  videoElement.src = `https://backlify-v2.onrender.com/video/${videoId}`;
  videoElement.load(); // Video yüklə
  videoElement.play(); // Oynat
}
```

---

### 4. Video Məlumatları

**Endpoint:** `GET /video/:id/info`

**Nə üçün:** Video haqqında məlumat əldə etmək (fayl ölçüsü, yüklənmə tarixi və s.)

**Göndərilən sorğu:**
```javascript
const videoId = 1;
const response = await fetch(`https://backlify-v2.onrender.com/video/${videoId}/info`);
```

**Alınan cavab:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "filename": "video_123.mp4",
    "originalName": "my-video.mp4",
    "fileSize": 1570024,
    "fileSizeMB": "1.50",
    "mimeType": "video/mp4",
    "uploadedAt": "2025-08-31T14:09:40.127122"
  }
}
```

---

### 5. Video Silmə

**Endpoint:** `DELETE /video/:id`

**Nə üçün:** Videonu serverdən silmək

**Göndərilən sorğu:**
```javascript
const videoId = 1;
const response = await fetch(`https://backlify-v2.onrender.com/video/${videoId}`, {
  method: 'DELETE'
});
```

**Alınan cavab:**
```json
{
  "success": true,
  "message": "Video uğurla silindi"
}
```

---

### 6. Video Statistikası

**Endpoint:** `GET /video/stats`

**Nə üçün:** Ümumi video yükləmə statistikasını görmək

**Göndərilən sorğu:**
```javascript
const response = await fetch('https://backlify-v2.onrender.com/video/stats');
```

**Alınan cavab:**
```json
{
  "success": true,
  "data": {
    "totalVideos": 5,
    "totalSizeMB": "7.50",
    "recentUploads": 2
  }
}
```

---

## 🎯 Tam İstifadə Nümunəsi

```html
<!DOCTYPE html>
<html>
<head>
    <title>Video Yükləmə və Oynatma</title>
</head>
<body>
    <h1>Video Yükləmə Sistemi</h1>
    
    <!-- Video Yükləmə -->
    <div>
        <h2>Video Yüklə</h2>
        <input type="file" id="videoInput" accept="video/*">
        <button onclick="uploadVideo()">Yüklə</button>
    </div>
    
    <!-- Video Oynatma -->
    <div>
        <h2>Video Oynat</h2>
        <video id="videoPlayer" controls width="400" height="300">
            Video yükləyin
        </video>
        <br>
        <input type="number" id="videoIdInput" placeholder="Video ID">
        <button onclick="playVideo()">Oynat</button>
    </div>
    
    <!-- Video Siyahısı -->
    <div>
        <h2>Video Siyahısı</h2>
        <button onclick="loadVideoList()">Siyahını Yüklə</button>
        <div id="videoList"></div>
    </div>

    <script>
        // Video yükləmə
        async function uploadVideo() {
            const fileInput = document.getElementById('videoInput');
            const file = fileInput.files[0];
            
            if (!file) {
                alert('Video faylı seçin!');
                return;
            }
            
            const formData = new FormData();
            formData.append('video', file);
            
            try {
                const response = await fetch('https://backlify-v2.onrender.com/video/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert(`Video yükləndi! ID: ${result.data.videoId}`);
                    loadVideoList(); // Siyahını yenilə
                } else {
                    alert('Xəta: ' + result.error);
                }
            } catch (error) {
                alert('Xəta: ' + error.message);
            }
        }
        
        // Video oynatma
        function playVideo() {
            const videoId = document.getElementById('videoIdInput').value;
            if (!videoId) {
                alert('Video ID daxil edin!');
                return;
            }
            
            const videoElement = document.getElementById('videoPlayer');
            videoElement.src = `https://backlify-v2.onrender.com/video/${videoId}`;
            videoElement.load();
        }
        
        // Video siyahısı
        async function loadVideoList() {
            try {
                const response = await fetch('https://backlify-v2.onrender.com/video/list');
                const result = await response.json();
                
                if (result.success) {
                    const videoListDiv = document.getElementById('videoList');
                    const videos = result.data.videos;
                    
                    let html = '<ul>';
                    videos.forEach(video => {
                        html += `<li>ID: ${video.id} - ${video.original_name} (${(video.file_size/1024/1024).toFixed(2)} MB)</li>`;
                    });
                    html += '</ul>';
                    
                    videoListDiv.innerHTML = html;
                }
            } catch (error) {
                console.error('Xəta:', error);
            }
        }
        
        // Səhifə yükləndikdə video siyahısını yüklə
        window.onload = loadVideoList;
    </script>
</body>
</html>
```

---

## ⚠️ Əsas Qaydalar

1. **Fayl ölçüsü:** Maksimum 100MB
2. **Dəstəklənən formatlar:** MP4, MOV, AVI, WebM, MKV
3. **Content-Type:** `multipart/form-data` (yükləmə üçün)
4. **CORS:** Bütün domain-lərdən sorğular icazə verilir

---

## 🚨 Xəta Cavabları

```json
// Fayl çox böyük
{
  "success": false,
  "error": "Fayl çox böyükdür",
  "details": "Fayl ölçüsü 100MB limitini aşır"
}

// Yanlış fayl növü
{
  "success": false,
  "error": "Yanlış fayl növü",
  "details": "Yalnız video faylları icazə verilir"
}

// Video tapılmadı
{
  "success": false,
  "error": "Video tapılmadı",
  "details": "Tələb olunan video tapıla bilmədi"
}
```

---

## 💡 İstifadə Tövsiyələri

1. **Yükləmə:** Həmişə `FormData` istifadə edin
2. **Xəta idarəetməsi:** `try-catch` bloklarından istifadə edin
3. **Yükləmə göstəricisi:** Böyük fayllar üçün progress bar əlavə edin
4. **Video oynatma:** `video` teqinin `controls` atributundan istifadə edin
