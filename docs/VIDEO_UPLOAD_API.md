# Video Upload API Documentation

This document describes the video upload functionality added to the Backlify-v2 project. The video API provides endpoints for uploading, storing, retrieving, and streaming video files using Supabase as the backend database.

## Overview

The video upload system stores video files as binary data (BYTEA) in the Supabase database, providing:
- Secure file upload with validation
- Efficient storage and retrieval
- Video streaming capabilities
- Comprehensive error handling
- CORS support for cross-origin requests

## Database Schema

The system uses a `videos` table with the following structure:

```sql
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_data BYTEA NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Table Fields

- **id**: Unique identifier for each video (auto-incrementing)
- **filename**: Generated unique filename to avoid conflicts
- **original_name**: Original filename as uploaded by user
- **file_data**: Binary video data stored as BYTEA
- **file_size**: File size in bytes
- **mime_type**: MIME type of the video file
- **uploaded_at**: Timestamp when the video was uploaded

## API Endpoints

### 1. Upload Video

**POST** `/video/upload`

Upload a video file using multipart/form-data.

#### Request

- **Content-Type**: `multipart/form-data`
- **Field Name**: `video`
- **File Size Limit**: 100MB
- **Supported Formats**: MP4, MOV, AVI, WebM, MKV

#### Example Request

```bash
curl -X POST http://localhost:3000/video/upload \
  -F "video=@sample-video.mp4"
```

#### Response

```json
{
  "success": true,
  "message": "Video uploaded successfully",
  "data": {
    "videoId": 1,
    "filename": "sample-video_1703123456789_a1b2c3d4.mp4",
    "originalName": "sample-video.mp4",
    "fileSize": 5242880,
    "mimeType": "video/mp4",
    "uploadedAt": "2023-12-21T10:30:56.789Z"
  }
}
```

### 2. Get Video List

**GET** `/video/list`

Retrieve a list of all uploaded videos with metadata.

#### Query Parameters

- **limit** (optional): Number of videos to return (default: 100, max: 1000)
- **offset** (optional): Number of videos to skip (default: 0)

#### Example Request

```bash
curl "http://localhost:3000/video/list?limit=10&offset=0"
```

#### Response

```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "id": 1,
        "filename": "sample-video_1703123456789_a1b2c3d4.mp4",
        "original_name": "sample-video.mp4",
        "file_size": 5242880,
        "mime_type": "video/mp4",
        "uploaded_at": "2023-12-21T10:30:56.789Z"
      }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}
