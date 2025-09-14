const VideoService = require('../services/videoService');
const { setCorsHeaders } = require('../middleware/corsMiddleware');const fs = require('fs');
const path = require('path');


class VideoController {
  constructor() {
    this.videoService = new VideoService();
  }

  /**
   * Upload video endpoint
   * POST /video/upload
   */
  async uploadVideo(req, res) {
    try {
      setCorsHeaders(res, req);

      // Check if file exists
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No video file provided',
          details: 'Please upload a video file using multipart/form-data'
        });
      }

      // Upload video using service
      const result = await this.videoService.uploadVideo(req.file);

      res.status(201).json({
        success: true,
        message: 'Video uploaded successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in uploadVideo controller:', error);
      
      // Handle specific error types
      if (error.message.includes('File size') || error.message.includes('Unsupported file format') || error.message.includes('Invalid MIME type')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid file',
          details: error.message
        });
      }

      if (error.message.includes('Database error')) {
        return res.status(500).json({
          success: false,
          error: 'Database error',
          details: 'Failed to save video to database'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Upload failed',
        details: error.message
      });
    }
  }

  /**
   * Get video list endpoint
   * GET /video/list
   */
  async getVideoList(req, res) {
    try {
      setCorsHeaders(res, req);

      const { limit = 100, offset = 0 } = req.query;
      
      // Validate query parameters
      const parsedLimit = Math.min(parseInt(limit) || 100, 1000); // Max 1000 videos per request
      const parsedOffset = Math.max(parseInt(offset) || 0, 0);

      const result = await this.videoService.getVideoList(parsedLimit, parsedOffset);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error in getVideoList controller:', error);
      
      if (error.message.includes('Database error')) {
        return res.status(500).json({
          success: false,
          error: 'Database error',
          details: 'Failed to retrieve video list'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to get video list',
        details: error.message
      });
    }
  }

  /**
   * Stream video by ID endpoint
   * GET /video/:id
   */
  async streamVideo(req, res) {
    try {
      setCorsHeaders(res, req);

      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid video ID',
          details: 'Please provide a valid numeric video ID'
        });
      }

      // Get video from database
      const result = await this.videoService.getVideoById(parseInt(id));
      
      if (!result.success || !result.video) {
        return res.status(404).json({
          success: false,
          error: 'Video not found',
          details: 'The requested video could not be found'
        });
      }

      const video = result.video;

      // Debug logging
      console.log(`🎥 Streaming video: ${video.original_name}`);
      console.log(`📊 File size: ${video.file_size} bytes`);
      console.log(`🔧 MIME type: ${video.mime_type}`);      console.log(`🔍 Data length: ${video.file_data ? video.file_data.length : 'null'}`);
      console.log(`🔍 First 50 chars: ${video.file_data ? video.file_data.toString().substring(0, 50) : 'null'}`);

      console.log(`💾 Data type: ${typeof video.file_data}`);
      console.log(`📦 Is Buffer: ${Buffer.isBuffer(video.file_data)}`);
      console.log(`🔍 Data length: ${video.file_data ? video.file_data.length : 'null'}`);
      console.log(`🔍 First 50 chars: ${video.file_data ? video.file_data.toString().substring(0, 50) : 'null'}`);

      // Set appropriate headers for video streaming
      res.set({
        'Content-Type': video.mime_type,
        'Content-Length': video.file_size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Content-Disposition': `inline; filename="${video.original_name}"`,
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
        'Access-Control-Allow-Headers': 'Range'
      });

      // Handle range requests for better streaming
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : video.file_size - 1;
        const chunksize = (end - start) + 1;
        
        res.status(206);
        res.set({
          'Content-Range': `bytes ${start}-${end}/${video.file_size}`,
          'Content-Length': chunksize
        });
        
        // Send only the requested chunk - ensure it's a Buffer
        let chunk;
        if (Buffer.isBuffer(video.file_data)) {
          chunk = video.file_data.slice(start, end + 1);
        } else if (typeof video.file_data === 'string') {
          chunk = Buffer.from(video.file_data, 'base64').slice(start, end + 1);
        } else {
          chunk = Buffer.from(video.file_data).slice(start, end + 1);
        }
        res.send(chunk);
      } else {
        // Send the entire video data - ensure it's a Buffer
        let videoBuffer;
        if (Buffer.isBuffer(video.file_data)) {
          videoBuffer = video.file_data;
        } else if (typeof video.file_data === 'string') {
          videoBuffer = Buffer.from(video.file_data, 'base64');
        } else {
          videoBuffer = Buffer.from(video.file_data);
        }
        res.send(videoBuffer);
      }
    } catch (error) {
      console.error('Error in streamVideo controller:', error);
      
      if (error.message === 'Video not found') {
        return res.status(404).json({
          success: false,
          error: 'Video not found',
          details: 'The requested video could not be found'
        });
      }

      if (error.message.includes('Database error')) {
        return res.status(500).json({
          success: false,
          error: 'Database error',
          details: 'Failed to retrieve video from database'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to stream video',
        details: error.message
      });
    }
  }

  /**
   * Get video info by ID endpoint
   * GET /video/:id/info
   */
  async getVideoInfo(req, res) {
    try {
      setCorsHeaders(res, req);

      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid video ID',
          details: 'Please provide a valid numeric video ID'
        });
      }

      // Get video from database
      const result = await this.videoService.getVideoById(parseInt(id));
      
      if (!result.success || !result.video) {
        return res.status(404).json({
          success: false,
          error: 'Video not found',
          details: 'The requested video could not be found'
        });
      }

      const video = result.video;

      // Return video info without the binary data
      res.json({
        success: true,
        data: {
          id: video.id,
          filename: video.filename,
          originalName: video.original_name,
          fileSize: video.file_size,
          fileSizeMB: (video.file_size / 1024 / 1024).toFixed(2),
          mimeType: video.mime_type,
          uploadedAt: video.uploaded_at
        }
      });
    } catch (error) {
      console.error('Error in getVideoInfo controller:', error);
      
      if (error.message === 'Video not found') {
        return res.status(404).json({
          success: false,
          error: 'Video not found',
          details: 'The requested video could not be found'
        });
      }

      if (error.message.includes('Database error')) {
        return res.status(500).json({
          success: false,
          error: 'Database error',
          details: 'Failed to retrieve video info from database'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to get video info',
        details: error.message
      });
    }
  }

  /**
   * Delete video by ID endpoint
   * DELETE /video/:id
   */
  async deleteVideo(req, res) {
    try {
      setCorsHeaders(res, req);

      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid video ID',
          details: 'Please provide a valid numeric video ID'
        });
      }

      // Delete video from database
      const result = await this.videoService.deleteVideo(parseInt(id));
      
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to delete video',
          details: result.message
        });
      }

      res.json({
        success: true,
        message: 'Video deleted successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in deleteVideo controller:', error);
      
      if (error.message.includes('Database error')) {
        return res.status(500).json({
          success: false,
          error: 'Database error',
          details: 'Failed to delete video from database'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete video',
        details: error.message
      });
    }
  }

  /**
   * Get video statistics endpoint
   * GET /video/stats
   */
  async getVideoStats(req, res) {
    try {
      setCorsHeaders(res, req);

      const result = await this.videoService.getVideoStats();
      
      res.json({
        success: true,
        data: result.stats
      });
    } catch (error) {
      console.error('Error in getVideoStats controller:', error);
      
      if (error.message.includes('Database error')) {
        return res.status(500).json({
          success: false,
          error: 'Database error',
          details: 'Failed to retrieve video statistics'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to get video statistics',
        details: error.message
      });
    }
  }
}

module.exports = VideoController;
