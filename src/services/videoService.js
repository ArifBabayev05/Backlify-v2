const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

class VideoService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
    // Supported video formats
    this.supportedFormats = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
    
    // Max file size: 100MB
    this.maxFileSize = 100 * 1024 * 1024;
    
    // Create uploads directory if it doesn't exist
    this.uploadsDir = path.join(__dirname, '../../uploads/videos');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Validate video file
   */
  validateVideoFile(file) {
    // Check file size
    if (file.size > this.maxFileSize) {
      throw new Error(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of 100MB`);
    }

    // Check file format
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (!this.supportedFormats.includes(fileExtension)) {
      throw new Error(`Unsupported file format: ${fileExtension}. Supported formats: ${this.supportedFormats.join(', ')}`);
    }

    // Check MIME type
    const validMimeTypes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/x-matroska'
    ];
    
    if (!validMimeTypes.includes(file.mimetype)) {
      throw new Error(`Invalid MIME type: ${file.mimetype}`);
    }

    return true;
  }

  /**
   * Generate unique filename
   */
  generateUniqueFilename(originalName) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    return `${baseName}_${timestamp}_${randomString}${extension}`;
  }

  /**
   * Upload video to file system and store metadata in database
   */
  async uploadVideo(file) {
    try {
      // Validate file
      this.validateVideoFile(file);

      // Generate unique filename
      const filename = this.generateUniqueFilename(file.originalname);
      const filePath = path.join(this.uploadsDir, filename);

      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);
      console.log(`💾 Video saved to: ${filePath}`);

      // Store metadata in database (without binary data)
      const { data, error } = await this.supabase
        .from('videos')
        .insert([
          {
            filename: filename,
            original_name: file.originalname,
            file_path: filePath, // Store file path instead of binary data
            file_size: file.size,
            mime_type: file.mimetype
          }
        ])
        .select()
        .single();

      if (error) {
        // Clean up file if database insert fails
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        videoId: data.id,
        filename: data.filename,
        originalName: data.original_name,
        fileSize: data.file_size,
        mimeType: data.mime_type,
        uploadedAt: data.uploaded_at
      };
    } catch (error) {
      console.error('Error uploading video:', error);
      throw error;
    }
  }

  /**
   * Get list of all videos
   */
  async getVideoList(limit = 100, offset = 0) {
    try {
      const { data, error, count } = await this.supabase
        .from('videos')
        .select('id, filename, original_name, file_size, mime_type, uploaded_at', { count: 'exact' })
        .order('uploaded_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        videos: data || [],
        total: count || 0,
        limit,
        offset
      };
    } catch (error) {
      console.error('Error getting video list:', error);
      throw error;
    }
  }

  /**
   * Get video by ID
   */
  async getVideoById(id) {
    try {
      console.log(`🔍 Fetching video with ID: ${id}`);
      
      const { data, error } = await this.supabase
        .from('videos')
        .select('id, filename, original_name, file_path, file_size, mime_type, uploaded_at')
        .eq('id', id)
        .single();

      if (error) {
        console.error(`❌ Database error for video ID ${id}:`, error);
        if (error.code === 'PGRST116') {
          throw new Error('Video not found');
        }
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        console.log(`⚠️ No video found with ID: ${id}`);
        throw new Error('Video not found');
      }

      console.log(`✅ Video found: ${data.original_name} (${data.file_size} bytes)`);
      console.log(`🔍 Raw file_data type: ${typeof data.file_data}`);
      console.log(`🔍 Raw file_data length: ${data.file_data ? data.file_data.length : 'null'}`);
      console.log(`🔍 Raw file_data constructor: ${data.file_data ? data.file_data.constructor.name : 'null'}`);
      
      return {
        success: true,
        video: data
      };
    } catch (error) {
      console.error('Error getting video by ID:', error);
      throw error;
    }
  }

  /**
   * Delete video by ID
   */
  async deleteVideo(id) {
    try {
      const { error } = await this.supabase
        .from('videos')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        message: 'Video deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting video:', error);
      throw error;
    }
  }

  /**
   * Get video statistics
   */
  async getVideoStats() {
    try {
      const { data, error } = await this.supabase
        .from('videos')
        .select('file_size, mime_type, uploaded_at');

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const totalVideos = data.length;
      const totalSize = data.reduce((sum, video) => sum + (video.file_size || 0), 0);
      
      // Group by MIME type
      const mimeTypeCounts = {};
      data.forEach(video => {
        const mimeType = video.mime_type || 'unknown';
        mimeTypeCounts[mimeType] = (mimeTypeCounts[mimeType] || 0) + 1;
      });

      // Recent uploads (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentUploads = data.filter(video => 
        new Date(video.uploaded_at) > weekAgo
      ).length;

      return {
        success: true,
        stats: {
          totalVideos,
          totalSize: totalSize,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
          mimeTypeCounts,
          recentUploads,
          averageSize: totalVideos > 0 ? (totalSize / totalVideos / 1024 / 1024).toFixed(2) : 0
        }
      };
    } catch (error) {
      console.error('Error getting video stats:', error);
      throw error;
    }
  }
}

module.exports = VideoService; 
