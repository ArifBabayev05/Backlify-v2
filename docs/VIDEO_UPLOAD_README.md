# Video Upload API - Quick Start Guide

This guide will help you get started with the video upload functionality added to your Backlify-v2 project.

## 🚀 Quick Start

### 1. Database Setup

First, create the videos table in your Supabase database:

```sql
-- Run this in your Supabase SQL Editor
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_data BYTEA NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_filename ON videos(filename);
CREATE INDEX IF NOT EXISTS idx_videos_uploaded_at ON videos(uploaded_at);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON videos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE videos_id_seq TO authenticated;
GRANT ALL ON videos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE videos_id_seq TO service_role;
```

### 2. Test the API

#### Using the Test Script

```bash
# Run the comprehensive test suite
npm run test-video

# Or run directly
node src/tools/test-video-endpoints.js
```

#### Using cURL

```bash
# Upload a video
curl -X POST http://localhost:3000/video/upload \
  -F "video=@/path/to/your/video.mp4"

# Get video list
curl http://localhost:3000/video/list

# Stream a video (replace 1 with actual video ID)
curl http://localhost:3000/video/1

# Get video info
curl http://localhost:3000/video/1/info

# Delete a video
curl -X DELETE http://localhost:3000/video/1
```

#### Using the Web Interface

Open `src/client/components/video-upload-test.html` in your browser for a visual testing interface.

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/video/upload` | Upload video file |
| `GET` | `/video/list` | Get list of videos |
| `GET` | `/video/:id` | Stream video by ID |
| `GET` | `/video/:id/info` | Get video metadata |
| `DELETE` | `/video/:id` | Delete video by ID |
| `GET` | `/video/stats` | Get upload statistics |

## 🔧 Configuration

### Environment Variables

The video API uses your existing Supabase configuration:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
```

### File Limits

- **Maximum file size**: 100MB
- **Supported formats**: MP4, MOV, AVI, WebM, MKV
- **Storage**: Videos are stored as binary data in the database

## 🧪 Testing

### Test Coverage

The test script covers:
- ✅ Health check
- ✅ Video upload with validation
- ✅ Video listing and pagination
- ✅ Video streaming
- ✅ Video information retrieval
- ✅ Video deletion
- ✅ Error handling
- ✅ File type validation

### Running Tests

```bash
# Test against local server
npm run test-video

# Test against remote server
npm run test-video -- --base-url https://your-domain.com

# Get help
npm run test-video -- --help
```

## 📱 Frontend Integration

### JavaScript Example

```javascript
// Upload video
const formData = new FormData();
formData.append('video', fileInput.files[0]);

const response = await fetch('/video/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Video ID:', result.data.videoId);

// Display video
const videoElement = document.createElement('video');
videoElement.controls = true;
videoElement.src = `/video/${result.data.videoId}`;
document.body.appendChild(videoElement);
```

### HTML Example

```html
<video controls>
  <source src="/video/1" type="video/mp4">
  Your browser does not support the video tag.
</video>
```

## 🚨 Troubleshooting

### Common Issues

1. **"Database error"**
   - Check Supabase connection
   - Verify videos table exists
   - Check database permissions

2. **"File too large"**
   - Ensure file is under 100MB
   - Check multer configuration

3. **"Invalid file type"**
   - Verify file is a supported video format
   - Check MIME type validation

4. **"Video not found"**
   - Verify video ID exists
   - Check database for the video record

### Debug Mode

Enable debug logging:

```bash
DEBUG=video:* npm start
```

## 📚 Documentation

- **Full API Documentation**: [VIDEO_UPLOAD_API.md](VIDEO_UPLOAD_API.md)
- **Test Script**: `src/tools/test-video-endpoints.js`
- **Web Interface**: `src/client/components/video-upload-test.html`

## 🔒 Security Features

- File type validation
- File size limits
- MIME type checking
- Unique filename generation
- Input sanitization
- Database permission control

## 📈 Performance

- Database indexes for fast queries
- Efficient binary storage
- Streaming support for large files
- Cache control headers
- Pagination for large collections

## 🚀 Next Steps

1. **Test the API** using the provided test script
2. **Integrate with your frontend** using the examples above
3. **Customize file limits** if needed
4. **Add authentication** to restrict access
5. **Implement video processing** (thumbnails, compression)

## 🤝 Support

If you encounter issues:

1. Check the error logs
2. Run the test script
3. Verify database setup
4. Review this documentation
5. Check the full API documentation

---

**Happy video uploading! 🎥✨**