```

### 3. Stream Video

**GET** `/video/:id`

Stream a specific video file by ID for browser playback.

#### Path Parameters

- **id**: Video ID (integer)

#### Example Request

```bash
curl "http://localhost:3000/video/1"
```

#### Response

- **Content-Type**: Video MIME type (e.g., `video/mp4`)
- **Content-Length**: File size in bytes
- **Accept-Ranges**: `bytes` (for partial content support)
- **Cache-Control**: `public, max-age=3600`
- **Body**: Binary video data

### 4. Get Video Info

**GET** `/video/:id/info`

Get video information without downloading the binary data.

#### Path Parameters

- **id**: Video ID (integer)

#### Example Request

```bash
curl "http://localhost:3000/video/1/info"
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "filename": "sample-video_1703123456789_a1b2c3d4.mp4",
    "originalName": "sample-video.mp4",
    "fileSize": 5242880,
    "fileSizeMB": "5.00",
    "mimeType": "video/mp4",
    "uploadedAt": "2023-12-21T10:30:56.789Z"
  }
}
```

### 5. Delete Video

**DELETE** `/video/:id`

Delete a video by ID.

#### Path Parameters

- **id**: Video ID (integer)

#### Example Request

```bash
curl -X DELETE "http://localhost:3000/video/1"
```

#### Response

```json
{
  "success": true,
  "message": "Video deleted successfully",
  "data": {
    "success": true,
    "message": "Video deleted successfully"
  }
}
```

### 6. Get Video Statistics

**GET** `/video/stats`

Get overall video upload statistics.

#### Example Request

```bash
curl "http://localhost:3000/video/stats"
```

#### Response

```json
{
  "success": true,
  "data": {
    "totalVideos": 5,
    "totalSize": 26214400,
    "totalSizeMB": "25.00",
    "mimeTypeCounts": {
      "video/mp4": 3,
      "video/webm": 2
    },
    "recentUploads": 2,
    "averageSize": "5.00"
  }
}
```

## File Validation

### Supported Formats

- **MP4** (`.mp4`) - `video/mp4`
- **MOV** (`.mov`) - `video/quicktime`
- **AVI** (`.avi`) - `video/x-msvideo`
- **WebM** (`.webm`) - `video/webm`
- **MKV** (`.mkv`) - `video/x-matroska`

### File Size Limits

- **Maximum**: 100MB (100 * 1024 * 1024 bytes)
- **Recommended**: Under 50MB for optimal performance

### Validation Rules

1. **File Type**: Must be a supported video format
2. **MIME Type**: Must match the file extension
3. **File Size**: Must not exceed 100MB
4. **File Integrity**: Must be a valid video file

## Error Handling

### Common Error Responses

#### 400 Bad Request

```json
{
  "success": false,
  "error": "Invalid file",
  "details": "File size 150.5MB exceeds maximum allowed size of 100MB"
}
```

#### 404 Not Found

```json
{
  "success": false,
  "error": "Video not found",
  "details": "The requested video could not be found"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Upload failed",
  "details": "Database connection error"
}
```

### Error Codes

- **File Size Exceeded**: File is larger than 100MB
- **Invalid File Type**: File format not supported
- **Invalid MIME Type**: MIME type doesn't match file extension
- **Database Error**: Supabase connection or query issues
- **Video Not Found**: Requested video ID doesn't exist

## CORS Support

All video endpoints include comprehensive CORS headers:

- **Access-Control-Allow-Origin**: `*` (configurable)
- **Access-Control-Allow-Methods**: `GET, POST, DELETE, OPTIONS`
- **Access-Control-Allow-Headers**: Standard and custom headers
- **Access-Control-Allow-Credentials**: `true`

## Security Features

### File Upload Security

1. **File Type Validation**: Strict MIME type checking
2. **File Size Limits**: Prevents large file uploads
3. **Unique Filenames**: Prevents filename conflicts
4. **Input Sanitization**: Validates all input parameters

### Database Security

1. **Prepared Statements**: Uses Supabase client for safe queries
2. **Permission Control**: Database-level access control
3. **Data Validation**: Server-side validation before storage

## Performance Considerations

### Storage Optimization

- Videos are stored as binary data for efficient retrieval
- Database indexes on `filename` and `uploaded_at` for fast queries
- Pagination support for large video collections

### Streaming Optimization

- Proper HTTP headers for browser video playback
- Cache control headers for improved performance
- Support for partial content requests (range requests)

## Testing

### Test Script

Use the provided test script to verify all endpoints:

```bash
npm run test-video
```

Or run directly:

```bash
node src/tools/test-video-endpoints.js
```

### Test Coverage

The test script covers:
- Health check endpoint
- Video upload with validation
- Video listing and pagination
- Video streaming
- Video information retrieval
- Video deletion
- Error handling
- File type validation

## Integration Examples

### Frontend JavaScript

#### Upload Video

```javascript
const formData = new FormData();
formData.append('video', fileInput.files[0]);

const response = await fetch('/video/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Uploaded video ID:', result.data.videoId);
```

#### Display Video

```html
<video controls>
  <source src="/video/1" type="video/mp4">
  Your browser does not support the video tag.
</video>
```

#### Get Video List

```javascript
const response = await fetch('/video/list?limit=10');
const result = await response.json();

result.data.videos.forEach(video => {
  console.log(`Video: ${video.original_name} (${video.file_size} bytes)`);
});
```

### cURL Examples

#### Upload Video

```bash
curl -X POST http://localhost:3000/video/upload \
  -F "video=@/path/to/video.mp4"
```

#### Stream Video

```bash
curl -O "http://localhost:3000/video/1"
```

#### Delete Video

```bash
curl -X DELETE "http://localhost:3000/video/1"
```

## Troubleshooting

### Common Issues

1. **File Upload Fails**
   - Check file size (must be under 100MB)
   - Verify file format is supported
   - Ensure proper multipart/form-data format

2. **Video Not Playing**
   - Check if video ID exists
   - Verify MIME type headers
   - Test with different browsers

3. **Database Errors**
   - Verify Supabase connection
   - Check database permissions
   - Ensure videos table exists

### Debug Mode

Enable debug logging by setting environment variable:

```bash
DEBUG=video:* npm start
```

## Future Enhancements

### Planned Features

1. **Video Processing**: Thumbnail generation, format conversion
2. **Compression**: Automatic video compression for storage optimization
3. **Streaming**: Adaptive bitrate streaming support
4. **Metadata**: Extended video metadata extraction
5. **Access Control**: User-based video access permissions

### Configuration Options

Future versions will support:
- Configurable file size limits
- Custom MIME type whitelists
- Storage backend selection
- CDN integration for video delivery

## Support

For issues or questions regarding the video upload API:

1. Check the error logs in your application
2. Verify database connectivity
3. Test with the provided test script
4. Review this documentation for common solutions

## License

This video upload functionality is part of the Backlify-v2 project and follows the same licensing terms.
