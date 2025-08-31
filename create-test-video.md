# Creating a Test Video File

To test the video streaming functionality, you need a small video file. Here are several ways to create one:

## Option 1: Download a Sample Video
```bash
# Download a small sample MP4 file (about 1MB)
curl -o test-video.mp4 "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4"
```

## Option 2: Use FFmpeg to Create a Test Video
If you have FFmpeg installed:
```bash
# Create a 5-second test video
ffmpeg -f lavfi -i testsrc=duration=5:size=320x240:rate=1 -c:v libx264 -preset ultrafast -crf 23 test-video.mp4
```

## Option 3: Use Online Video Generators
- Visit: https://www.onlinevideoconverter.com/
- Create a simple video with text or shapes
- Download as MP4 format

## Option 4: Use Your Phone
- Record a short 5-10 second video
- Transfer to your computer
- Ensure it's in MP4 format

## File Requirements
- **Format**: MP4 (recommended), MOV, AVI, WebM, or MKV
- **Size**: Under 100MB (ideally under 10MB for testing)
- **Duration**: 5-30 seconds is sufficient for testing
- **Resolution**: Any resolution (320x240 to 1920x1080)

## Testing Steps
1. Place the test video file in your project root as `test-video.mp4`
2. Run the test script: `npm run test-video-streaming`
3. Check the console output for any errors
4. Try streaming the video in your browser

## Troubleshooting
If you still get a gray screen:
1. Check the browser console for errors
2. Verify the video file is valid by playing it locally
3. Check the server logs for any streaming errors
4. Ensure the video MIME type is correct
